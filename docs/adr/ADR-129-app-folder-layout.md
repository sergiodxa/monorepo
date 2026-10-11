# ADR-129: One Folder Layout for Every App

## Status

**Accepted** - 2026-10-11

## Background

Each app's `bootstrap/` folder mixed two jobs. It held the runtime entry points (`worker.ts`,
`browser.ts`), and it also built the objects the app needs exactly one of: the logger, the
router, the MCP handler. Code under `app/` imported those objects back out of `bootstrap/`.
Every job dispatcher imported `~/bootstrap/logger`, reader's Durable Objects did the same, and
sdxc's MCP controller imported `~/bootstrap/mcp`.

Looking at that dependency surfaced a wider problem. The same kind of code had several homes,
and the choice of home differed by app:

| Kind of code               | Homes in use                                                                          |
| -------------------------- | ------------------------------------------------------------------------------------- |
| Instances of a package     | `bootstrap/`, `app/lib/`, `app/services/`                                             |
| Data access                | `app/models/` (`@sdxc/data-model`), `app/repositories/`, `database/*.ts`, `app/data/` |
| Business logic             | `app/services/`, `app/lib/`, `database/*.ts`                                          |
| Generic helpers            | `app/lib/`, `app/services/`                                                           |
| Email templates            | `app/emails/`, `app/mail/`                                                            |
| Views                      | `resources/views/`, `app/views/`                                                      |
| Durable Object classes     | `database/*-do.ts`, `app/do/`                                                         |
| Test helpers and factories | `app/lib/test/`, `app/test/`                                                          |

Each choice made sense when it was made. Together they meant neither a person nor an agent
could say with certainty where a new file belonged, and every new choice added another home.

## Context

Before settling on a layout we compared the apps against the common ones:

- **Rails and Laravel MVC** organise by kind of code. Placement is mechanical: a controller goes
  with the controllers. The apps already follow this shape, closest to Laravel (`bootstrap/`,
  `config/`, `database/`, `resources/`, `routes/`, `app/http/`).
- **Feature folders** (screaming architecture, DDD bounded contexts, vertical slices) organise by
  what the app does. They make removing or extracting a feature easy, but every placement needs a
  judgment call: which feature owns a controller that shows two features, which feature owns a
  model two features write, whether a cycle between features means they are one feature, and
  where code goes that fits no feature. In blog, articles, tutorials and glossary entries are one
  `posts` table, so even the first cut is a judgment call.
- **Hexagonal** already holds at the package boundary: `@sdxc/billing`, `mail`, `cache` and
  `captcha` define interfaces with Polar, memory and D1 adapters, and middleware publishes the
  chosen adapter onto the request context.
- **The lava layer anti-pattern** warns that a new layout added beside the old one, with the old
  code left in place, leaves a codebase with several ways to do the same thing.

## Decision

Apps keep the Laravel shape, organised by kind of code, with one home per kind. The question
"where does this file go?" has one answer, read from this table:

| If the code…                                                                                                            | It goes in              |
| ----------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| is the Worker or browser entry point                                                                                    | `bootstrap/`            |
| is a Durable Object class the runtime instantiates                                                                      | `bootstrap/do/`         |
| builds the one instance of something: logger, router, dispatcher, MCP handler, database, billing, flags, mailer, assets | `app/initializers/`     |
| handles an HTTP request                                                                                                 | `app/http/controllers/` |
| is HTTP middleware                                                                                                      | `app/http/middleware/`  |
| validates request input                                                                                                 | `app/http/validators/`  |
| wraps the request's renderer                                                                                            | `app/http/render.tsx`   |
| is a background job                                                                                                     | `app/jobs/`             |
| is an MCP tool or resource                                                                                              | `app/mcp/`              |
| is an email template                                                                                                    | `app/emails/`           |
| reads or writes stored state, in any storage (D1, KV, R2, Durable Object)                                               | `app/models/`           |
| is a rule about one model                                                                                               | a method on that model  |
| is business logic across models or package instances, or a rule about none                                              | `app/services/`         |
| is an authorization rule                                                                                                | `app/policies/`         |
| is a view, component, layout or stylesheet                                                                              | `resources/`            |
| is a translation                                                                                                        | `resources/locales/`    |
| is a route contract                                                                                                     | `routes/`               |
| is static app configuration (site profile, product catalog, security.txt)                                               | `config/`               |
| is a migration or table schema                                                                                          | `database/`             |
| is a test factory                                                                                                       | `database/factories/`   |
| is any other test helper                                                                                                | `app/test/`             |
| is generic, with no knowledge of the app                                                                                | a package               |

### Rules

1. **`bootstrap/` holds entry points only, and nothing outside it imports from it.** `worker.ts`
   and `browser.ts` read the runtime's inputs and hand them to initializers. A Durable Object
   class lives in `bootstrap/do/` because the runtime instantiates it like an entry point; it
   imports its logic from `app/`. The `~/bootstrap/*` alias is gone from every tsconfig.
2. **An initializer exports a singleton, or a function when the instance needs per-request or
   async input** (secret-store reads, the request host). Bindings read from `cloudflare:workers`
   at module scope are fine; work and I/O at module scope are not.
3. **`app/lib/` does not exist.** An instance of a package is an initializer, generic code is a
   package, and app logic is a model method or a service. Generic code duplicated across apps
   (the asset lookup in all eight, cost tracking in auth-saas and uptime, article extraction in
   blog and reader) is a candidate for a package after the layout change; each extraction is
   proposed and agreed before the package is created.
