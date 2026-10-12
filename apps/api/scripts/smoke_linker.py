"""Live check of the note linker's judgement against the real Meta Model API.

Usage (from apps/api, with META_API_KEY in the environment or .env):

    python -m scripts.smoke_linker
    META_LINK_MODEL=muse-spark-1.3 python -m scripts.smoke_linker   # compare tiers

Runs a fixed set of labelled note pairs through the same judge → verify path
the worker uses, and prints each outcome plus the score. Most pairs are hard
negatives: shared vocabulary, same broad field, neighbours in one document.
They're the noise the linker must not make. The number that matters is
false links, which should be zero; a missed true pair is cheap.

    podman exec odyssey_api_1 python -m scripts.smoke_linker

Exits non-zero if any negative pair was linked.
"""
import sys
import time
from datetime import datetime

from dotenv import load_dotenv

from app import linker, meta_ai


def n(i, text, label="standalone note", file_id=None):
    return linker.Note(id=i, file_id=file_id, label=label, text=text, sig=str(i), updated=datetime.min)


SRS = '"Algorithms for Spaced Repetition"'
DDIA = '"Designing Data-Intensive Applications"'

# (note A, note B, should link?, what the pair tests)
CASES = [
    (n(1, "FSRS models memory stability as the number of days until recall probability falls to 90%.", f"{SRS}, p. 3", 1),
     n(2, "In FSRS, each successful review multiplies stability, so intervals grow; a lapse cuts it back."),
     True, "definition ↔ mechanism, across sources"),
    (n(3, "Retrieval practice: testing yourself strengthens memory more than rereading the same material."),
     n(4, "Failed recall attempts followed by feedback still improve later retention — the 'pretesting effect'."),
     True, "claim ↔ qualifying evidence"),
    (n(5, "Quorum reads and writes overlap when w + r > n, so a read sees the latest acknowledged write.", f"{DDIA}, p. 179", 2),
     n(6, "Even with w + r > n, sloppy quorums and concurrent writes mean you can read stale values — quorums don't give linearizability.", f"{DDIA}, p. 334", 2),
     True, "same-document link that reading order doesn't make (150 pages apart)"),
    (n(7, "FSRS models memory stability as the number of days until recall probability falls to 90%."),
     n(8, "A bridge's stability under load depends on how forces are distributed across its trusses."),
     False, "shared word 'stability', different concepts"),
    (n(9, "Leader-based replication streams a write log from the leader to its followers.", f"{DDIA}, p. 152", 2),
     n(10, "Followers can lag behind the leader, so a read from a follower may be stale.", f"{DDIA}, p. 153", 2),
     False, "adjacent pages, same section: reading order already connects them"),
    (n(11, "The photoelectric effect shows light arrives in discrete quanta called photons."),
     n(12, "Electrons produce an interference pattern in the double-slit experiment."),
     False, "same broad field (quantum physics), different points"),
    (n(13, "Raft elects a leader by majority vote within a numbered term."),
     n(14, "LSM-trees turn random writes into sequential ones by buffering in memory and compacting sorted files."),
     False, "same book, unrelated mechanisms"),
    (n(15, "Spacing effect: distributed practice beats massed practice for long-term retention."),
     n(16, "Kubernetes restarts a container when its liveness probe fails three times."),
     False, "unrelated control"),
    (n(17, "test [[x]] and [[y]]"),
     n(18, "FSRS models memory stability as the number of days until recall probability falls to 90%."),
     False, "fragment"),
]


def main() -> int:
    load_dotenv()
    if not meta_ai.is_configured():
        print(f"{meta_ai.API_KEY_ENV} is not set.")
        return 2
    print(f"model {linker._model()}\n")
    tp = fp = fn = tn = 0
    for a, b, expect, why in CASES:
        t0 = time.monotonic()
        verdicts = linker.judge(a, [b])
        if verdicts is None:
            print(f"✗ API failure on: {why}")
            return 2
        j = verdicts.get(b.id) or {}
        linked, detail = False, f"judge: {j.get('verdict', 'missing')}"
        if linker._is_strong(j):
            v = linker.verify(a, b)
            if v is None:
                print(f"✗ API failure on: {why}")
                return 2
            linked = linker._is_confirmed(v)
            detail += f" · verify: {'yes' if linked else 'no'} ({v.get('relation')})"
            reason = v.get("reason")
        else:
            reason = j.get("reason")
        dt = time.monotonic() - t0
        ok = linked == expect
        tp += linked and expect
        fp += linked and not expect
        fn += expect and not linked
        tn += not expect and not linked
        mark = "✓" if ok else ("✗ FALSE LINK" if linked else "· missed")
        print(f"{mark:13} {why}\n              {detail} · {dt:.1f}s\n              {reason}\n")
    print(f"links made: {tp} correct, {fp} false · missed {fn} · correctly unlinked {tn}")
    return 1 if fp else 0


if __name__ == "__main__":
    sys.exit(main())
