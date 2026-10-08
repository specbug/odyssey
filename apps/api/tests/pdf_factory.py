"""Build small, valid PDFs with a real text layer for tests.

pypdf can't author text, and adding reportlab for a handful of fixtures is
overkill, so this writes the bytes by hand: one Helvetica content stream per
page, with a correct xref table so pypdf parses it without repair warnings.
"""
from __future__ import annotations

from typing import Optional


def _escape(s: str) -> str:
    return s.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def make_pdf(pages: list[list[str]], info: Optional[dict[str, str]] = None) -> bytes:
    """`pages` is a list of pages, each a list of text lines. An empty list
    makes a page with no text layer (stands in for a scanned page)."""
    objects: list[bytes] = []

    def add(body: bytes) -> int:
        objects.append(body)
        return len(objects)

    catalog_id = add(b"")  # patched once the pages tree id is known
    pages_id = add(b"")
    font_id = add(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")

    page_ids = []
    for lines in pages:
        ops = ["BT", "/F1 12 Tf", "14 TL", "72 720 Td"]
        for line in lines:
            ops.append(f"({_escape(line)}) Tj T*")
        ops.append("ET")
        stream = "\n".join(ops).encode("latin-1")
        content_id = add(
            b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream"
        )
        page_ids.append(add(
            (
                f"<< /Type /Page /Parent {pages_id} 0 R /MediaBox [0 0 612 792] "
                f"/Resources << /Font << /F1 {font_id} 0 R >> >> "
                f"/Contents {content_id} 0 R >>"
            ).encode()
        ))

    kids = " ".join(f"{i} 0 R" for i in page_ids)
    objects[pages_id - 1] = (
        f"<< /Type /Pages /Kids [{kids}] /Count {len(page_ids)} >>".encode()
    )
    objects[catalog_id - 1] = f"<< /Type /Catalog /Pages {pages_id} 0 R >>".encode()

    info_id = None
    if info:
        entries = " ".join(f"/{k} ({_escape(v)})" for k, v in info.items())
        info_id = add(f"<< {entries} >>".encode("latin-1"))

    out = bytearray(b"%PDF-1.4\n")
    offsets = []
    for n, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out += f"{n} 0 obj\n".encode() + body + b"\nendobj\n"
    xref_at = len(out)
    out += f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode()
    for off in offsets:
        out += f"{off:010d} 00000 n \n".encode()
    trailer = f"<< /Size {len(objects) + 1} /Root {catalog_id} 0 R"
    if info_id:
        trailer += f" /Info {info_id} 0 R"
    trailer += " >>"
    out += f"trailer\n{trailer}\nstartxref\n{xref_at}\n%%EOF\n".encode()
    return bytes(out)


ARTICLE_PAGES = [
    [
        "Aug 18, 2026",
        "Git at any scale",
        "Vicent Marti - 27 min read",
        "Hosting Git repositories at scale is a different problem from using Git.",
        "This post walks through how we store and replicate millions of repos.",
    ],
    ["Chapter one continues with more body text about packfiles and replicas."],
]
