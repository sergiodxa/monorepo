---
title: Require App Metadata Before Writing Files
impact: HIGH
tags: [apps, bootstrapping, inputs]
---

# Require App Metadata Before Writing Files

Ask for the app name, its one-line description, and the dev port before creating
`apps/<name>/`. Each of the three lands in several files that have to agree with one
another, and guessing any of them means editing five files again once the real value
arrives.

## Why

- **The name is structural**: it is the directory, the package name, and the deployed
  worker name. Renaming later touches `package.json`, `wrangler.jsonc`, every `~/`
  consumer's install, and the deployed script.
- **The description is the README's first line** and the `<meta name="description">`
  default. Without it the README ships as a stub, which is the state the old template
  shipped in for a year.
- **The port collides silently**: two apps on 3000 only fail when both dev servers run,
  which is exactly when a person is least interested in debugging config.

## Pattern

```text
# Bad: start writing and leave holes

apps/<app-name>/package.json  ->  "name": "@apps/<app-name>"
README.md                     ->  "# <app-name>"
wrangler.jsonc                ->  "dev": { "port": 3000 }   // already taken

# Good: collect first, then write once

app name:    team-ops
description: Internal dashboard for team operations.
dev port:    3006
```

Ports currently in use are readable from the workspaces themselves, so check rather than
assume:

```bash
grep -h '"port"' apps/*/wrangler.jsonc
```

The port appears twice per app — `wrangler.jsonc`'s `dev.port` and `vite.config.ts`'s
`server.port` — and both must be the same number.

## Rules

1. Require the app name, the one-line description, and the dev port before creating the directory
2. Check the port against `apps/*/wrangler.jsonc` instead of defaulting to 3000
3. Ask for anything else the app clearly needs up front too: a custom domain, a D1 database name, the secrets `.env.example` will list
4. Do not write a file with a placeholder in a field one of these three answers
