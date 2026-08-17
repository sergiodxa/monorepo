---
title: Laravel-Style Layout and the `~/*` Aliases
impact: HIGH
tags: [apps, structure, imports]
---

# Laravel-Style Layout and the `~/*` Aliases

Apps do not have a `src/`. The top level of an app is a Laravel-style set of role
directories, and modules reach across them through `~/<dir>/*` aliases declared in the
app's `tsconfig.json`.

## Why

- **The top level answers "what kind of thing is this?" before you open anything.** A file
  under `bootstrap/` is an entry point; one under `resources/` renders; one under
  `app/http/` handles a request. A single `src/` tree pushes that answer three levels down.
- **`~/` aliases keep an import stable under a move.** `~/routes/web` reads the same from a
  controller, a middleware, and a test, so relocating a controller one directory deeper
  does not rewrite its imports.
- **The alias map is also the include list.** A directory that exists is in both the
  tsconfig `paths` and its `include`, so a directory that is neither is a directory
  nothing type-checks.

## Pattern

```text
apps/<name>/
├── bootstrap/            # runtime entry points, the composition root
│   ├── worker.ts         #   Cloudflare fetch/scheduled/queue handler — the ONLY module
│   │                     #   allowed to touch Cloudflare-specific APIs
│   ├── app.tsx           #   router assembly: global middleware + route mapping + renderer
│   ├── browser.ts        #   client runtime entry (islands, frame resolution)
│   └── tenant.ts         #   a per-tenant Durable Object, when the app has one
├── routes/
│   └── web.ts            # the typed route table; every pattern is a published contract
├── app/                  # everything that is application logic
│   ├── http/
│   │   ├── controllers/  #   one module per route (or route group)
│   │   ├── middleware/   #   app-specific middleware
│   │   ├── validators/   #   remix/data-schema shapes for untrusted input
│   │   └── view-models/  #   normalized payloads controllers hand to views
│   ├── models/           # data + business-logic models over remix/data-table
│   ├── services/         # service classes for external systems
│   ├── jobs/             # background and scheduled work (@pkg/jobs)
│   ├── do/               # Durable Object classes, when they are not a bootstrap entry
│   └── lib/              # app-internal helpers: container wiring, seo, test helpers
├── resources/            # everything that renders
│   ├── layouts/          #   the <html>/<head>/<body> shell and page shells
│   ├── views/            #   one module per page
│   ├── components/       #   reused or hydrated components
│   ├── content/          #   static content data
│   └── css/              #   stylesheets that cannot be css() mixins
├── config/               # ambient *.d.ts: env and RequestContext augmentations
├── database/
│   ├── schema.ts         #   table definitions
│   └── migrations/       #   D1 migrations, pointed at by wrangler's migrations_dir
└── public/               # static files served as-is
```

Only `bootstrap/`, `routes/`, `app/http/controllers/`, `resources/layouts/`, and `config/`
are needed on day one. The rest appear with the feature that needs them.

```ts
// Bad: relative paths that climb out of their own directory
import routes from "../../../routes/web";
import DocumentLayout from "../../resources/layouts/document";

// Good: the alias, identical from anywhere in the app
import DocumentLayout from "~/resources/layouts/document";
import routes from "~/routes/web";
```

Relative imports stay correct for siblings inside one directory — `./app` from
`bootstrap/worker.ts` is right, and so is `./index.js` inside a package.

A one-off view used by exactly one controller is folded into `ctx.render()` in that
controller rather than given a file in `resources/views/`; `resources/views/` is for pages
that are reused or hydrated.

## Rules

1. No `src/` directory in an app; use the role directories at the top level
2. Declare a `~/<dir>/*` path for every top-level directory the app has, and include that directory in the tsconfig `include`
3. Import across directories through `~/`, and use a relative path only for a sibling
4. Keep Cloudflare-specific APIs in `bootstrap/worker.ts`
5. Keep environment and `RequestContext` type augmentations in `config/*.d.ts`, outside `app/`
6. Create a directory when a feature needs it, and add its alias in the same change
