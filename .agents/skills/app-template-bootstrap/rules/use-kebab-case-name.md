---
title: Use the Kebab-Case App Name Everywhere
impact: HIGH
tags: [naming, bootstrap, consistency]
---

# Use the Kebab-Case App Name Everywhere

The app name must be kebab-case and must match across the app directory, `package.json`, `wrangler.jsonc`, and `README.md`.

## Why

- **Predictability**: The app folder and package name line up with monorepo conventions
- **Searchability**: One app name maps cleanly to one path and one package
- **Fewer mistakes**: Avoids mismatches between the folder name and deployment name

## Pattern

```text
Good:
- apps/team-ops/
- package.json -> "name": "@apps/team-ops"
- wrangler.jsonc -> "name": "team-ops"
- README.md -> "# team-ops"

Bad:
- apps/TeamOps/
- package.json -> "@apps/team_ops"
- wrangler.jsonc -> "team ops"
```

## Rules

1. Normalize the new app name to kebab-case before using it in paths or config
2. Use the same kebab-case value in `apps/<name>/`, `package.json`, `wrangler.jsonc`, and `README.md`
3. Do not invent different display names for the initial template files
