# r3-auth

The OAuth 2.0 / OpenID Connect authorization server: it authenticates people with a
password or a GitHub account and issues the ID, access and refresh tokens the other
apps sign in with.

This is a Remix v3 rebuild of the server currently answering `auth.sergiodxa.com`. It
reuses that server's D1 database, KV namespace, R2 signing keys and queue unchanged,
so both can run side by side while it is verified endpoint by endpoint. Until the
custom domain moves, it is not serving anyone.

Full documentation — the URL surface, the contracts relying parties depend on, and the
build-out plan — lives in
[docs/adr/r3-auth/ADR-001](../../docs/adr/r3-auth/ADR-001-port-auth-to-remix-v3.md).

## Development

```sh
bun run --cwd apps/r3-auth dev              # Dev server on http://localhost:3002
bun run --cwd apps/r3-auth build            # Build the worker and client bundles
bun run --cwd apps/r3-auth db:local:migrate # Apply migrations to the local D1 database
bun run --cwd apps/r3-auth cf:typegen       # Regenerate binding types after a config change
bun test apps/r3-auth --isolate             # Run this app's tests, from the repo root
```

Secrets come from `.dev.vars` locally (see `.env.example`) and `wrangler secret put` in
production.
