"""Document inks: assigned once on upload, spread round the wheel, never changed."""
from app import inks
from tests.pdf_factory import make_pdf


def _upload(client, name, text):
    r = client.post("/upload", files={"file": (name, make_pdf([[text]]), "application/pdf")})
    assert r.status_code == 200, r.text
    return r.json()["file_data"]


def test_next_ink_takes_the_least_used_lowest_first():
    assert inks.next_ink([]) == 0
    assert inks.next_ink([0, 1, 2]) == 3
    assert inks.next_ink([0, 0, 1]) == 2
    # Every ink used once: start again from the lowest.
    assert inks.next_ink(range(inks.INK_COUNT)) == 0
    # A gap left by a deleted document is filled first.
    assert inks.next_ink([i for i in range(inks.INK_COUNT) if i != 5]) == 5
    # Nulls and out-of-range values are ignored.
    assert inks.next_ink([None, -1, 99, 0]) == 1


def test_uploads_get_distinct_inks(client):
    a = _upload(client, "a.pdf", "first document")
    b = _upload(client, "b.pdf", "second document")
    assert a["ink"] is not None and b["ink"] is not None
    assert a["ink"] != b["ink"]


def test_duplicate_upload_keeps_its_ink(client):
    a = _upload(client, "a.pdf", "same bytes")
    again = client.post("/upload", files={"file": ("renamed.pdf", make_pdf([["same bytes"]]), "application/pdf")}).json()
    assert again["is_duplicate"] is True
    assert again["file_data"]["ink"] == a["ink"]


def test_metadata_patch_cannot_change_ink(client):
    a = _upload(client, "a.pdf", "fixed colour")
    r = client.patch(f"/files/{a['id']}/metadata", json={"title": "Renamed", "ink": (a["ink"] + 1) % inks.INK_COUNT})
    assert r.status_code == 200
    assert r.json()["ink"] == a["ink"]
    assert client.get(f"/files/{a['id']}").json()["ink"] == a["ink"]


def test_notes_carry_their_documents_ink(client):
    a = _upload(client, "a.pdf", "notes inherit")
    client.post(f"/files/{a['id']}/annotations", json={"annotation_id": "x", "page_index": 0, "question": "Q", "answer": "A"})
    rows = [n for n in client.get("/annotations").json() if n["file_id"] == a["id"]]
    assert rows and all(n["file_ink"] == a["ink"] for n in rows)


def test_backfill_gives_old_rows_an_ink_in_upload_order(client):
    from app.database import SessionLocal
    from app.models import PDFFile

    ids = [_upload(client, f"{n}.pdf", f"old document {n}")["id"] for n in range(3)]
    db = SessionLocal()
    try:
        for f in db.query(PDFFile).filter(PDFFile.id.in_(ids)):
            f.ink = None
        db.commit()
        assert inks.backfill_inks(db) == 3
        got = [db.get(PDFFile, i).ink for i in ids]
        assert got == sorted(got) and len(set(got)) == 3
        # Idempotent: a second pass changes nothing.
        assert inks.backfill_inks(db) == 0
    finally:
        db.close()
