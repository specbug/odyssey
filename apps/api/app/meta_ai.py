"""Meta Model API-backed metadata extraction for uploaded PDFs.

Takes the raw bytes of a PDF and asks a Muse Spark model for `title`, `author`,
and a short `excerpt`. Defaults to the Contributor tier
(`muse-spark-1.3-contributor`), which costs ~$0.10 / $0.20 per million
input / output tokens in exchange for Meta being allowed to train on the
prompts and completions — i.e. on the opening pages of every PDF uploaded.
Set META_MODEL=muse-spark-1.3 for the Standard tier if that trade is wrong.

The API is OpenAI-compatible Chat Completions and takes text and images, not
PDFs. So the PDF's text layer is extracted locally with pypdf (first
PAGE_SLICE_LIMIT pages, capped at MAX_PROMPT_CHARS) and only that text is
sent — a few thousand tokens per document, a fraction of a cent per call.
A PDF with no text layer (a scan) can't be enriched this way and is skipped.

Module is a no-op when META_API_KEY is not set — callers should treat
`extract_pdf_metadata` returning None as "enrichment skipped" and carry on.
"""
from __future__ import annotations

import io
import json
import os
import time
from typing import Callable, Optional, TypedDict

import httpx
from pypdf import PdfReader


API_KEY_ENV = "META_API_KEY"
MODEL_ENV = "META_MODEL"
BASE_URL_ENV = "META_BASE_URL"

DEFAULT_MODEL = "muse-spark-1.3-contributor"
DEFAULT_BASE_URL = "https://api.meta.ai/v1"

# Title / author / opening excerpt all live at the front of a document.
PAGE_SLICE_LIMIT = 10

# ~6k tokens of document text. Enough to get past a book's cover, copyright
# page and table of contents to its opening; caps the cost of a dense page.
MAX_PROMPT_CHARS = 24_000

# Below this much extracted text the PDF is effectively image-only (a scan,
# or slides rendered to bitmaps). Sending it would only invite a hallucinated
# title, so we skip and leave the row to the pdfjs fallback.
MIN_TEXT_CHARS = 40

# Muse Spark is a reasoning model and reasoning tokens count against this
# budget. "minimal" effort keeps them small; the answer itself is ~100 tokens.
MAX_COMPLETION_TOKENS = 1024
REASONING_EFFORT = "minimal"

REQUEST_TIMEOUT_S = 60.0

# Contributor tier is rate-limited per team (requests per minute). A bulk
# refresh runs one request at a time, but a 429 is still possible, and 5xx /
# dropped connections happen. Retry those a few times; anything else is a
# real error and retrying won't change the answer.
MAX_ATTEMPTS = 3
RETRY_STATUSES = {408, 429, 500, 502, 503, 504}
MAX_BACKOFF_S = 30.0

_SYSTEM_PROMPT = (
    "You extract bibliographic metadata from the text of a document (book, "
    "paper, article, blog post saved as PDF, or similar). You are given the "
    "text layer of its first pages, with page markers. Reply with JSON only."
)

_USER_PROMPT = (
    "Return a JSON object with exactly these keys:\n"
    "  - title: the proper title of the work as it appears on the cover, title "
    "page or article headline. NOT a filename. Include a subtitle if present, "
    "joined with ': '. Empty string if you cannot determine it.\n"
    "  - author: the primary author(s) — from the title page, byline, or "
    "masthead. If several, join with ', '. Names only: no 'by', no "
    "affiliations, no dates. Empty string if unknown.\n"
    "  - excerpt: the first one or two sentences of the substantive opening "
    "passage, copied verbatim (about 200 characters). Skip covers, copyright, "
    "tables of contents, acknowledgements, and page chrome such as dates, "
    "bylines, 'N min read', navigation, and headers. Empty string if there is "
    "no real prose.\n"
)

