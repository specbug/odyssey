"""Gemini-backed metadata extraction for uploaded PDFs.

Takes the raw bytes of a PDF and asks Gemini for `title`, `author`, and a short
`excerpt`. Designed to stay inside the free tier of the Generative Language
API (`gemini-2.0-flash` by default, configurable via GEMINI_MODEL).

Module is a no-op when GEMINI_API_KEY is not set — callers should treat
`extract_pdf_metadata` returning None as "enrichment skipped" and carry on.
"""
from __future__ import annotations

import base64
import io
import json
import os
from typing import Optional, TypedDict

import httpx
from pypdf import PdfReader, PdfWriter


GEMINI_API_KEY_ENV = "GEMINI_API_KEY"

# Free-tier friendly default. 2.5-flash has a separate daily quota from 2.0
# and returned cleaner title/author extraction in our testing. Override via
# GEMINI_MODEL to switch to flash-lite, 2.0-flash, or a paid model.
DEFAULT_MODEL = "gemini-2.5-flash"

# Gemini accepts inline data up to ~20MB per request. We clamp a little lower
# to leave room for the prompt + base64 overhead (~33%). The slice path
# almost always produces a file well under this, but we keep the check as a
# safety net for PDFs whose first 10 pages are themselves enormous (scans).
MAX_INLINE_BYTES = 14 * 1024 * 1024

# Title / author / opening excerpt all live at the front of a document.
# Slicing off the rest cuts the payload from tens of MB to ~hundreds of KB
# without losing the signal Gemini needs.
PAGE_SLICE_LIMIT = 10

_ENDPOINT_TMPL = (
    "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
)

_PROMPT = (
    "You are extracting bibliographic metadata from a document (book, paper, "
    "article, or similar). You are given only the first pages of the PDF — "
    "enough to cover cover, title page, and opening. Return a single JSON "
    "object with exactly these keys:\n"
    "  - title: the proper title of the work as it would appear on the cover "
    "or title page. NOT the filename. Include subtitle if present, joined with "
    "': '. Use null if you cannot determine it.\n"
    "  - author: the primary author(s). If multiple, join with ', '. Use null "
    "if unknown.\n"
    "  - excerpt: roughly the first 200 characters of the substantive opening "
    "passage (skip cover pages, copyright, table of contents, acknowledgements). "
    "Whitespace-collapsed. Use null if no meaningful opening passage is present.\n"
    "Do not wrap in markdown. Output only the JSON object."
)


class ExtractedMetadata(TypedDict, total=False):
    title: Optional[str]
    author: Optional[str]
    excerpt: Optional[str]


def is_configured() -> bool:
    """True iff a Gemini API key is set in the environment."""
    return bool(os.getenv(GEMINI_API_KEY_ENV))


def _prepare_payload(pdf_bytes: bytes) -> tuple[bytes, dict[str, str]]:
    """Slice a PDF to the first PAGE_SLICE_LIMIT pages and pull its info dict.

    Returns (bytes_to_send, info_dict). Falls back to the original bytes if
    pypdf can't parse or rewrite the file — the caller will then rely on the
    MAX_INLINE_BYTES check to decide whether to attempt a send.
    """
    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))
        info: dict[str, str] = {}
        if reader.metadata:
            for key, value in reader.metadata.items():
                if value is None:
                    continue
                try:
                    s = str(value).strip()
                except Exception:
                    continue
                if not s:
                    continue
                info[str(key).lstrip("/")] = s

        writer = PdfWriter()
        total = len(reader.pages)
        for i in range(min(PAGE_SLICE_LIMIT, total)):
            writer.add_page(reader.pages[i])
        buf = io.BytesIO()
        writer.write(buf)
        return buf.getvalue(), info
    except Exception as e:
        print(
            f"⚠️  Gemini: pypdf slice failed ({type(e).__name__}: {e}); "
            f"falling back to full file ({len(pdf_bytes)} bytes)."
        )
        return pdf_bytes, {}


def extract_pdf_metadata(pdf_bytes: bytes) -> Optional[ExtractedMetadata]:
    """Ask Gemini for {title, author, excerpt} from a PDF's raw bytes.

    The PDF is sliced to the first PAGE_SLICE_LIMIT pages before upload —
    everything we want lives there, and a full multi-MB body is wasted tokens
    and often pushes us past the inline cap. The PDF's own info dict is
    passed alongside as a hint (authoring tools often lie, so the prompt
    tells Gemini to treat the title page as authoritative).

    Returns None if the API key is unset, the slice is still too large for
    inline transport, or the request fails. Callers should treat None as
    "no enrichment available" — never raise.
    """
    api_key = os.getenv(GEMINI_API_KEY_ENV)
    if not api_key:
        return None

    send_bytes, info = _prepare_payload(pdf_bytes)
    if len(send_bytes) > MAX_INLINE_BYTES:
        print(
            f"⚠️  Gemini: skipping enrichment — payload is {len(send_bytes)} bytes, "
            f"above the inline cap of {MAX_INLINE_BYTES} even after slicing."
        )
        return None

    model = os.getenv("GEMINI_MODEL", DEFAULT_MODEL)
    url = _ENDPOINT_TMPL.format(model=model)

    prompt = _PROMPT
    if info:
        prompt += (
            "\n\nThe PDF's own embedded metadata is below. Authoring tools "
            "frequently leave stale / junk values here (e.g. "
            '"Microsoft Word - draft.docx"), so use it only as a hint — '
            "the title page is authoritative.\n"
            f"{json.dumps(info, ensure_ascii=False, sort_keys=True)}"
        )

    payload = {
        "contents": [
            {
                "parts": [
                    {
                        "inlineData": {
                            "mimeType": "application/pdf",
                            "data": base64.b64encode(send_bytes).decode("ascii"),
                        }
                    },
                    {"text": prompt},
                ]
            }
        ],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.1,
        },
    }

    try:
        with httpx.Client(timeout=90.0) as client:
            resp = client.post(
                url,
                params={"key": api_key},
                json=payload,
                headers={"Content-Type": "application/json"},
            )
        resp.raise_for_status()
        data = resp.json()
    except httpx.HTTPError as e:
        # httpx formats the full URL (including ?key=...) into its exception
        # messages. Scrub it before logging so the API key never lands in pod
        # logs.
        msg = str(e).replace(api_key, "<redacted>")
        status = getattr(getattr(e, "response", None), "status_code", None)
        print(f"⚠️  Gemini request failed (status={status}): {msg}")
        return None

    try:
        text = data["candidates"][0]["content"]["parts"][0]["text"]
        parsed = json.loads(text)
    except (KeyError, IndexError, ValueError, TypeError) as e:
        print(f"⚠️  Gemini response parse failed: {e}; payload={data!r}")
        return None

    return {
        "title": _clean(parsed.get("title")),
        "author": _clean(parsed.get("author")),
        "excerpt": _clean(parsed.get("excerpt"), max_len=240),
    }


def _clean(value, max_len: Optional[int] = None) -> Optional[str]:
    if value is None:
        return None
    s = str(value).strip()
    if not s or s.lower() in {"null", "none", "unknown", "n/a"}:
        return None
    # Collapse internal whitespace; Gemini sometimes leaves \n from the PDF.
    s = " ".join(s.split())
    if max_len is not None and len(s) > max_len:
        s = s[: max_len - 1].rstrip() + "…"
    return s
