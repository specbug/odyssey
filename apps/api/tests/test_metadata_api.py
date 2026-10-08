"""API-level tests for metadata enrichment: upload, the pdfjs PATCH, refresh.

The precedence contract under test: LLM values beat the webapp's pdfjs
heuristics regardless of which write lands first, and the pdfjs pass (sent
with `fill_only`) never overwrites anything.
"""
import functools
import json

import httpx
import pytest

from app import main, meta_ai
from tests.pdf_factory import ARTICLE_PAGES, make_pdf


LLM = {
    "title": "Git at any scale",
    "author": "Vicent Martí",
    "excerpt": "Hosting Git repositories at scale is a different problem from using Git.",
}
PDFJS = {
    "author": None,
    "color_hue": 120,
    "excerpt": "Aug 18, 2026 Git at any scale Vicent Martí · 27 min read Hosting Git…",
}

_seq = iter(range(10_000))


def unique_pdf():
    # Uploads dedupe on content hash, so every test needs distinct bytes.
    n = next(_seq)
    return make_pdf(ARTICLE_PAGES + [[f"unique filler {n}"]])


class LLMStub:
    def __init__(self, result=LLM):
        self.result = result
        self.calls = 0

    def __call__(self, pdf_bytes):
        self.calls += 1
        assert pdf_bytes.startswith(b"%PDF")
        return dict(self.result) if self.result else self.result


@pytest.fixture
def llm(monkeypatch):
    monkeypatch.setenv("META_API_KEY", "sk-test")
    stub = LLMStub()
    monkeypatch.setattr(meta_ai, "extract_pdf_metadata", stub)
    return stub


@pytest.fixture
def no_llm(monkeypatch):
    monkeypatch.delenv("META_API_KEY", raising=False)

    def boom(_):
        raise AssertionError("LLM must not be called without a key")

    monkeypatch.setattr(meta_ai, "extract_pdf_metadata", boom)