4. **`app/repositories/` and `app/data/` do not exist.** Every store is a model, whatever backs
   it; blog's KV-backed redirects become `app/models/redirects.ts`.
5. **The router's global middleware is written inline** in `createRouter({ middleware: [...] })`,
   and `AppContext` is `RouterContext` of that router. A stored `Middleware[]` widens the tuple
   and erases what each middleware publishes. The factory is a named export called after the
   route contract it maps, `createWebRouter` for `routes/web.ts`, since it builds a router.
6. **Every route is mapped through `lazy()` from `@sdxc/lazy-route`,** so a request imports only
   the controller it reaches. Guards the router owns go in `lazy()`'s second argument and answer
   before the module loads.
7. **Pages render through `render({ assets })` from `remix/middleware/render`,** with a
   `renderWith()` wrapper in `app/http/render.tsx` for what the app adds around every page
   (document assets, a CSP nonce). Apps do not rebuild rendering from `renderToStream`.
8. **Feature names group files inside a layer once the layer gets crowded,** using the same name
   in every layer (`app/jobs/trials/`, `app/services/trials/`, `resources/views/trials/`), so
   `**/trials/**` finds the whole feature.
9. **`test/app-layout.test.ts` enforces the layout** for every app in its `CONVERTED_APPS` list:
   the allowed root folders, the allowed `app/` folders, entry points alone in `bootstrap/`, and no
   import into `bootstrap/` from outside it.

## Consequences

### Positive

- Placing a file takes one question, "what kind of code is it?", with the same answer in every app.
- The dependency direction is fixed: entry points depend on initializers, initializers on the
  app, and the app never on an entry point.
- A test fails the moment a new folder or an import into `bootstrap/` appears, so the layout
  does not drift back.
- Package instances have one home, so a test that substitutes one knows where the real one is
  built.

### Negative

- Feature boundaries are not enforced. A feature is collected across layers by its shared name,
  and extracting one means gathering it from several folders.
- Converting eight apps is a long series of file moves, each touching every import of a moved
  module.

### Neutral

- The router stays a factory in apps where tests pass their own database or captcha, or where it
  needs per-request input. Making each router a module-level singleton depends on how tests
  substitute those inputs and is decided separately.
- A frame's answer now starts with `<!DOCTYPE html>` in demo, as it already did in the other apps
  on `render()`; the browser ignores a doctype inside a document it is inserted into.

## Implementation Plan

Each app converts completely in its own commits before the next one starts, and joins
`CONVERTED_APPS` in the commit that converts it. An app never holds the old and new layouts at
the same time.

Order: demo, books, sdxc, blog, r3-auth, reader, uptime, auth-saas. The small apps prove the
layout cheaply; auth-saas goes last because its 42 `database/*.ts` modules split into models and
services.

Per app:

1. Move `bootstrap/app.tsx`, `logger.ts` and `mcp.ts` into `app/initializers/` (`app.tsx` becomes
   `router.tsx`), along with `app/jobs/dispatcher.ts` and every package instance from `app/lib/`.
2. Move Durable Object classes into `bootstrap/do/`, re-exported from `worker.ts`.
3. Write the global middleware inline in `createRouter`, and move the document wrapper into
   `app/http/render.tsx` on top of `render({ assets })`.
4. Sort the rest of `app/lib/`, `app/repositories/`, `app/data/` and stray folders by the table.
5. Move translations to `resources/locales/`, factories to `database/factories/`, test helpers to
   `app/test/`.
6. Update the app's AGENTS.md reference table and README, then add the app to `CONVERTED_APPS`.

## Alternatives Considered

### Feature folders (`app/features/<capability>/`)

Each capability would own its controllers, jobs, models, views and rules, with features
importing each other only through an `index.ts`. Rejected because every placement needs a
judgment call about ownership, and a person and an agent answer those differently; each
divergent answer becomes a small inconsistency, which is the lava layer this decision exists to
remove. A shared folder for code that fits no feature would become `app/lib/` again.

### Rails layout

Rails puts views under `app/`, migrations under `db/`, and every controller in one flat folder.
Switching would move code the apps already place the Laravel way, for no gain. Laravel's grouping
by delivery (`Http/`, `Console/`) also fits apps that receive work three ways: HTTP, queue and MCP.
Two Rails ideas are kept: the name `initializers`, and `lib/` as code that could become a gem,
which in a monorepo is a package.

## References

- [Screaming Architecture](https://blog.cleancoder.com/uncle-bob/2011/09/30/Screaming-Architecture.html)
- [The Lava Layer Anti-Pattern](http://mikehadlow.blogspot.com/2014/12/the-lava-layer-anti-pattern.html)
- [Layered Architectures with Laravel](https://martinjoo.dev/layered-architectures-with-laravel)
- [Organizing App Logic](https://khalilstemmler.com/articles/software-design-architecture/organizing-app-logic/)
- [Bulletproof Node.js Project Architecture](https://softwareontheroad.com/ideal-nodejs-project-structure)

## Current Progress

- [x] demo
- [x] books
- [ ] sdxc
- [ ] blog
- [ ] r3-auth
- [ ] reader
- [ ] uptime
- [ ] auth-saas
- [ ] Propose packages for the duplicated generic code (asset lookup, cost tracking, article extraction)
