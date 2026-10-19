---
title: How it fits together
description: What runs between a request reaching an sdxc app's Worker and its controller answering, what each handler's ctx carries and who puts it there, and the job of every folder the template writes.
section:
    title: Getting started
    order: 1
order: 5
lastUpdated: 2026-10-19
outcomes:
    - "The order code runs in, from the Worker's `fetch` to the controller's action"
    - "What a handler reads from `ctx`, and which middleware publishes each part"
    - "Which folder each kind of code lives in, and why that is the folder `sdxc make` writes to"
---

An app from `sdxc create` is a [Cloudflare Worker](https://developers.cloudflare.com/workers/)
whose requests are answered by a [Remix](https://remix.run) router. This page assumes you know
both, and covers what the template adds: where each piece is built, the order it runs in, and
the folder each kind of code goes in. Knowing that is what lets you find any file in an
unfamiliar app, and tell where a new one belongs before `sdxc make` writes it.

## Three ways in, one set of services

The Worker is entered three ways, and each entry point hands over to one instance built in
`app/initializers/`:

| Entry                                      | Started by                     | Hands over to                                        |
| ------------------------------------------ | ------------------------------ | ---------------------------------------------------- |
| `bootstrap/worker.ts` `fetch`              | an HTTP request                | the router, `app/initializers/router.tsx`            |
| `bootstrap/worker.ts` `queue`, `scheduled` | a queued job or a cron trigger | the job dispatcher, `app/initializers/dispatcher.ts` |
| `bootstrap/cli.ts`                         | `sdxc run …` on your machine   | the command line, `app/initializers/cli.ts`          |

Each of the three runs middleware that publishes the same services, so a controller, a job and
a command all read `ctx.db`, `ctx.models` and `ctx.log`, and a model method you write once works
in all three. `bootstrap/` holds the entry points and nothing else, and nothing outside it
imports from it: the CLI's commands never ship in the Worker, and a test builds the router
without starting a Worker.

## A request, step by step

```mermaid {% alt="A request through an sdxc app: the Worker's fetch builds the router, the router's global middleware publishes the log, database, models and mailer, the route contract picks the route, lazy() imports the controller, the controller's page chain adds the session, access, language, honeypot and renderer, and the action returns the response" %}
sequenceDiagram
    participant W as bootstrap/worker.ts
    participant R as Router
    participant C as Controller module
    W->>R: fetch(request)
    Note over R: global middleware: log, trace, rate limit,<br>database, models, mail
    R->>R: match routes/web.ts or routes/api.ts
    R->>C: lazy() imports the controller
    Note over C: its chain: page or api middleware
    C-->>R: the action's Response
    R-->>W: Response
```

1. **The Worker builds the router.** `fetch` calls `createWebRouter()` from
   `app/initializers/router.tsx` and forwards the request.
2. **The global middleware runs.** The router's chain, written inline in `createRouter({ middleware })`,
   is what every page and endpoint needs: the request's log and trace, the client address, the
   rate limit, the database, the models and the mailer. `sdxc routes` prints it at the top.
3. **A contract picks the route.** `routes/web.ts` declares the pages and `routes/api.ts` the
   endpoints; each entry is a URL pattern and a method, and the typed `href()` every link uses
   comes from the same declaration.
4. **`lazy()` loads one controller.** Every route is mapped through `lazy()`, so a request
   imports only the controller it reaches, and a cold start pays for one module.
5. **The controller's chain runs.** A page declares `app/http/middleware/page.ts`: the form
   body, the cross-origin check, the session, the visitor's access, the language, the honeypot,
   the security headers and the renderer. An endpoint declares `app/http/middleware/api.ts`:
   CORS and access. Only requests that render a page pay for a page's middleware.
6. **The action answers.** It reads what the chain published on `ctx`, validates its input with
   a schema from `app/http/validators/`, calls the models or a service, and returns a
   `Response`, usually `ctx.render(<Page />)`.

## What ctx carries

A handler never builds its own services; the middleware publishes each one onto the context,
and the router's type reads them back, so `ctx.models` is typed by the models you registered.
That is also what lets a test swap one: it runs the same chain with its own database.

| On `ctx`                   | Published by                               | In                 |
| -------------------------- | ------------------------------------------ | ------------------ |
| `ctx.log`                  | `log(logger)`                              | everything         |
| `ctx.db`, `ctx.models`     | `database(…)`, `models(registry, …)`       | everything         |
| `ctx.email`                | `mail({ transport, from })`                | requests, commands |
| `ctx.ip`, `ctx.userAgent`  | `getClientIP()`, `userAgent()`             | requests           |
| `ctx.session`, `ctx.intl`  | the page chain                             | pages              |
| `ctx.access`               | `access` in the page and api chains        | requests           |
| `ctx.render`, `ctx.assets` | `render(…)`, `assets(…)` in the page chain | pages              |

A middleware you write with [`sdxc make middleware`](/docs/sdxc/make-middleware) publishes its
own value the same way, and `--mount` adds it to a chain.

## A job, step by step

A controller or a command enqueues a job by its declaration in `app/jobs/index.ts`; Cloudflare
delivers the message to the Worker's `queue` handler, and the dispatcher in
`app/initializers/dispatcher.ts` runs its own middleware, the database and the models, before it
imports the handler the job is mapped to. A `--cron` job is enqueued by the Worker's
`scheduled` handler when a trigger in `cloudflare.config.ts` fires. Either way the handler sees
`ctx.input`, `ctx.models` and `ctx.log`, and a failure is retried by the dispatcher.

## Where each kind of code goes

The template is laid out by kind of code, one folder per kind, and `sdxc make` writes each kind
to its folder:

<files title="links">
<folder name="bootstrap">
<file name="worker.ts" />
<file name="browser.ts" />
<file name="cli.ts" />
</folder>
<folder name="app">
<folder name="commands" />
<folder name="emails" />
<folder name="http">
<folder name="controllers" />
<folder name="middleware" />
<folder name="validators" />
</folder>
<folder name="initializers" />
<folder name="jobs" />
<folder name="mcp" />
<folder name="models" />
<folder name="policies" />
<folder name="services" />
<folder name="test" />
</folder>
<folder name="config" />
<folder name="database">
<folder name="factories" />
<folder name="migrations" />
</folder>
<folder name="resources">
<folder name="layouts" />
<folder name="locales" />
</folder>
<folder name="routes">
<file name="web.ts" />
<file name="api.ts" />
</folder>
<file name="cloudflare.config.ts" />
</files>

| If the code…                                                   | It goes in                                         |
| -------------------------------------------------------------- | -------------------------------------------------- |
| is the Worker, browser or command-line entry point             | `bootstrap/`                                       |
| builds the one instance of something: router, database, mailer | `app/initializers/`                                |
| answers HTTP: a controller, a middleware, an input schema      | `app/http/controllers`, `middleware`, `validators` |
| runs off the request, as a job                                 | `app/jobs/`                                        |
| is a tool or resource for the MCP endpoint                     | `app/mcp/`                                         |
| is an email the app sends                                      | `app/emails/`                                      |
| is a command for `sdxc run`                                    | `app/commands/`                                    |
| reads or writes stored state, or is a rule about one model     | `app/models/`, as the model or its method          |
| is a rule across models, or about none                         | `app/services/`                                    |
| decides who may do what                                        | `app/policies/`                                    |
| is a URL contract                                              | `routes/`                                          |
| is a migration or a test factory                               | `database/migrations/`, `database/factories/`      |
| is a view, layout, stylesheet or translation                   | `resources/`                                       |
| is static configuration: site settings, security headers       | `config/`                                          |
| is a test helper                                               | `app/test/`                                        |

Group a crowded folder by feature with the same name in every layer, such as
`app/jobs/bookmarks/` beside `app/services/bookmarks/`, and one search for `bookmarks/` finds the
whole feature. `sdxc doctor`'s `layout` check fails on a folder in `app/` outside this table,
and on an import from `bootstrap/`.

<note>
Code that knows nothing about your app, such as a parser or a client for a public API, belongs
in a package rather than in any of these folders; the `@sdxc` packages are that code for the
problems they solve.
</note>

## Where to go next

- [Generate files](/docs/sdxc/generate-files) — what each `sdxc make` kind writes, and what it
  edits to wire it in.
- [Wire the router](/docs/building-remix-apps/wire-the-router) — the router's middleware and
  mappings, package by package.
- [Background jobs and cron](/docs/data-and-background-work/jobs-and-cron) — the dispatcher and
  its handlers in full.
