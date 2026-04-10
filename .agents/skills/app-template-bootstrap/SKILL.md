---
name: app-template-bootstrap
description: Create a new app from `templates/app` when bootstrapping a new application in this monorepo. Use when copying the template into `apps/`, asking for the new app name and description, and replacing required placeholders.
---

# App Template Bootstrap

Patterns for creating a new app from `templates/app`. Contains 4 rules covering required inputs, naming, directory creation, and placeholder replacement.

## When to Apply

Reference these guidelines when:

- Creating a new app from `templates/app`
- Bootstrapping an app inside `apps/`
- Replacing template placeholders in a newly copied app
- Reviewing whether a newly created app follows the monorepo app template workflow

## Rules Summary

### Required Inputs (HIGH)

#### require-app-metadata - @rules/require-app-metadata.md

Always require the new app name and description before copying the template so the generated app has enough information to replace placeholders consistently.

```text
Required inputs:
- app name: "my-app"
- app description: "Internal dashboard for team operations."
```

#### use-kebab-case-name - @rules/use-kebab-case-name.md

Use the kebab-case app name for the target folder and for every template field that expects the app name.

```text
apps/my-app/
package.json -> "@apps/my-app"
wrangler.jsonc -> "name": "my-app"
README.md -> "# my-app"
```

### Bootstrapping (HIGH)

#### copy-whole-template-directory - @rules/copy-whole-template-directory.md

Copy the entire `templates/app/` directory into `apps/<app-name>/` instead of recreating files by hand.

```bash
cp -R templates/app apps/my-app
```

#### replace-required-placeholders - @rules/replace-required-placeholders.md

Replace the required placeholders in `package.json`, `wrangler.jsonc`, and `README.md` immediately after copying so the new app has its own identity and documentation.

```text
package.json   -> @apps/my-app
wrangler.jsonc -> my-app
README.md      -> # my-app
README.md      -> Internal dashboard for team operations.
```

## Philosophy

Good app bootstrapping is:

1. **Complete** - Copy the whole template, not a partial subset
2. **Explicit** - Require the app name and description up front
3. **Consistent** - Use the same kebab-case name across folder and config
4. **Intentional** - Keep deploy-blocking placeholders until real infrastructure values are known
5. **Repeatable** - Follow the same workflow for every new app