def upload(client, data=None, name="git-at-any-scale.pdf"):
    resp = client.post(
        "/upload",
        files={"file": (name, data or unique_pdf(), "application/pdf")},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


def get_file(client, file_id):
    files = {f["id"]: f for f in client.get("/files").json()}
    return files[file_id]


def patch_meta(client, file_id, body):
    resp = client.patch(f"/files/{file_id}/metadata", json=body)
    assert resp.status_code == 200, resp.text
    return resp.json()


# ─── Upload ─────────────────────────────────────────────────────────────

def test_upload_enriches_in_background(client, llm):
    res = upload(client)
    assert res["is_duplicate"] is False
    f = get_file(client, res["file_data"]["id"])
    assert (f["title"], f["author"], f["excerpt"]) == (
        LLM["title"], LLM["author"], LLM["excerpt"],
    )
    assert f["display_name"] == LLM["title"]
    assert llm.calls == 1


def test_upload_without_key_does_not_call_llm(client, no_llm):
    res = upload(client)
    f = get_file(client, res["file_data"]["id"])
    assert f["author"] is None and f["excerpt"] is None
    assert f["display_name"] == "git-at-any-scale"


def test_duplicate_upload_does_not_re_enrich(client, llm):
    data = unique_pdf()
    upload(client, data)
    res = upload(client, data)
    assert res["is_duplicate"] is True
    assert llm.calls == 1


def test_upload_survives_llm_failure(client, llm):
    llm.result = None
    res = upload(client)
    f = get_file(client, res["file_data"]["id"])
    assert f["title"] is None and f["author"] is None


# ─── Precedence: LLM vs the webapp's pdfjs pass ─────────────────────────

def test_pdfjs_landing_after_llm_does_not_clobber(client, llm):
    file_id = upload(client)["file_data"]["id"]  # LLM ran during upload
    out = patch_meta(client, file_id, {**PDFJS, "author": "Info-dict Author",
                                       "fill_only": True})
    assert out["author"] == LLM["author"]
    assert out["excerpt"] == LLM["excerpt"]
    assert out["color_hue"] == 120  # still fills what the LLM doesn't set


def test_llm_landing_after_pdfjs_overwrites_heuristics(client, no_llm, monkeypatch):
    file_id = upload(client)["file_data"]["id"]
    patch_meta(client, file_id, {**PDFJS, "author": "Info-dict Author",
                                 "fill_only": True})
    monkeypatch.setenv("META_API_KEY", "sk-test")
    monkeypatch.setattr(meta_ai, "extract_pdf_metadata", LLMStub())
    main._enrich_file_metadata_task(file_id, unique_pdf())
    f = get_file(client, file_id)
    assert f["author"] == LLM["author"]
    assert f["excerpt"] == LLM["excerpt"]
    assert f["color_hue"] == 120


def test_llm_null_field_keeps_pdfjs_fallback(client, no_llm, monkeypatch):
    file_id = upload(client)["file_data"]["id"]
    patch_meta(client, file_id, {**PDFJS, "author": "Info-dict Author",
                                 "fill_only": True})
    monkeypatch.setenv("META_API_KEY", "sk-test")
    monkeypatch.setattr(meta_ai, "extract_pdf_metadata",
                        LLMStub({**LLM, "author": None}))
    main._enrich_file_metadata_task(file_id, unique_pdf())
    f = get_file(client, file_id)
    assert f["author"] == "Info-dict Author"
    assert f["excerpt"] == LLM["excerpt"]


def test_enrich_task_tolerates_deleted_file(client, llm):
    main._enrich_file_metadata_task(999_999, unique_pdf())  # must not raise


# ─── PATCH semantics ────────────────────────────────────────────────────

def test_fill_only_fills_empty_fields(client, no_llm):
    file_id = upload(client)["file_data"]["id"]
    out = patch_meta(client, file_id, {**PDFJS, "fill_only": True})
    assert out["excerpt"] == PDFJS["excerpt"]
    assert out["color_hue"] == 120
    assert out["author"] is None


def test_plain_patch_still_overwrites(client, llm):
    file_id = upload(client)["file_data"]["id"]
    out = patch_meta(client, file_id, {"author": "Edited By Hand"})
    assert out["author"] == "Edited By Hand"
    assert out["title"] == LLM["title"]  # untouched fields stay


def test_patch_rejects_out_of_range_hue(client, no_llm):
    # Regression: the 422 handler used to re-read the request body and hang.
    file_id = upload(client)["file_data"]["id"]
    resp = client.patch(f"/files/{file_id}/metadata", json={"color_hue": 999})
    assert resp.status_code == 422
    assert resp.json()["body"] == {"color_hue": 999}


def test_upload_without_file_field_is_422_not_500(client, no_llm):
    # Regression: the 422 handler echoed the multipart body (FormData with
    # UploadFile objects) into a JSONResponse, which raised → 500.
    resp = client.post(
        "/upload", files={"wrong": ("a.pdf", b"%PDF-1.4", "application/pdf")},
    )
    assert resp.status_code == 422
    assert resp.json()["body"] is None
    assert resp.json()["detail"][0]["loc"] == ["body", "file"]


def test_patch_missing_file_404(client):
    resp = client.patch("/files/999999/metadata", json={"author": "x"})
    assert resp.status_code == 404


# ─── Bulk refresh ───────────────────────────────────────────────────────

def test_refresh_503_without_key(client, no_llm):
    resp = client.post("/library/refresh-metadata")
    assert resp.status_code == 503
    assert "META_API_KEY" in resp.json()["detail"]


def test_refresh_fills_nulls_only_by_default(client, no_llm, monkeypatch):
    junk_id = upload(client)["file_data"]["id"]
    patch_meta(client, junk_id, {**PDFJS, "fill_only": True})
    done_id = upload(client)["file_data"]["id"]
    patch_meta(client, done_id, {"title": "T", "author": "A", "excerpt": "E"})

    monkeypatch.setenv("META_API_KEY", "sk-test")
    stub = LLMStub()
    monkeypatch.setattr(meta_ai, "extract_pdf_metadata", stub)
    body = client.post("/library/refresh-metadata").json()
    assert body["force"] is False
    assert body["queued"] == 1 and body["skipped"] == 1

    junk = get_file(client, junk_id)
    assert junk["author"] == LLM["author"] and junk["title"] == LLM["title"]
    assert junk["excerpt"] == PDFJS["excerpt"]  # non-null: left for force
    assert get_file(client, done_id)["author"] == "A"


def test_refresh_force_overwrites(client, no_llm, monkeypatch):
    file_id = upload(client)["file_data"]["id"]
    patch_meta(client, file_id, {"title": "T", "author": "A", "excerpt": "E"})
    monkeypatch.setenv("META_API_KEY", "sk-test")
    monkeypatch.setattr(meta_ai, "extract_pdf_metadata",
                        LLMStub({**LLM, "excerpt": None}))
    body = client.post("/library/refresh-metadata?force=true").json()
    assert body["queued"] == 1
    f = get_file(client, file_id)
    assert (f["title"], f["author"]) == (LLM["title"], LLM["author"])
    assert f["excerpt"] == "E"  # LLM returned nothing → keep what's there


# ─── End to end through the real client and a fake Meta server ──────────

def test_end_to_end_with_fake_meta_server(client, monkeypatch):
    seen = []

    def handler(request):
        seen.append(json.loads(request.content))
        return httpx.Response(200, json={"choices": [{
            "message": {"role": "assistant", "content": json.dumps(LLM)},
            "finish_reason": "stop",
        }]})

    monkeypatch.setenv("META_API_KEY", "sk-test")
    monkeypatch.setattr(
        meta_ai, "extract_pdf_metadata",
        functools.partial(meta_ai.extract_pdf_metadata,
                          transport=httpx.MockTransport(handler)),
    )
    file_id = upload(client)["file_data"]["id"]
    patch_meta(client, file_id, {**PDFJS, "fill_only": True})

    f = get_file(client, file_id)
    assert (f["title"], f["author"], f["excerpt"]) == (
        LLM["title"], LLM["author"], LLM["excerpt"],
    )
    assert len(seen) == 1
    assert "Vicent Marti - 27 min read" in seen[0]["messages"][1]["content"]
