"""Automatic note linking — the Zettelkasten layer.

A background worker that keeps a graph of genuinely related annotations, so
the reader never has to remember an old note to link it. Precision beats
recall everywhere here: a missed link costs nothing, while a junk link costs
trust in every other link. So the pipeline is built to say "no" a lot.

Per note, each step cached by a content signature (an unchanged note is never
re-sent):

1. Digest — one cheap call returns {substantive, gist, concepts}. Notes that
   aren't real knowledge (test text, fragments) are never linked.
2. Retrieve — local TF-IDF over gist + concepts + text picks the top
   CANDIDATE_LIMIT other notes. No LLM, no embeddings. Recall only: sharing
   words gets a pair *considered*, never linked.
3. Judge — one call with the note and its candidates. The model has to name a
   specific relation and grade it strong / weak / none; only strong goes on.
4. Verify — each strong pair is asked again on its own, with nothing else in
   view. Both calls have to agree.

Then caps: at most MAX_LINKS_PER_NOTE links per note, and at most
MAX_SAME_DOC_LINKS of them to notes from the same document. Neighbouring
notes in one document are trivially "about the same thing", and that's
exactly the noise this layer must not produce.

Every judged pair gets a NoteLink row (active / declined), so a pair is
re-judged only when either note's text changes. That is also how stale links
die: edit a note and its links are re-checked; any the model no longer
supports go to declined. A user's unlink is status `rejected`, a tombstone
that is never overridden.

Notes are sent to the Meta Model API — the Contributor tier by default, which
Meta may train on. LINKER_ENABLED=false turns the worker off while keeping
PDF metadata enrichment.
"""
from __future__ import annotations

import asyncio
import hashlib
import html
import json
import math
import os
import re
import time
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import NoReturn, Optional

from sqlalchemy import or_
from sqlalchemy.orm import Session

from . import meta_ai
from .database import SessionLocal
from .models import Annotation, NoteLink, NoteLinkState, PDFFile

ENABLED_ENV = "LINKER_ENABLED"
MODEL_ENV = "META_LINK_MODEL"

# Part of every content signature: bump it when a prompt or the note text
# preparation changes, and every note is re-digested and re-judged, slowly,
# by the normal worker loop.
PIPELINE_VERSION = "links-v1"

CANDIDATE_LIMIT = 8
MIN_RETRIEVAL_SCORE = 0.04
MAX_LINKS_PER_NOTE = 6
MAX_SAME_DOC_LINKS = 2

MAX_NOTE_CHARS = 1500
MIN_NOTE_CHARS = 12

# Wait until a note has been left alone this long before reading it, so a
# burst of edits costs one scan, not five.
QUIET_PERIOD = timedelta(seconds=90)
TICK_NOTE_LIMIT = 20
IDLE_INTERVAL_S = 60.0
BUSY_INTERVAL_S = 2.0
FAILURE_INTERVAL_S = 300.0
STARTUP_DELAY_S = 20.0
# A note whose call failed is left alone this long before it's retried.
NOTE_BACKOFF_S = 1800.0

RELATIONS = (
    "same_concept", "elaborates", "example", "contrasts",
    "prerequisite", "cause_effect",
)

ACTIVE, DECLINED, REJECTED = "active", "declined", "rejected"


# ─── Note text ──────────────────────────────────────────────────────────

_CLOZE_RE = re.compile(r"\[\[([^\]]+)\]\]")
_IMAGE_RE = re.compile(r"\[image:[^\]]+\]")
# The capture drawer is contenteditable, so stored text can carry <b>, <br>,
# <div> and entities.
_TAG_RE = re.compile(r"<[^>]+>")


def _clean(text: Optional[str]) -> str:
    if not text:
        return ""
    text = html.unescape(_TAG_RE.sub(" ", text))
    text = _CLOZE_RE.sub(r"\1", text)
    text = _IMAGE_RE.sub("[image]", text)
    return " ".join(text.split())


@dataclass
class Note:
    id: int
    file_id: Optional[int]
    label: str  # where the note came from, for the prompt
    text: str
    sig: str
    updated: datetime


