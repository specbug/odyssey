"""Tests for the background note linker (app/linker.py) and the link API.

The Meta API is replaced by `FakeLLM`, which answers the three call types
(digest, judge, verify) from a topic table: notes that mention the same topic
keyword are related, everything else isn't. Tests drive the worker directly
through `linker.run_once`, with `now` pushed past the quiet period.
"""
import re
from datetime import datetime, timedelta

import pytest

from app import linker, meta_ai
from app.database import SessionLocal
from app.models import Annotation, NoteLink, NoteLinkState
from tests.pdf_factory import make_pdf

TOPICS = {
    "FSRS": "fsrs stability",
    "photoelectric": "photoelectric effect",
    "Byzantine": "byzantine fault tolerance",
}

FSRS_A = "FSRS models memory stability as the days until recall probability drops to 90%."
FSRS_B = "In FSRS, a card's stability grows after each successful review, so intervals lengthen."
PHOTO = "The photoelectric effect shows light arrives in discrete quanta called photons."


def _topic(text):
    return next((k for k in TOPICS if k in text), None)


def _notes_in(user):
    return re.findall(r"<note>\n(.*?)\n</note>", user, flags=re.S)


class FakeLLM:
    def __init__(self):
        self.calls = []
        self.fail = set()       # call types that return None (API failure)
        self.veto = False       # verifier says no to everything
        self.related = None     # override: fn(text_a, text_b) -> bool

    def kinds(self):
        return [k for k, _ in self.calls]

    def is_related(self, a, b):
        if self.related is not None:
            return self.related(a, b)
        return _topic(a) is not None and _topic(a) == _topic(b)

    def __call__(self, system, user, schema_name, schema, **kw):
        self.calls.append((schema_name, user))
        if schema_name in self.fail:
            return None
        texts = _notes_in(user)
        if schema_name == "note_digest":
            t = _topic(texts[0])
            return {
                "substantive": t is not None,
                "gist": texts[0][:80] if t else "",
                "concepts": [TOPICS[t]] if t else [],
            }
        if schema_name == "link_judgments":
            focus, cands = texts[0], texts[1:]
            ids = [int(i) for i in re.findall(r"\[id (\d+)\]", user)]
            return {"judgments": [
                {
                    "id": i,
                    "verdict": "strong" if self.is_related(focus, c) else "none",
                    "relation": "elaborates" if self.is_related(focus, c) else "none",
                    "reason": "both describe FSRS stability" if self.is_related(focus, c) else "unrelated",
                }
                for i, c in zip(ids, cands)
            ]}
        if schema_name == "link_verification":
            ok = not self.veto and self.is_related(texts[0], texts[1])
            return {
                "linked": ok,
                "relation": "elaborates" if ok else "none",
                "reason": "One defines stability; the other says how reviews grow it." if ok else "different points",
            }
        raise AssertionError(schema_name)


@pytest.fixture
def llm(monkeypatch):
    monkeypatch.setenv("META_API_KEY", "sk-test")
    monkeypatch.setenv("LINKER_ENABLED", "true")
    monkeypatch.setattr(linker, "start", lambda: None)
    fake = FakeLLM()
    monkeypatch.setattr(meta_ai, "complete_json", fake)
    return fake


@pytest.fixture(autouse=True)
def _clean_slate():
    linker.status.calls_failed_at.clear()
    db = SessionLocal()
    try:
        db.query(NoteLink).delete()
        db.query(NoteLinkState).delete()
        db.query(Annotation).delete()
        db.commit()
    finally:
        db.close()
    yield


def later(minutes=5):
    return datetime.utcnow() + timedelta(minutes=minutes)


def note(client, text, answer=""):
    resp = client.post("/annotations", json={
        "annotation_id": f"note_{text[:12]}",
        "question": text,
        "answer": answer,
    })
    assert resp.status_code == 200, resp.text
    return resp.json()["id"]


def file_note(client, file_id, text, page=0):
    resp = client.post(f"/files/{file_id}/annotations", json={
        "annotation_id": f"ann_{text[:12]}",
        "page_index": page,
        "question": text,
        "answer": "",
    })
    assert resp.status_code == 200, resp.text
    return resp.json()["id"]


def links(client):
    return client.get("/links").json()


def run(**kw):
    return linker.run_once(now=later(), **kw)


