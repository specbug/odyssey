"""Live smoke test: run metadata extraction against the real Meta Model API.

Usage (from apps/api, with META_API_KEY in the environment or .env):

    python -m scripts.smoke_meta_metadata path/to/one.pdf [more.pdf ...]

Prints what would be sent (page count, prompt size), the extracted fields,
and the wall-clock time per file. Exits non-zero if any file comes back
empty, so it doubles as a post-deploy check:

    podman exec odyssey_api_1 python -m scripts.smoke_meta_metadata \\
        /data/uploads/<some-file>.pdf
"""
import sys
import time

from dotenv import load_dotenv

from app import meta_ai


def main(paths: list[str]) -> int:
    load_dotenv()
    if not meta_ai.is_configured():
        print(f"{meta_ai.API_KEY_ENV} is not set.")
        return 2
    failures = 0
    for path in paths:
        with open(path, "rb") as f:
            data = f.read()
        text, info = meta_ai._prepare_text(data)
        print(f"\n── {path}")
        print(f"   {len(data):,} bytes · {len(text):,} chars of text "
              f"(~{len(text) // 4:,} tokens) · info={info or '{}'}")
        t0 = time.monotonic()
        meta = meta_ai.extract_pdf_metadata(data)
        dt = time.monotonic() - t0
        if not meta or not any(meta.values()):
            print(f"   ✗ no metadata ({dt:.1f}s)")
            failures += 1
            continue
        print(f"   ✓ {dt:.1f}s")
        for k in ("title", "author", "excerpt"):
            print(f"     {k:8} {meta.get(k)!r}")
    return 1 if failures else 0


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    sys.exit(main(sys.argv[1:]))