def note_text(ann: Annotation) -> str:
    """What the model reads for a note: prompt with cloze answers filled in,
    then the answer, then the highlighted passage if it adds anything."""
    question = _clean(ann.question)
    answer = _clean(ann.answer)
    passage = _clean(ann.highlighted_text)
    parts = [question] if question else []
    if answer:
        parts.append(f"Answer: {answer}")
    if passage and passage not in question:
        parts.append(f"Highlighted passage: {passage}")
    return "\n".join(parts)[:MAX_NOTE_CHARS]


def _label(ann: Annotation, file: Optional[PDFFile]) -> str:
    if file is None:
        return "standalone note"
    title = file.title or os.path.splitext(file.original_filename or "")[0] or "untitled"
    page = f", p. {ann.page_index + 1}" if ann.page_index is not None else ""
    return f'"{title}"{page}'


def _sig(*parts: str) -> str:
    h = hashlib.sha1(PIPELINE_VERSION.encode())
    for p in parts:
        h.update(b"\x00" + p.encode())
    return h.hexdigest()


def _pair_sig(a: Note, b: Note) -> str:
    x, y = sorted((a, b), key=lambda n: n.id)
    return _sig(x.sig, y.sig)


def _naive_utc(dt: Optional[datetime]) -> datetime:
    if dt is None:
        return datetime.min
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


def load_notes(db: Session) -> list[Note]:
    files = {f.id: f for f in db.query(PDFFile).all()}
    notes = []
    for ann in db.query(Annotation).all():
        file = files.get(ann.file_id) if ann.file_id is not None else None
        label = _label(ann, file)
        text = note_text(ann)
        notes.append(Note(
            id=ann.id, file_id=ann.file_id if file else None, label=label,
            text=text, sig=_sig(label, text),
            updated=_naive_utc(ann.updated_date or ann.created_date),
        ))
    return notes


# ─── Retrieval (local, no LLM) ──────────────────────────────────────────

_WORD_RE = re.compile(r"[a-z0-9][a-z0-9'\-]*[a-z0-9]|[a-z0-9]")
_STOP = frozenset("""
a about above after again against all also am an and any are as at be because
been before being below between both but by can could did do does doing down
during each few for from further had has have having he her here hers him his
how i if in into is it its itself just me more most my no nor not now of off on
once only or other our ours out over own same she should so some such than that
the their theirs them then there these they this those through to too under
until up very was we were what when where which while who whom why will with
would you your yours answer highlighted passage image one two use used using
""".split())


def _stem(w: str) -> str:
    if len(w) > 4 and w.endswith("ies"):
        return w[:-3] + "y"
    if len(w) > 3 and w.endswith("s") and not w.endswith(("ss", "us", "is")):
        return w[:-1]
    return w


def _terms(text: str) -> list[str]:
    return [
        _stem(w) for w in _WORD_RE.findall(text.lower())
        if len(w) > 2 and w not in _STOP
    ]


class Index:
    """TF-IDF cosine over each note's concepts (weighted up), gist and text.

    A concept phrase also counts as a single term, so two notes that name the
    same concept score above two notes that merely share its words.
    """

    def __init__(self, docs: dict[int, Counter]):
        n = len(docs)
        df: Counter = Counter()
        for terms in docs.values():
            df.update(terms.keys())
        self.vectors: dict[int, dict[str, float]] = {}
        for nid, terms in docs.items():
            vec = {
                t: (1 + math.log(c)) * math.log(1 + n / df[t])
                for t, c in terms.items()
            }
            norm = math.sqrt(sum(v * v for v in vec.values())) or 1.0
            self.vectors[nid] = {t: v / norm for t, v in vec.items()}

    @staticmethod
    def document(text: str, gist: str, concepts: list[str]) -> Counter:
        terms = Counter(_terms(text))
        for t in _terms(gist):
            terms[t] += 2
        for c in concepts:
            for t in _terms(c):
                terms[t] += 3
            phrase = " ".join(_terms(c))
            if phrase:
                terms[f"c:{phrase}"] += 3
        return terms

    def similar(self, nid: int, limit: int) -> list[tuple[int, float]]:
        mine = self.vectors.get(nid)
        if not mine:
            return []
        scored = []
        for other, vec in self.vectors.items():
            if other == nid:
                continue
            if len(vec) < len(mine):
                s = sum(w * mine.get(t, 0.0) for t, w in vec.items())
            else:
                s = sum(w * vec.get(t, 0.0) for t, w in mine.items())
            if s >= MIN_RETRIEVAL_SCORE:
                scored.append((other, s))
        scored.sort(key=lambda x: (-x[1], x[0]))
        return scored[:limit]


