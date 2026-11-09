# Security policy

## Reporting a vulnerability

Please don't report security issues in public issues, discussions or pull
requests.

Report them privately through GitHub:
[open a security advisory](https://github.com/specbug/odyssey/security/advisories/new).
Include what is affected, how to reproduce it, and the impact you expect.

You should get a reply within a week. Once the issue is confirmed, we'll
agree a fix and a disclosure date with you, and credit you in the advisory
unless you'd rather not be named.

## Supported versions

Odyssey has no versioned releases yet. Fixes land on `main`; run the latest
`main` to get them.

## Deployment notes

Odyssey has no user accounts. Anyone who can reach the server can read and
change every document and note on it. Keep it on a trusted network, or put
it behind an authenticating proxy (for example Cloudflare Access) before
exposing it to the internet.
