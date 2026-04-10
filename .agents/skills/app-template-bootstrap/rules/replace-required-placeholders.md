---
title: Replace Required App Placeholders
impact: HIGH
tags: [placeholders, bootstrap, config]
---

# Replace Required App Placeholders

After copying the template, replace the app identity placeholders immediately in `package.json`, `wrangler.jsonc`, and `README.md`.

## Why

- **Ownership**: The new app should have its own package, worker name, and README heading
- **Documentation**: The app description belongs in the README from the start
- **Controlled failure**: Only infrastructure placeholders should remain deploy-blocking after bootstrap

## Pattern

```text
Source template values:
- package.json -> "@apps/<app-name>"
- wrangler.jsonc -> "name": "app-name"
- README.md -> "# <app-name>"
- README.md -> "<app-name> is a <brief description of the app>."

Bootstrapped values for team-ops:
- package.json -> "@apps/team-ops"
- wrangler.jsonc -> "name": "team-ops"
- README.md -> "# team-ops"
- README.md -> "team-ops is an internal dashboard for team operations."
```

## Good

```text
Update these files right after copying:

apps/team-ops/package.json
apps/team-ops/wrangler.jsonc
apps/team-ops/README.md
```

## Bad

```text
Leaving template identity placeholders in place:

package.json   -> @apps/<app-name>
wrangler.jsonc -> app-name
README.md      -> <app-name>
```

## Rules

1. Update `package.json` `name` to `@apps/<kebab-case-name>`
2. Update `wrangler.jsonc` `name` to `<kebab-case-name>`
3. Update `README.md` title and opening description with the new app name and description
4. Do not leave the app identity placeholders unchanged after bootstrapping