# ─── Linking ────────────────────────────────────────────────────────────

def test_links_related_notes_and_leaves_unrelated_alone(client, llm):
    a, b, c = note(client, FSRS_A), note(client, FSRS_B), note(client, PHOTO)
    work, failed = run()
    assert not failed and work == 6  # 3 digests + 3 scans

    body = links(client)
    assert [(l["source"], l["target"]) for l in body["links"]] == [(min(a, b), max(a, b))]
    link = body["links"][0]
    assert link["relation"] == "elaborates"
    assert link["reason"].startswith("One defines stability")
    assert body["stats"]["active"] == 1
    assert body["stats"]["pending"] == 0
    assert c not in {link["source"], link["target"]}


def test_pair_is_judged_once_not_from_both_ends(client, llm):
    note(client, FSRS_A)
    note(client, FSRS_B)
    run()
    assert llm.kinds().count("link_verification") == 1


def test_unchanged_notes_cost_nothing_on_the_next_pass(client, llm):
    note(client, FSRS_A)
    note(client, FSRS_B)
    note(client, PHOTO)
    run()
    llm.calls.clear()
    assert run() == (0, False)
    assert llm.calls == []


def test_fragments_never_reach_the_judge(client, llm):
    note(client, "test [[x]]")  # under MIN_NOTE_CHARS: not even digested
    note(client, "lorem ipsum dolor sit amet, placeholder")
    note(client, FSRS_A)
    run()
    assert llm.kinds().count("note_digest") == 2
    assert "link_judgments" not in llm.kinds()
    assert links(client)["stats"]["substantive"] == 1


def test_verifier_veto_blocks_the_link(client, llm):
    llm.veto = True
    note(client, FSRS_A)
    note(client, FSRS_B)
    run()
    body = links(client)
    assert body["links"] == []
    assert body["stats"]["declined"] == 1
    assert body["stats"]["proposed"] >= 1
    assert body["stats"]["accepted"] == 0


def test_quiet_period_defers_fresh_notes(client, llm):
    note(client, FSRS_A)
    assert linker.run_once(now=datetime.utcnow()) == (0, False)
    assert llm.calls == []


def test_disabled_flag_turns_the_worker_off(client, llm, monkeypatch):
    monkeypatch.setenv("LINKER_ENABLED", "false")
    note(client, FSRS_A)
    assert run() == (0, False)
    assert llm.calls == []
    assert links(client)["stats"]["enabled"] is False


def test_api_failure_leaves_note_pending_and_backs_off(client, llm):
    note(client, FSRS_A)
    llm.fail = {"note_digest"}
    assert run() == (0, True)
    assert links(client)["stats"]["pending"] == 1
    assert "digest failed" in links(client)["stats"]["last_error"]

    # The failed note is skipped until the backoff expires…
    llm.fail = set()
    llm.calls.clear()
    assert run() == (0, False)
    assert llm.calls == []
    # …then picked up again.
    linker.status.calls_failed_at.clear()
    assert run()[0] == 2


def test_judge_failure_does_not_mark_scan_done(client, llm):
    note(client, FSRS_A)
    note(client, FSRS_B)
    llm.fail = {"link_judgments"}
    assert run()[1] is True
    linker.status.calls_failed_at.clear()
    llm.fail = set()
    run()
    assert len(links(client)["links"]) == 1


# ─── Edits, unlinks, caps ───────────────────────────────────────────────

def test_edit_rechecks_existing_link_with_verifier_only(client, llm):
    a = note(client, FSRS_A)
    note(client, FSRS_B)
    run()
    assert len(links(client)["links"]) == 1

    llm.calls.clear()
    llm.veto = True
    client.put(f"/annotations/{a}", json={"question": FSRS_A + " Edited."})
    run()
    assert links(client)["links"] == []
    # The existing partner went straight to verification, not the judge.
    assert "link_judgments" not in llm.kinds()
    assert llm.kinds().count("link_verification") == 1


def test_unlink_is_permanent(client, llm):
    a, b = note(client, FSRS_A), note(client, FSRS_B)
    run()
    link_id = links(client)["links"][0]["id"]

    resp = client.delete(f"/links/{link_id}")
    assert resp.status_code == 200 and resp.json()["status"] == "rejected"
    assert links(client)["stats"]["rejected"] == 1

    llm.calls.clear()
    client.put(f"/annotations/{a}", json={"question": FSRS_A + " Edited."})
    client.put(f"/annotations/{b}", json={"question": FSRS_B + " Edited."})
    run()
    assert links(client)["links"] == []
    assert "link_verification" not in llm.kinds()