_RESPONSE_FORMAT = {
    "type": "json_schema",
    "json_schema": {
        "name": "pdf_metadata",
        "strict": True,
        "schema": {
            "type": "object",
            "properties": {
                "title": {"type": "string"},
                "author": {"type": "string"},
                "excerpt": {"type": "string"},
            },
            "required": ["title", "author", "excerpt"],
            "additionalProperties": False,
        },
    },
}


class ExtractedMetadata(TypedDict, total=False):
    title: Optional[str]
    author: Optional[str]
    excerpt: Optional[str]


def is_configured() -> bool:
    """True iff a Meta Model API key is set in the environment."""
    return bool(os.getenv(API_KEY_ENV))


def _prepare_text(pdf_bytes: bytes) -> tuple[str, dict[str, str]]:
    """Pull the text of the first PAGE_SLICE_LIMIT pages and the info dict.

    Returns (text, info). `text` carries `[page N]` markers so the model can
    tell a title page from body text, and is capped at MAX_PROMPT_CHARS.
    Returns ("", {}) if pypdf can't open the file at all; a single page whose
    text can't be extracted is skipped rather than failing the document.
    """
    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))
    except Exception as e:
        print(f"⚠️  Meta: pypdf could not open PDF ({type(e).__name__}: {e}).")
        return "", {}

    info: dict[str, str] = {}
    try:
        for key, value in (reader.metadata or {}).items():
            if value is None:
                continue
            s = " ".join(str(value).split())
            if s:
                info[str(key).lstrip("/")] = s
    except Exception:
        info = {}

    chunks: list[str] = []
    used = 0
    try:
        pages = reader.pages[:PAGE_SLICE_LIMIT]
    except Exception:
        pages = []
    for i, page in enumerate(pages, start=1):
        try:
            raw = page.extract_text() or ""
        except Exception:
            continue
        # Collapse whitespace within a line but keep the line breaks: they're
        # what separates a headline from a byline from a date, and flattening
        # them is how a raw text scrape ends up as "Aug 18, 2026 Git at any
        # scale Vicent Martí · 27 min read …".
        page_text = "\n".join(
            " ".join(line.split()) for line in raw.splitlines() if line.strip()
        )
        if not page_text:
            continue
        chunk = f"[page {i}]\n{page_text}"
        room = MAX_PROMPT_CHARS - used
        if room <= 0:
            break
        chunks.append(chunk[:room])
        used += len(chunks[-1]) + 2
    return "\n\n".join(chunks), info


