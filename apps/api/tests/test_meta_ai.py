"""Unit tests for app.meta_ai against a fake Meta Model API server."""
import json

import httpx
import pytest

from app import meta_ai
from tests.pdf_factory import ARTICLE_PAGES, make_pdf


KEY = "sk-test-not-a-real-key"
ARTICLE = make_pdf(ARTICLE_PAGES, info={"Title": "Microsoft Word - draft.docx"})


@pytest.fixture(autouse=True)
def _env(monkeypatch):
    monkeypatch.setenv(meta_ai.API_KEY_ENV, KEY)
    monkeypatch.delenv(meta_ai.MODEL_ENV, raising=False)
    monkeypatch.delenv(meta_ai.BASE_URL_ENV, raising=False)


def completion(content, finish_reason="stop"):
    return {
        "id": "chatcmpl-1",
        "object": "chat.completion",
        "choices": [{
            "index": 0,
            "message": {"role": "assistant", "content": content},
            "finish_reason": finish_reason,
        }],
    }


GOOD = completion(json.dumps({
    "title": "Git at any scale",
    "author": "Vicent Martí",
    "excerpt": "Hosting Git repositories at scale is a different problem from using Git.",
}))


class FakeServer:
    """Replays a scripted sequence of responses and records every request."""

    def __init__(self, *responses):
        self.responses = list(responses)
        self.requests: list[httpx.Request] = []
        self.sleeps: list[float] = []

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        nxt = self.responses.pop(0)
        if isinstance(nxt, Exception):
            raise nxt
        if isinstance(nxt, httpx.Response):
            return nxt
        return httpx.Response(200, json=nxt)

    def run(self, pdf_bytes=ARTICLE):
        return meta_ai.extract_pdf_metadata(
            pdf_bytes,
            transport=httpx.MockTransport(self.handler),
            sleep=self.sleeps.append,
        )

    def body(self, i=0):
        return json.loads(self.requests[i].content)


# ─── Happy path & request shape ─────────────────────────────────────────

def test_extracts_and_cleans_metadata():
    srv = FakeServer(GOOD)
    assert srv.run() == {
        "title": "Git at any scale",
        "author": "Vicent Martí",
        "excerpt": "Hosting Git repositories at scale is a different problem from using Git.",
    }
    assert len(srv.requests) == 1
    assert srv.sleeps == []


def test_request_is_openai_compatible_chat_completion():
    srv = FakeServer(GOOD)
    srv.run()
    req = srv.requests[0]
    assert req.method == "POST"
    assert str(req.url) == "https://api.meta.ai/v1/chat/completions"
    assert req.headers["authorization"] == f"Bearer {KEY}"
    # The key travels in the header only, never in the URL (where it would
    # end up in proxy and error logs).
    assert KEY not in str(req.url)

    body = srv.body()
    assert body["model"] == "muse-spark-1.3-contributor"
    assert body["reasoning_effort"] == "minimal"
    assert body["max_completion_tokens"] == meta_ai.MAX_COMPLETION_TOKENS
    # Parameters the docs say a reasoning model rejects with a 400.
    for rejected in ("stop", "n", "logprobs", "logit_bias", "temperature"):
        assert rejected not in body

    fmt = body["response_format"]
    assert fmt["type"] == "json_schema"
    schema = fmt["json_schema"]["schema"]
    assert schema["required"] == ["title", "author", "excerpt"]
    assert schema["additionalProperties"] is False


def test_prompt_carries_text_with_line_structure_and_info_hint():
    srv = FakeServer(GOOD)
    srv.run()
    user = srv.body()["messages"][1]["content"]
    assert "[page 1]\nAug 18, 2026\nGit at any scale\nVicent Marti - 27 min read" in user
    assert "[page 2]" in user
    assert "Microsoft Word - draft.docx" in user
    assert "hint only" in user


def test_no_info_hint_when_pdf_has_no_info_dict():
    srv = FakeServer(GOOD)
    srv.run(make_pdf(ARTICLE_PAGES))
    assert "embedded metadata" not in srv.body()["messages"][1]["content"]


def test_model_and_base_url_overrides(monkeypatch):
    monkeypatch.setenv(meta_ai.MODEL_ENV, "muse-spark-1.3")
    monkeypatch.setenv(meta_ai.BASE_URL_ENV, "https://proxy.example/v1/")
    srv = FakeServer(GOOD)
    srv.run()
    assert str(srv.requests[0].url) == "https://proxy.example/v1/chat/completions"
    assert srv.body()["model"] == "muse-spark-1.3"


def test_only_first_pages_are_sent_and_text_is_capped():
    long_line = "lorem ipsum dolor sit amet " * 40  # ~1.1k chars per line
    pages = [[f"PAGEMARK-{i}"] + [long_line] * 5 for i in range(1, 16)]
    srv = FakeServer(GOOD)
    srv.run(make_pdf(pages))
    user = srv.body()["messages"][1]["content"]
    doc = user.split("<document>\n", 1)[1].rsplit("\n</document>", 1)[0]
    assert len(doc) <= meta_ai.MAX_PROMPT_CHARS
    assert "PAGEMARK-1\n" in doc
    assert "PAGEMARK-11" not in doc


def test_page_limit_without_char_cap():
    pages = [[f"PAGEMARK-{i} short body text"] for i in range(1, 16)]
    srv = FakeServer(GOOD)
    srv.run(make_pdf(pages))
    user = srv.body()["messages"][1]["content"]
    assert f"PAGEMARK-{meta_ai.PAGE_SLICE_LIMIT} " in user
    assert f"PAGEMARK-{meta_ai.PAGE_SLICE_LIMIT + 1} " not in user