# ─── Prompts ────────────────────────────────────────────────────────────

_DIGEST_SYSTEM = (
    "You index study notes in a personal knowledge archive. Each note was "
    "written by a reader, usually about a passage of a document they were "
    "reading. Reply with JSON only."
)

_DIGEST_USER = """\
Return a JSON object with:
  - substantive: true if the note states a real idea, fact, claim, definition
    or question someone could learn from. false for test text, placeholders,
    lone words, gibberish, or fragments whose meaning can't be recovered.
  - gist: what the note says, in at most 25 words of your own. Use only what
    the note says; add no outside facts. Empty string if not substantive.
  - concepts: 1 to 5 of the most specific concepts the note is about, as short
    lowercase noun phrases in their most standard name (e.g. "fsrs stability",
    not "memory"; "photoelectric effect", not "physics"). No generic subjects.
    Empty list if not substantive.

Note (from {label}):
<note>
{text}
</note>"""

_DIGEST_SCHEMA = {
    "type": "object",
    "properties": {
        "substantive": {"type": "boolean"},
        "gist": {"type": "string"},
        "concepts": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["substantive", "gist", "concepts"],
    "additionalProperties": False,
}

_LINK_RULES = """\
A link says: someone revisiting one note would understand or remember it
better by also seeing the other. Wrong links waste attention and erode trust
in every other link, so the bar is high and most pairs do not qualify.

Link only for a specific connection, one of:
  - same_concept: both are about the same specific idea, claim or mechanism,
    and each adds something the other lacks
  - elaborates: one explains the mechanism, detail or reasoning behind the
    other
  - example: one is a concrete instance of the other's general claim
  - contrasts: one contradicts, qualifies, or offers an alternative to the other
  - prerequisite: one can't be understood properly without the other
  - cause_effect: one describes a cause of what the other describes

Do NOT link when:
  - they only share a broad subject, field, author or book
  - they share words, names or terms but make different points
  - they come from the same document and say related things in sequence: the
    reader already meets those together by reading. Link same-document notes
    only when the connection is one reading order wouldn't make for them, such
    as a definition many pages earlier that a later note silently relies on
  - the connection needs facts that are not in the notes themselves
  - either note is too fragmentary to tell what it claims"""

_JUDGE_SYSTEM = (
    "You maintain the links between notes in a personal Zettelkasten of study "
    "notes. You are strict: when in doubt, the answer is none. Reply with JSON "
    "only."
)

_JUDGE_USER = """\
{rules}

Grade each candidate against the focus note:
  - strong: a specific connection from the list above that you could state in
    one sentence using only what the two notes say
  - weak: related, but the connection is generic, partial, or a stretch
  - none: not related in a way that matters

For each candidate, return its id, verdict, relation (one of the six names
above, or "none") and reason: at most 25 words naming what specifically
connects them, or why not. Refer only to what the notes say.

Focus note (from {label}):
<note>
{text}
</note>

Candidates:
{candidates}"""

_JUDGE_SCHEMA = {
    "type": "object",
    "properties": {
        "judgments": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "integer"},
                    "verdict": {"type": "string", "enum": ["strong", "weak", "none"]},
                    "relation": {"type": "string", "enum": list(RELATIONS) + ["none"]},
                    "reason": {"type": "string"},
                },
                "required": ["id", "verdict", "relation", "reason"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["judgments"],
    "additionalProperties": False,
}

_VERIFY_SYSTEM = (
    "You check a proposed link between two study notes in a personal "
    "Zettelkasten. Reject it unless it clearly meets the bar. Reply with JSON "
    "only."
)

_VERIFY_USER = """\
{rules}

Should these two notes be linked? Answer linked=true only if the connection is
specific and you can state it in one sentence using only what the notes say.
If true, give the relation (one of the six names above) and the reason in at
most 25 words — written so a reader looking at either note understands why
the other is worth seeing. If false, use relation "none" and say why not.

Note A (from {label_a}):
<note>
{text_a}
</note>

Note B (from {label_b}):
<note>
{text_b}
</note>"""

_VERIFY_SCHEMA = {
    "type": "object",
    "properties": {
        "linked": {"type": "boolean"},
        "relation": {"type": "string", "enum": list(RELATIONS) + ["none"]},
        "reason": {"type": "string"},
    },
    "required": ["linked", "relation", "reason"],
    "additionalProperties": False,
}


def _model() -> str:
    return (
        os.getenv(MODEL_ENV) or os.getenv(meta_ai.MODEL_ENV) or meta_ai.DEFAULT_MODEL
    )


def _short(s, limit: int = 300) -> str:
    s = " ".join(str(s or "").split())
    return s if len(s) <= limit else s[: limit - 1].rstrip() + "…"


def digest(note: Note) -> Optional[dict]:
    """{substantive, gist, concepts} for a note, or None if the call failed."""
    if len(note.text) < MIN_NOTE_CHARS:
        return {"substantive": False, "gist": "", "concepts": []}
    out = meta_ai.complete_json(
        _DIGEST_SYSTEM,
        _DIGEST_USER.format(label=note.label, text=note.text),
        "note_digest", _DIGEST_SCHEMA,
        model=_model(), reasoning_effort="minimal", max_completion_tokens=512,
    )
    if out is None:
        return None
    concepts = [
        _short(c, 60).lower() for c in (out.get("concepts") or [])
        if isinstance(c, str) and c.strip()
    ][:5]
    substantive = out.get("substantive") is True and bool(concepts)
    return {
        "substantive": substantive,
        "gist": _short(out.get("gist"), 240) if substantive else "",
        "concepts": concepts if substantive else [],
    }


def judge(note: Note, candidates: list[Note]) -> Optional[dict[int, dict]]:
    """Grade candidates against a note. {candidate id: judgment}, or None if
    the call failed. A candidate the model leaves out counts as none."""
    listing = "\n\n".join(
        f"[id {c.id}] (from {c.label})\n<note>\n{c.text}\n</note>" for c in candidates
    )
    out = meta_ai.complete_json(
        _JUDGE_SYSTEM,
        _JUDGE_USER.format(
            rules=_LINK_RULES, label=note.label, text=note.text, candidates=listing,
        ),
        "link_judgments", _JUDGE_SCHEMA,
        model=_model(), reasoning_effort="low", max_completion_tokens=3072,
    )
    if out is None:
        return None
    wanted = {c.id for c in candidates}
    result: dict[int, dict] = {}
    for j in out.get("judgments") or []:
        if not isinstance(j, dict) or j.get("id") not in wanted:
            continue
        result[j["id"]] = j
    return result


def verify(a: Note, b: Note) -> Optional[dict]:
    """Second, independent opinion on one pair. None if the call failed."""
    out = meta_ai.complete_json(
        _VERIFY_SYSTEM,
        _VERIFY_USER.format(
            rules=_LINK_RULES,
            label_a=a.label, text_a=a.text, label_b=b.label, text_b=b.text,
        ),
        "link_verification", _VERIFY_SCHEMA,
        model=_model(), reasoning_effort="low", max_completion_tokens=1024,
    )
    return out


def _is_strong(j: Optional[dict]) -> bool:
    return bool(j) and j.get("verdict") == "strong" and j.get("relation") in RELATIONS


def _is_confirmed(v: dict) -> bool:
    return (
        v.get("linked") is True
        and v.get("relation") in RELATIONS
        and bool(str(v.get("reason") or "").strip())
    )


# ─── Worker ─────────────────────────────────────────────────────────────

@dataclass
class Status:
    running: bool = False
    last_tick: Optional[datetime] = None
    last_error: Optional[str] = None
    calls_failed_at: dict[int, float] = field(default_factory=dict)


status = Status()


def is_enabled() -> bool:
    flag = (os.getenv(ENABLED_ENV) or "true").strip().lower()
    return flag not in {"0", "false", "no", "off"} and meta_ai.is_configured()


class _CallFailed(Exception):
    pass


def _backing_off(nid: int) -> bool:
    t = status.calls_failed_at.get(nid)
    return t is not None and time.monotonic() - t < NOTE_BACKOFF_S


def _failed(nid: int, what: str) -> NoReturn:
    status.calls_failed_at[nid] = time.monotonic()
    status.last_error = f"{what} failed for note {nid}"
    raise _CallFailed(status.last_error)


def _write_pair(
    db: Session, a: Note, b: Note, row: Optional[NoteLink], *,
    status_: str, relation: Optional[str], reason: Optional[str],
) -> None:
    if row is None:
        lo, hi = sorted((a.id, b.id))
        row = NoteLink(a_id=lo, b_id=hi)
        db.add(row)
    row.status = status_
    row.relation = relation
    row.reason = _short(reason, 300) if reason else None
    row.pair_sig = _pair_sig(a, b)
    row.model = _model()
    db.commit()


def _scan(
    db: Session, note: Note, notes: dict[int, Note],
    states: dict[int, NoteLinkState], index: Index,
) -> None:
    """Judge one note against its candidates and write the verdicts."""
    state = states[note.id]
    rows = {
        (r.b_id if r.a_id == note.id else r.a_id): r
        for r in db.query(NoteLink).filter(
            or_(NoteLink.a_id == note.id, NoteLink.b_id == note.id)
        )
    }

    def linkable(nid: int) -> bool:
        st = states.get(nid)
        return nid in notes and st is not None and st.substantive and st.digest_sig == notes[nid].sig

    if not state.substantive:
        # Not knowledge (any more): drop whatever links it had.
        for other_id, row in rows.items():
            if row.status == ACTIVE and other_id in notes:
                _write_pair(db, note, notes[other_id], row, status_=DECLINED,
                            relation=None, reason="note is not substantive")
        return

    def stale(nid: int) -> bool:
        """Linkable, not tombstoned, and not yet judged on the current text."""
        row = rows.get(nid)
        if not linkable(nid):
            return False
        return row is None or (row.status != REJECTED and row.pair_sig != _pair_sig(note, notes[nid]))

    # An existing link whose text changed only has to pass verification
    # again; sending it back through the judge as well would make links
    # flicker on every typo fix.
    existing = [notes[nid] for nid, r in rows.items() if r.status == ACTIVE and stale(nid)]
    fresh = [
        notes[nid] for nid, _ in index.similar(note.id, CANDIDATE_LIMIT)
        if stale(nid) and not (nid in rows and rows[nid].status == ACTIVE)
    ]

    for other in existing:
        _confirm(db, note, other, rows.get(other.id))

    if not fresh:
        return
    verdicts = judge(note, fresh)
    if verdicts is None:
        _failed(note.id, "judge")
    for other in fresh:
        row = rows.get(other.id)
        j = verdicts.get(other.id)
        if not _is_strong(j):
            _write_pair(db, note, other, row, status_=DECLINED,
                        relation=None, reason=(j or {}).get("reason"))
            continue
        state.proposed = (state.proposed or 0) + 1
        if not _has_room(db, note, other, notes):
            # No row written: the pair stays unjudged and is reconsidered the
            # next time either note changes.
            continue
        if _confirm(db, note, other, row):
            state.accepted = (state.accepted or 0) + 1


def _confirm(db: Session, a: Note, b: Note, row: Optional[NoteLink]) -> bool:
    """Run verification on a pair and write the outcome. True if linked."""
    v = verify(a, b)
    if v is None:
        _failed(a.id, "verify")
    if _is_confirmed(v):
        _write_pair(db, a, b, row, status_=ACTIVE,
                    relation=v["relation"], reason=v["reason"])
        return True
    _write_pair(db, a, b, row, status_=DECLINED,
                relation=None, reason=v.get("reason"))
    return False


def _has_room(db: Session, a: Note, b: Note, notes: dict[int, Note]) -> bool:
    same_doc = a.file_id is not None and a.file_id == b.file_id
    for n in (a, b):
        active = db.query(NoteLink).filter(
            NoteLink.status == ACTIVE,
            or_(NoteLink.a_id == n.id, NoteLink.b_id == n.id),
        ).all()
        if len(active) >= MAX_LINKS_PER_NOTE:
            return False
        if same_doc:
            partners = [r.b_id if r.a_id == n.id else r.a_id for r in active]
            if sum(1 for p in partners if p in notes and notes[p].file_id == n.file_id) >= MAX_SAME_DOC_LINKS:
                return False
    return True


def run_once(now: Optional[datetime] = None, max_notes: int = TICK_NOTE_LIMIT) -> tuple[int, bool]:
    """One worker pass. Returns (notes processed, whether a call failed).

    Digests every pending note first, so retrieval sees fresh concepts for the
    whole archive, then scans. Stops at `max_notes` or the first failed call —
    a failure usually means the API is down or rate-limiting, and pressing on
    would just fail again.
    """
    if not is_enabled():
        return 0, False
    now = now or datetime.utcnow()
    cutoff = now - QUIET_PERIOD
    db = SessionLocal()
    work = 0
    try:
        notes = {n.id: n for n in load_notes(db)}
        states = {s.annotation_id: s for s in db.query(NoteLinkState).all()}
        ready = [n for n in notes.values() if n.updated <= cutoff and not _backing_off(n.id)]
        ready.sort(key=lambda n: n.id)

        for note in ready:
            st = states.get(note.id)
            if st is not None and st.digest_sig == note.sig:
                continue
            if work >= max_notes:
                return work, False
            d = digest(note)
            if d is None:
                _failed(note.id, "digest")
            if st is None:
                st = NoteLinkState(annotation_id=note.id)
                db.add(st)
                states[note.id] = st
            st.digest_sig = note.sig
            st.substantive = d["substantive"]
            st.gist = d["gist"]
            st.concepts = json.dumps(d["concepts"])
            db.commit()
            work += 1

        index = Index({
            nid: Index.document(notes[nid].text, st.gist or "", json.loads(st.concepts or "[]"))
            for nid, st in states.items()
            if nid in notes and st.substantive and st.digest_sig == notes[nid].sig
        })
        for note in ready:
            st = states.get(note.id)
            if st is None or st.digest_sig != note.sig or st.scan_sig == note.sig:
                continue
            if work >= max_notes:
                return work, False
            _scan(db, note, notes, states, index)
            st.scan_sig = note.sig
            st.scanned_date = now
            db.commit()
            work += 1
        status.last_error = None
        return work, False
    except _CallFailed:
        db.rollback()
        return work, True
    except Exception as e:
        db.rollback()
        status.last_error = f"{type(e).__name__}: {e}"
        print(f"❌ Linker pass failed: {status.last_error}")
        return work, True
    finally:
        status.last_tick = now
        db.close()


async def _loop() -> None:
    await asyncio.sleep(STARTUP_DELAY_S)
    while True:
        work, failed = await asyncio.to_thread(run_once)
        if work:
            print(f"🔗 Linker processed {work} note(s)")
        if failed:
            delay = FAILURE_INTERVAL_S
        elif work >= TICK_NOTE_LIMIT:
            delay = BUSY_INTERVAL_S
        else:
            delay = IDLE_INTERVAL_S
        await asyncio.sleep(delay)


def start() -> Optional[asyncio.Task]:
    """Spawn the worker if linking is enabled and a key is set, else no-op."""
    if not is_enabled():
        return None
    status.running = True
    print(f"🔗 Linker enabled — model {_model()}")
    return asyncio.create_task(_loop())


async def stop(task: Optional[asyncio.Task]) -> None:
    status.running = False
    if task is None:
        return
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


# ─── Reporting ──────────────────────────────────────────────────────────

def stats(db: Session) -> dict:
    """Counts for the graph screen — and the numbers to watch while deciding
    whether the links are any good. `rejected` is links the user removed: the
    closest thing to a false-positive rate."""
    counts = Counter(s for (s,) in db.query(NoteLink.status).all())
    notes = load_notes(db)
    states = {s.annotation_id: s for s in db.query(NoteLinkState).all()}
    pending = sum(
        1 for n in notes
        if (st := states.get(n.id)) is None or st.digest_sig != n.sig or st.scan_sig != n.sig
    )
    current = [st for n in notes if (st := states.get(n.id)) is not None]
    return {
        "enabled": is_enabled(),
        "running": status.running,
        "model": _model() if is_enabled() else None,
        "last_run": status.last_tick.isoformat() + "Z" if status.last_tick else None,
        "last_error": status.last_error,
        "notes": len(notes),
        "pending": pending,
        "substantive": sum(1 for st in current if st.substantive),
        "active": counts.get(ACTIVE, 0),
        "declined": counts.get(DECLINED, 0),
        "rejected": counts.get(REJECTED, 0),
        "proposed": sum(st.proposed or 0 for st in current),
        "accepted": sum(st.accepted or 0 for st in current),
    }
