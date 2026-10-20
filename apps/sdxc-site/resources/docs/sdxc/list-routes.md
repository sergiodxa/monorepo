---
title: List routes
description: Print every route your contracts declare with its controller and the middleware that runs for it, narrowed like rails routes, as a table or as JSON for an agent.
section:
    title: The sdxc command
    order: 2
order: 7
lastUpdated: 2026-10-19
outcomes:
    - "How to read the table `sdxc routes` prints"
    - "How to narrow the listing to one controller, method or contract"
    - "How to find the routes and controllers nothing wires yet"
---

A route's controller and the middleware that runs before it are spread across contracts,
initializers and chains. Print them together in one table to answer "what serves this URL"
without opening a file:

```bash
sdxc routes
```

It prints every route your contracts in `routes/` declare: its method, full pattern
and name, the controller the router maps it to, and the middleware that runs for it.

## Read the table

```text
Router app/initializers/router.tsx
  asyncContext(), log(logger), trace(), serverTiming(), noWWW(), trailingSlash(), wellKnown(…),
  getClientIP(), userAgent(), rateLimit(…), database(openDatabase()), models(…), previews(…),
  mailer(…)

routes/web.ts
  METHOD  PATTERN       NAME      CONTROLLER                          MIDDLEWARE
  GET     /             home      app/http/controllers/home.tsx       page
  GET     /robots.txt   robots    app/http/controllers/robots.ts
  GET     /sitemap.xml  sitemap   app/http/controllers/sitemap.ts
  ANY     /*path        notFound  app/http/controllers/not-found.tsx  page

routes/api.ts
  METHOD  PATTERN            NAME          CONTROLLER                              MIDDLEWARE
  GET     /api/health        api.health    app/http/controllers/api/health.tsx     api
  GET     /api/openapi.json  api.openapi   app/http/controllers/api/openapi.tsx    api
  ANY     /api/*path         api.notFound  app/http/controllers/api/not-found.tsx  api
  POST    /mcp               mcp           app/http/controllers/mcp.tsx            api
```

Each router's global middleware is listed once at the top, since every route it maps runs it
first, in that order. Then each contract gets a table:

- `METHOD` is the method the route answers; `ANY` answers every one.
- `NAME` is the route's key path in its contract, the one `routes.posts.show.href()` reads.
- `CONTROLLER` is the file the router maps the route to. A route no router maps shows
  `(not mapped)`.
- `MIDDLEWARE` holds the guards in `lazy()`'s second argument, then the controller's own chain,
  such as `page`.

`routes` reads your source and runs none of it, so it needs no bindings, no install and no
build. Anything it cannot follow, such as a route mapped through a helper, is reported on stderr
and the rest of the listing still prints.

## Narrow the listing

The options follow `rails routes`, and compose with each other and with `--json`:

- `-g, --grep <pattern>` keeps routes whose name, pattern, method or controller contains the
  text, ignoring case. A regular expression works too: `sdxc routes -g '^posts\.'`, and text
  that is no valid expression, such as `/posts/(:id)`, searches as plain text.
- `-c, --controller <path>` keeps the routes of one controller file or folder, with or without
  `app/http/controllers/` and the extension; `-c posts` lists every controller under
  `app/http/controllers/posts/`, and `-c posts/show` that one file.
- `--method <method>` keeps routes answering that method, in either case; a route declared
  without a method answers all of them, so it stays.
- `--contract <name>` keeps routes declared in one contract in `routes/`, written as `api`,
  `routes/api` or `routes/api.ts`.
- `--unused` keeps routes no router maps, and prints on stderr each controller file nothing
  loads.
- `--except-path <path>` leaves out the routes under a path by whole segments, so `/api` drops
  `/api/posts` and keeps `/apiary`; repeat it or list several, as `--except-path /api,/mcp`.
- `--sort <field>` orders the routes by `name`, `pattern`, `method` or `controller` instead of
  the order the contracts declare them in.
- `-E, --expanded` prints one block per route with every field, for a narrow terminal.

```bash
sdxc routes -g posts
sdxc routes -c admin/users --method post
sdxc routes --contract api -E
sdxc routes --except-path /api,/mcp --sort pattern
```

A narrowed table lists only the routers that map one of its routes. A filter that matches
nothing prints `No routes match.`, and `--unused` with nothing to report prints
`No unused routes found.`; both exit 0.

### The expanded view

```text
--[ Route 1 ]-----------------------------------------------------------------
Method                | GET
Pattern               | /robots.txt
Name                  | robots
Contract              | routes/web.ts
Router                | app/initializers/router.tsx
Controller            | app/http/controllers/robots.ts
Router middleware     | asyncContext(), log(logger), trace(), …
Guards                |
Controller middleware |
```

### Find what is left to wire

`--unused` answers two questions after a refactor or a hand-written route: which routes the
contract declares and no router maps, and which controller files nothing loads.

```bash
sdxc routes --unused
```

```text
routes/web.ts
  METHOD  PATTERN   NAME     CONTROLLER    MIDDLEWARE
  GET     /pricing  pricing  (not mapped)
app/http/controllers/old-pricing.tsx: no route maps this controller
```

Map the route or delete it, and map or delete the file.
[`sdxc make controller`](/docs/sdxc/make-controller) declares and maps a route in one step, so
it leaves nothing for `--unused` to find.

## As JSON

```bash
sdxc routes --json
```

`--json` prints the same routes as one array, each with `method`, `pattern`, `contract`, `name`,
`router`, `controller` (`{ file, export }`) and `middleware` (`router`, `guards` and `controller`,
each a list of `{ name, from }`), so an agent learns what serves a URL and where each middleware
comes from:

```text
{
  "method": "GET",
  "pattern": "/robots.txt",
  "contract": "routes/web.ts",
  "name": "robots",
  "router": "app/initializers/router.tsx",
  "controller": { "file": "app/http/controllers/robots.ts", "export": "default" },
  "middleware": {
    "router": [{ "name": "log(logger)", "from": "@sdxc/logger/middleware" }, …],
    "guards": [],
    "controller": []
  }
}
```

Diagnostics and `--unused` file reports go to stderr, so stdout is always one JSON array.
`sdxc routes --unused --json` gives an agent the mappings still to write.

## Where to go next

- [Make a controller](/docs/sdxc/make-controller) — add a controller and its route.
- [Check a project](/docs/sdxc/check-a-project) — `sdxc doctor` warns about unmapped routes
  in CI.
- [Wire the router](/docs/building-remix-apps/wire-the-router) — the router and middleware
  chains `routes` reads.
