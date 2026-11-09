"""Document inks: each PDF gets one colour, chosen once and kept for good.

The web app holds the colours themselves (apps/webapp/src/data/inks.js); the
server only stores an index into that list on PDFFile.ink. A new document
takes the least-used ink, lowest index first, so a library stays spread
round the colour wheel and two documents share a colour only once every ink
is in use. Nothing reassigns an ink after that: not deletes, not edits.
"""
from __future__ import annotations

from collections import Counter
from typing import Iterable, Optional

from sqlalchemy.orm import Session

# Keep in step with DOC_INKS in apps/webapp/src/data/inks.js.
INK_COUNT = 17


def next_ink(used: Iterable[Optional[int]]) -> int:
    """The least-used ink index, lowest index on a tie."""
    counts = Counter(i for i in used if i is not None and 0 <= i < INK_COUNT)
    return min(range(INK_COUNT), key=lambda i: (counts[i], i))


def assign_ink(db: Session) -> int:
    """The ink for a document about to be created."""
    from .models import PDFFile

    return next_ink(row[0] for row in db.query(PDFFile.ink).all())


def backfill_inks(db: Session) -> int:
    """Give every document without an ink one, in upload order.

    Returns how many rows changed. Idempotent: rows that have an ink keep it.
    """
    from .models import PDFFile

    used = [row[0] for row in db.query(PDFFile.ink).filter(PDFFile.ink.isnot(None)).all()]
    missing = db.query(PDFFile).filter(PDFFile.ink.is_(None)).order_by(PDFFile.id).all()
    for f in missing:
        f.ink = next_ink(used)
        used.append(f.ink)
    if missing:
        db.commit()
    return len(missing)