# ─── Skips that must not spend a request ────────────────────────────────

def test_noop_without_api_key(monkeypatch):
    monkeypatch.delenv(meta_ai.API_KEY_ENV)
    srv = FakeServer()
    assert srv.run() is None
    assert srv.requests == []
    assert meta_ai.is_configured() is False


def test_image_only_pdf_is_skipped():
    srv = FakeServer()
    assert srv.run(make_pdf([[], [], []])) is None
    assert srv.requests == []


def test_unparseable_pdf_is_skipped():
    srv = FakeServer()
    assert srv.run(b"definitely not a pdf") is None
    assert srv.requests == []


# ─── Retries ────────────────────────────────────────────────────────────

def test_retries_429_honouring_retry_after():
    srv = FakeServer(
        httpx.Response(429, headers={"retry-after": "7"}, json={"error": "rate"}),
        GOOD,
    )
    assert srv.run()["author"] == "Vicent Martí"
    assert len(srv.requests) == 2
    assert srv.sleeps == [7.0]


def test_retry_after_is_capped():
    srv = FakeServer(httpx.Response(429, headers={"retry-after": "3600"}), GOOD)
    srv.run()
    assert srv.sleeps == [meta_ai.MAX_BACKOFF_S]


def test_retries_5xx_with_backoff_then_gives_up():
    srv = FakeServer(*[httpx.Response(503, text="overloaded")] * meta_ai.MAX_ATTEMPTS)
    assert srv.run() is None
    assert len(srv.requests) == meta_ai.MAX_ATTEMPTS
    assert srv.sleeps == [2.0, 4.0]


def test_retries_transport_errors():
    srv = FakeServer(httpx.ConnectError("boom"), httpx.ReadTimeout("slow"), GOOD)
    assert srv.run()["title"] == "Git at any scale"
    assert len(srv.requests) == 3


@pytest.mark.parametrize("status", [400, 401, 403, 404, 422])
def test_client_errors_are_not_retried(status):
    srv = FakeServer(httpx.Response(status, json={"error": {"message": "nope"}}))
    assert srv.run() is None
    assert len(srv.requests) == 1
    assert srv.sleeps == []


@pytest.mark.parametrize("param,error", [
    ("reasoning_effort", "Unsupported parameter: 'reasoning_effort'"),
    ("response_format", "response_format.json_schema is not supported"),
])
def test_rejected_optional_param_is_dropped_and_resent(param, error):
    srv = FakeServer(
        httpx.Response(400, json={"error": {"message": error}}), GOOD,
    )
    assert srv.run()["author"] == "Vicent Martí"
    assert len(srv.requests) == 2
    assert param in srv.body(0)
    assert param not in srv.body(1)
    assert srv.sleeps == []


def test_both_optional_params_can_be_dropped():
    srv = FakeServer(
        httpx.Response(400, text="reasoning_effort: invalid value"),
        httpx.Response(400, text="json_schema not supported for this model"),
        GOOD,
    )
    assert srv.run()["title"] == "Git at any scale"
    body = srv.body(2)
    assert "reasoning_effort" not in body and "response_format" not in body


def test_unrelated_400_is_not_resent():
    srv = FakeServer(httpx.Response(400, text="messages: too long"))
    assert srv.run() is None
    assert len(srv.requests) == 1


def test_api_key_is_redacted_from_logs(capsys):
    srv = FakeServer(httpx.Response(401, text=f"invalid key {KEY}"))
    srv.run()
    out = capsys.readouterr().out
    assert KEY not in out
    assert "<redacted>" in out


# ─── Response parsing ───────────────────────────────────────────────────

def test_fenced_json_is_tolerated():
    content = '```json\n{"title": "T", "author": "A", "excerpt": "E e e"}\n```'
    assert FakeServer(completion(content)).run() == {
        "title": "T", "author": "A", "excerpt": "E e e",
    }


def test_content_as_typed_parts():
    parts = [{"type": "text", "text": '{"title": "T", '},
             {"type": "text", "text": '"author": "A", "excerpt": ""}'}]
    assert FakeServer(completion(parts)).run() == {
        "title": "T", "author": "A", "excerpt": None,
    }


@pytest.mark.parametrize("data", [
    completion("not json at all"),
    completion('["a", "list"]'),
    completion(""),
    completion(None, finish_reason="length"),
    {"choices": []},
    {"error": "weird"},
])
def test_malformed_responses_return_none(data):
    assert FakeServer(data).run() is None


def test_non_json_body_returns_none():
    srv = FakeServer(httpx.Response(200, text="<html>gateway</html>"))
    assert srv.run() is None


def test_placeholder_values_become_none():
    content = json.dumps({"title": "  Unknown ", "author": "", "excerpt": "N/A"})
    assert FakeServer(completion(content)).run() == {
        "title": None, "author": None, "excerpt": None,
    }


def test_missing_keys_become_none():
    assert FakeServer(completion('{"title": "Only a title"}')).run() == {
        "title": "Only a title", "author": None, "excerpt": None,
    }


def test_whitespace_collapsed_and_excerpt_truncated():
    content = json.dumps({
        "title": "Git\n  at   any scale",
        "author": "Vicent Martí",
        "excerpt": "word " * 100,
    })
    out = FakeServer(completion(content)).run()
    assert out["title"] == "Git at any scale"
    assert len(out["excerpt"]) == 240
    assert out["excerpt"].endswith("…")
