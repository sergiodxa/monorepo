---
title: Fill Every Identity Field Before Running Anything
impact: MEDIUM
tags: [apps, bootstrapping, consistency]
---

# Fill Every Identity Field Before Running Anything

The app's name, description, and port each appear in more than one file. Write the real
value into all of them in the same pass. A leftover `<app-name>` compiles, a duplicated
port starts, and neither is reported by `vp check`.

## Why

- **None of these are type errors.** The type checker has no opinion about a README
  heading or a `dev.port`, so the only thing standing between a placeholder and `main` is
  writing it correctly the first time.
- **A duplicated port fails at the worst moment** — when two dev servers run — and the
  error names a port, not an app.
- **A stub README is what a stale scaffold looks like from the outside.** The description
  is the one thing a person reads before deciding whether to open the app at all.

## Pattern

| Value | Files that hold it |
| --- | --- |
| App name | `apps/<name>/` directory, `package.json` `name`, `wrangler.jsonc` `name`, `README.md` H1, `AGENTS.md` heading |
| Description | `README.md` first line, `AGENTS.md` intro, the document layout's default `description` |
| Dev port | `wrangler.jsonc` `dev.port`, `vite.config.ts` `server.port`, `README.md` development steps |
| Secrets | `.env.example` keys, the `wrangler.jsonc` comment naming them, `README.md` environment section |
| Module headers | The `@author` / `@copyright` block at the top of every `.ts`/`.tsx` file |

```text
# Bad: shipped with the shape and none of the identity
README.md      -> "# <app-name>\n\n<app-name> is a <brief description of the app>."
wrangler.jsonc -> "name": "app-name", "dev": { "port": 3000 }
vite.config.ts -> server: { port: 3000 }

# Good
README.md      -> "# team-ops\n\nInternal dashboard for team operations."
wrangler.jsonc -> "name": "team-ops", "dev": { "port": 3006 }
vite.config.ts -> server: { port: 3006 }
```

Sweep for stragglers before committing:

```bash
git grep -n -e '<app-name>' -e 'app-name' -- apps/team-ops
grep -h '"port"' apps/*/wrangler.jsonc | sort | uniq -d
```

## Rules

1. Write name, description, and port into every field that holds one, in one pass
2. Keep `wrangler.jsonc` `dev.port` and `vite.config.ts` `server.port` equal, and unique across `apps/*`
3. Write the README from the app documentation guidelines rather than leaving a stub
4. Grep the new app for placeholder text before committing
