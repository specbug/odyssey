# Security policy

## Reporting a vulnerability

Report vulnerabilities privately through GitHub:
[open a security advisory](https://github.com/specbug/odyssey/security/advisories/new).
Public issues, discussions and pull requests are the wrong place, because
they disclose the problem before a fix exists.

Include what is affected, the steps that reproduce it, and the impact you
expect. You should hear back within a week. Once the problem is confirmed,
we agree a fix and a disclosure date with you, and the advisory credits you
unless you'd rather not be named.

## Supported versions

There are no versioned releases yet. Fixes land on `main`, and the latest
`main` is the only supported version.

## Deploying safely

Odyssey has no user accounts. Anyone who can reach the server can read,
change and delete every document and note on it. Run it on a network you
trust, or behind a proxy that authenticates, such as Cloudflare Access.
