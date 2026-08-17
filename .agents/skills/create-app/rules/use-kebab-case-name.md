---
title: Use One Kebab-Case Name Everywhere
impact: HIGH
tags: [apps, naming, conventions]
---

# Use One Kebab-Case Name Everywhere

The app has a single kebab-case name, and it is used verbatim for the directory, the
`@apps/` package name, the worker name, and the README heading. No camelCase, no
underscores, no per-file variation.

## Why

- **`bun install` resolves workspaces by directory glob** (`apps/*`), so the directory
  name and `package.json` name drifting apart makes the workspace hard to address by
  either.
- **`bunx wrangler deploy` uses `wrangler.jsonc`'s `name` as the script name.** A worker
  named differently from its directory is one more indirection between a log line and the
  code that emitted it.
- **Consistency is what makes `apps/<name>` guessable** from a URL, a log, or a Polar
  webhook without opening anything.

## Pattern

```text
# Bad
apps/teamOps/          package.json -> "@apps/team_ops"   wrangler -> "team-ops-worker"

# Good
apps/team-ops/         package.json -> "@apps/team-ops"   wrangler -> "team-ops"
```

The one place the two legitimately differ is a deploy that has to inherit an existing
worker's identity — its custom domain, its secrets, and its Durable Object migration
history are all keyed to the deployed script name, so the `wrangler.jsonc` `name` stays
whatever that script is already called and the directory takes the new name.

## Rules

1. Pick one kebab-case name and use it for the directory, `@apps/<name>`, and the worker name
2. Keep the README H1 equal to the app name
3. Deviate the worker name from the directory name only to take over an already-deployed script, and say so in a `wrangler.jsonc` comment