def test_restore_undoes_unlink(client, llm):
    note(client, FSRS_A)
    note(client, FSRS_B)
    run()
    link_id = links(client)["links"][0]["id"]
    assert client.post(f"/links/{link_id}/restore").status_code == 409  # still active
    client.delete(f"/links/{link_id}")
    assert client.delete(f"/links/{link_id}").status_code == 409
    resp = client.post(f"/links/{link_id}/restore")
    assert resp.status_code == 200 and resp.json()["status"] == "active"
    assert client.delete("/links/999999").status_code == 404


def test_same_document_links_are_capped(client, llm):
    resp = client.post("/upload", files={
        "file": ("fsrs.pdf", make_pdf([["FSRS paper, cap test"]]), "application/pdf"),
    })
    file_id = resp.json()["file_data"]["id"]
    ids = [
        file_note(client, file_id, f"{FSRS_A} Variant {i}.", page=i)
        for i in range(5)
    ]
    run()
    per_note = {i: 0 for i in ids}
    for l in links(client)["links"]:
        per_note[l["source"]] += 1
        per_note[l["target"]] += 1
    assert max(per_note.values()) <= linker.MAX_SAME_DOC_LINKS
    assert sum(per_note.values()) > 0


def test_total_links_per_note_are_capped(client, llm):
    hub = note(client, FSRS_A)
    for i in range(linker.MAX_LINKS_PER_NOTE + 3):
        note(client, f"{FSRS_B} Standalone variant {i}.")
    llm.related = lambda a, b: FSRS_A in a or FSRS_A in b  # only hub pairs relate
    run(max_notes=100)
    count = sum(1 for l in links(client)["links"] if hub in (l["source"], l["target"]))
    assert count == linker.MAX_LINKS_PER_NOTE


# ─── API surface ────────────────────────────────────────────────────────

def test_annotation_links_and_link_count(client, llm):
    a, b, c = note(client, FSRS_A), note(client, FSRS_B), note(client, PHOTO)
    run()
    linked = client.get(f"/annotations/{a}/links").json()
    assert [x["note"]["id"] for x in linked] == [b]
    assert linked[0]["link"]["reason"]

    counts = {n["id"]: n["link_count"] for n in client.get("/annotations").json()}
    assert counts == {a: 1, b: 1, c: 0}


def test_deleting_a_note_removes_its_links(client, llm):
    a = note(client, FSRS_A)
    note(client, FSRS_B)
    run()
    assert client.delete(f"/annotations/{a}").status_code == 200
    assert links(client)["links"] == []
    db = SessionLocal()
    try:
        assert db.query(NoteLink).count() == 0
        assert db.query(NoteLinkState).filter_by(annotation_id=a).count() == 0
    finally:
        db.close()


# ─── Pieces ─────────────────────────────────────────────────────────────

def test_note_text_fills_cloze_and_drops_images():
    ann = Annotation(
        question="The [[mitochondria]] is the powerhouse [image:abc-123]",
        answer="", highlighted_text="The mitochondria is the powerhouse",
    )
    assert linker.note_text(ann) == "The mitochondria is the powerhouse [image]"


def test_note_text_strips_drawer_html():
    ann = Annotation(question="<div><b>Entropy</b> &amp; disorder<br>rise</div>", answer="")
    assert linker.note_text(ann) == "Entropy & disorder rise"


def test_retrieval_prefers_a_shared_concept_over_shared_words():
    docs = {
        1: linker.Index.document("Stability in FSRS", "how stable memories are", ["fsrs stability"]),
        2: linker.Index.document("Reviews raise it", "intervals lengthen", ["fsrs stability"]),
        3: linker.Index.document("Stability of a bridge under load", "bridges", ["structural stability"]),
        4: linker.Index.document("Unrelated", "cooking pasta", ["al dente"]),
    }
    ranked = [nid for nid, _ in linker.Index(docs).similar(1, 3)]
    assert ranked[0] == 2
    assert 4 not in ranked
