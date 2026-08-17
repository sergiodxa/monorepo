---
title: Copy Each Concern From the App That Runs It
impact: HIGH
tags: [apps, references, reuse]
---

# Copy Each Concern From the App That Runs It

Past the minimum file set, do not invent a shape and do not reproduce one from memory.
Open the app that already runs that concern in production, read how it does it, and copy
that. Name the app in the commit or the ADR, not in the new app's own comments.

## Why

- **A running app is a spec that cannot go stale.** A template directory records what was
  true when somebody last touched it; `apps/uptime` records what deployed this week.
- **The concerns are genuinely different from each other.** A D1 binding, a Durable
  Object, and a queue consumer each have a wrangler shape, a typegen consequence, and a
  testing story, and no single example carries all three well.
- **Getting it wrong is expensive at the edges, not the middle.** DO migration tags, queue
  dead-letter policy, and `migrations_dir` are the parts a from-memory version drops, and
  they are the parts that fail after deploy rather than at review.

## Pattern

| Concern | Read | Why this one |
| --- | --- | --- |
| A whole small server-rendered app | `apps/books` | The smallest complete Worker app: router, controllers, views, layout, container, router-level tests, no storage at all |
| Routing and controllers | `apps/books` (`routes/web.ts`, `app/http/controllers/`) | Shows `route()`/`get()`/`post()`/`form()` nesting and one-leaf-at-a-time `router.map` |
| D1 binding, schema, migrations | `apps/r3-auth` | D1 through `@pkg/data-table-d1`, `migrations_dir`, and the `db:local:migrate` / `db:remote:migrate` scripts with the binding name |
| Durable Object | `apps/uptime` (`app/do/geo-fetch.ts` plus its `wrangler.jsonc` `migrations` tags) | A plain DO bound into a worker, with the migration history that a rename actually needs |
| Per-tenant Durable Object as a host | `apps/auth-saas` (`bootstrap/tenant.ts`) | The DO-as-the-whole-application shape, where the worker resolves identity and the DO owns state |
| Queues, cron triggers, Analytics Engine, rate limiters, email | `apps/uptime` (`wrangler.jsonc`) | The one app with every binding kind, each with the reasoning for its settings written next to it |
| Service container wiring | `apps/books` (`app/lib/container.ts`) | Scoped vs singleton registration, and reading secrets inside the factory so a missing one fails the request, not module load |
| Router-level tests | `apps/books` (`app/lib/test/router.ts`) | Fetches the real router inside a container scope, overriding services rather than the network |
| Client-only SPA, no worker SSR | `apps/r3-gallery` | A `src/`-based static build with `not_found_handling: single-page-application` and no `main` — the deliberate exception to the layout rule |
| i18n | `apps/uptime` (`app/locales/`, `@pkg/i18n` middleware) | Locale files plus the middleware that puts `ctx.i18next.t` on the context |
| Server-rendered document shell and styling | `apps/blog` (`resources/layouts/document.tsx`, `resources/css/colors.css`) | Stylesheet ordering, head keying, and an sRGB-checked palette |

An HTTP client for an external API is a package, not app code — see the `create-package`
skill.

```text
# Bad
"I'll write the queue consumer config from what I remember of the docs."

# Good
open apps/uptime/wrangler.jsonc  ->  copy the queues block, including the
                                     dead_letter_queue and max_retries, and keep
                                     the reasoning comment or replace it with this
                                     app's own
```

Copy the shape, then write this app's own reasoning next to it. A comment in the new app
must describe what the new app does and why — never "same as uptime" or "mirrors the blog
app".

## Rules

1. Open the referenced app before writing a concern past the minimum
2. Copy the config shape including the parts that look optional — DO migration tags, `migrations_dir`, dead-letter queues
3. Rewrite the reasoning comments in the new app's own terms; never name another app or package as the source
4. Put an external-API client in `packages/`, not in the app
5. When no app runs the concern yet, write an ADR for the decision rather than a comment
