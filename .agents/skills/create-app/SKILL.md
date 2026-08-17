---
name: create-app
description: Create a new application under `apps/` in this monorepo. Use when scaffolding a Cloudflare Worker app from scratch — asking for the app name and description, writing the Laravel-style directory layout, wiring the `~/*` aliases, and pointing at the living app that already solves each concern.
---

# Create App

Patterns for adding a new application to `apps/`. There is no template directory to copy;
an app is written from the structure described here and from whichever existing app
already solves the concern being added. Contains 8 rules across 5 categories: required
inputs, structure, reuse, wiring, and consistency.

## When to Apply

Reference these guidelines when:

- Creating a new app inside `apps/`
- Deciding which directories and files a new app needs before writing any feature code
- Adding a D1 database, Durable Object, queue, or cron trigger to a young app
- Reviewing whether a newly created app matches how the other apps are built

## Rules Summary

### Required Inputs (HIGH)

#### require-app-metadata - @rules/require-app-metadata.md

Get the app name, its one-line description, and its dev port before writing a single file,
because all three are baked into six files that have to agree.

```text
Required inputs:
- app name:    "team-ops"
- description: "Internal dashboard for team operations."
- dev port:    3006  (must not collide: 3000-3005 are taken today)
```

#### use-kebab-case-name - @rules/use-kebab-case-name.md

Use one kebab-case name for the directory, the package name, and the worker name.

```text
apps/team-ops/
package.json   -> "name": "@apps/team-ops"
wrangler.jsonc -> "name": "team-ops"
README.md      -> "# team-ops"
```

### Structure (HIGH)

#### minimum-app-files - @rules/minimum-app-files.md

Fifteen files make a worker that boots, serves a page, 404s, and type-checks. The rule
carries the content of every one of them.

```text
package.json  tsconfig.json  vite.config.ts  wrangler.jsonc  .gitignore
.env.example  README.md  AGENTS.md  LICENSE.md
bootstrap/{worker.ts,app.tsx,browser.ts}   routes/web.ts
app/http/controllers/{default-handler.tsx,home.tsx}
resources/layouts/document.tsx             config/router-context.d.ts
```

#### app-directory-layout - @rules/app-directory-layout.md

Apps use a Laravel-style top level — `bootstrap/`, `routes/`, `app/`, `resources/`,
`config/`, `database/`, `public/` — and import across it through `~/<dir>/*` aliases,
never `src/` and never a relative path that climbs out of its directory.

```ts
import defaultHandler from "~/app/http/controllers/default-handler";
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";
```

### Reuse (HIGH)

#### copy-from-living-code - @rules/copy-from-living-code.md

For anything past the minimum, copy the shape out of the app that already runs it in
production instead of inventing one; that app is the spec, and it stays current.

```text
D1 binding + migrations   -> apps/r3-auth
Durable Object            -> apps/uptime (app/do/geo-fetch.ts)
Queues + cron triggers    -> apps/uptime
Router-level tests        -> apps/books (app/lib/test/router.ts)
Client-only SPA (no SSR)  -> apps/r3-gallery
```

### Wiring (HIGH)

#### wire-into-the-monorepo - @rules/wire-into-the-monorepo.md

A new app is a Bun workspace: extend the root `tsconfig.json`, take `@pkg/*` as
`workspace:*`, keep test files inside the tsconfig `include`, and put lint or format
exceptions in the root `vite.config.ts` rather than a config file in the app.

```jsonc
// apps/team-ops/tsconfig.json
{ "extends": "../../tsconfig.json", "include": ["app/**/*", "../../types/bun-test.d.ts"] }
```

#### app-gitignore-entries - @rules/app-gitignore-entries.md

Every app carries a three-entry `.gitignore` for the artifacts the root one does not
cover: `/.wrangler`, `.dev.vars`, and the generated `worker-configuration.d.ts`.

```gitignore
# Artifacts the root .gitignore does not already cover.

# Folders
/.wrangler

# Files
.dev.vars
worker-configuration.d.ts
```

### Consistency (MEDIUM)

#### fill-every-identity-field - @rules/fill-every-identity-field.md

Write the real name, description, and port into every field that holds one before running
anything; a leftover `<app-name>` or a duplicated port is not caught by `vp check`.

```text
package.json   name              wrangler.jsonc  name, dev.port
vite.config.ts server.port       README.md       title, description, port
AGENTS.md      commands section  .env.example    the secrets .dev.vars must define
```

## Philosophy

Good app creation is:

1. **Derived** - The structure comes from the apps that run in production, not a snapshot of them
2. **Minimal** - Start with the fifteen files that boot; add a directory when a feature needs it
3. **Explicit** - Name, description, and port are decided up front, not left as placeholders
4. **Pointed** - Every concern past the minimum names the app to read, so the guidance cannot rot
5. **Wired** - Root tsconfig, `workspace:*` deps, central lint config, and type-checked tests from the first commit