def _build_payload(text: str, info: dict[str, str], model: str) -> dict:
    prompt = _USER_PROMPT
    if info:
        prompt += (
            "\nThe PDF's own embedded metadata is below. Authoring tools "
            "frequently leave stale or junk values here (e.g. "
            '"Microsoft Word - draft.docx"), so treat it as a hint only — the '
            "document text is authoritative.\n"
            f"{json.dumps(info, ensure_ascii=False, sort_keys=True)}\n"
        )
    prompt += f"\nDocument text:\n<document>\n{text}\n</document>"
    return {
        "model": model,
        "messages": [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        "response_format": _RESPONSE_FORMAT,
        "reasoning_effort": REASONING_EFFORT,
        "max_completion_tokens": MAX_COMPLETION_TOKENS,
    }


def _retry_delay(resp: Optional[httpx.Response], attempt: int) -> float:
    if resp is not None:
        retry_after = resp.headers.get("retry-after")
        if retry_after:
            try:
                return min(max(float(retry_after), 0.0), MAX_BACKOFF_S)
            except ValueError:
                pass
    return min(2.0 ** attempt, MAX_BACKOFF_S)


def _post_with_retries(
    url: str,
    payload: dict,
    api_key: str,
    *,
    transport: Optional[httpx.BaseTransport],
    sleep: Callable[[float], None],
) -> Optional[dict]:
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    with httpx.Client(timeout=REQUEST_TIMEOUT_S, transport=transport) as client:
        for attempt in range(1, MAX_ATTEMPTS + 1):
            resp: Optional[httpx.Response] = None
            try:
                resp = client.post(url, json=payload, headers=headers)
            except httpx.TransportError as e:
                msg = str(e).replace(api_key, "<redacted>")
                print(f"⚠️  Meta request failed (attempt {attempt}): {type(e).__name__}: {msg}")
            else:
                if resp.status_code < 400:
                    try:
                        return resp.json()
                    except ValueError:
                        print(f"⚠️  Meta returned non-JSON body (status={resp.status_code}).")
                        return None
                body = resp.text[:500].replace(api_key, "<redacted>")
                print(
                    f"⚠️  Meta request failed (attempt {attempt}, "
                    f"status={resp.status_code}): {body}"
                )
                if resp.status_code not in RETRY_STATUSES:
                    return None
            if attempt < MAX_ATTEMPTS:
                sleep(_retry_delay(resp, attempt))
    return None


def _parse_content(data: dict) -> Optional[dict]:
    try:
        choice = data["choices"][0]
        content = choice["message"]["content"]
    except (KeyError, IndexError, TypeError) as e:
        print(f"⚠️  Meta response missing content ({e}); payload={data!r:.500}")
        return None
    if isinstance(content, list):
        # Some OpenAI-compatible servers return content as typed parts.
        content = "".join(
            p.get("text", "") for p in content if isinstance(p, dict)
        )
    if not isinstance(content, str) or not content.strip():
        reason = choice.get("finish_reason") if isinstance(choice, dict) else None
        print(f"⚠️  Meta returned empty content (finish_reason={reason}).")
        return None
    text = content.strip()
    # Structured output should make this plain JSON, but tolerate a fenced
    # block in case the schema was ignored.
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:]
    try:
        parsed = json.loads(text)
    except ValueError as e:
        print(f"⚠️  Meta response was not JSON ({e}): {content[:300]!r}")
        return None
    if not isinstance(parsed, dict):
        print(f"⚠️  Meta response JSON was not an object: {content[:300]!r}")
        return None
    return parsed


def extract_pdf_metadata(
    pdf_bytes: bytes,
    *,
    transport: Optional[httpx.BaseTransport] = None,
    sleep: Callable[[float], None] = time.sleep,
) -> Optional[ExtractedMetadata]:
    """Ask the Meta Model API for {title, author, excerpt} from a PDF's bytes.

    Returns None if the API key is unset, the PDF has no usable text layer,
    or the request fails after retries. Callers should treat None as "no
    enrichment available" — never raises. `transport` and `sleep` exist so
    tests can stub the network and the backoff.
    """
    api_key = os.getenv(API_KEY_ENV)
    if not api_key:
        return None

    text, info = _prepare_text(pdf_bytes)
    if len(text) < MIN_TEXT_CHARS:
        print(
            f"⚠️  Meta: skipping enrichment — only {len(text)} chars of text in "
            f"the first {PAGE_SLICE_LIMIT} pages (scanned / image-only PDF?)."
        )
        return None

    model = os.getenv(MODEL_ENV) or DEFAULT_MODEL
    base_url = (os.getenv(BASE_URL_ENV) or DEFAULT_BASE_URL).rstrip("/")
    payload = _build_payload(text, info, model)

    data = _post_with_retries(
        f"{base_url}/chat/completions", payload, api_key,
        transport=transport, sleep=sleep,
    )
    if data is None:
        return None
    parsed = _parse_content(data)
    if parsed is None:
        return None

    return {
        "title": _clean(parsed.get("title")),
        "author": _clean(parsed.get("author")),
        "excerpt": _clean(parsed.get("excerpt"), max_len=240),
    }


def _clean(value, max_len: Optional[int] = None) -> Optional[str]:
    if value is None:
        return None
    s = " ".join(str(value).split())
    if not s or s.lower() in {"null", "none", "unknown", "n/a", "-", "—"}:
        return None
    if max_len is not None and len(s) > max_len:
        s = s[: max_len - 1].rstrip() + "…"
    return s
