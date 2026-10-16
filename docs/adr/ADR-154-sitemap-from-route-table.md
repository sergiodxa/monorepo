# ADR-154: Sitemaps Decide Every Route in the Route Table

## Status

**Implemented** - 2026-10-16

## Background

Every app that serves `/sitemap.xml` (the blog, uptime, the sdxc site and the `app` template
`sdxc create` writes) builds it by hand. Its controller appends one URL per page it remembers,
calling `routes.<name>.href()` to get each path. Those paths are type-safe, but the list of pages
is not: when a page is added to `routes/web.ts`, nothing points to the sitemap, and the page
stays out of search engines until someone notices.

The route table already names every URL the app answers. `@sdxc/sitemap` can read it, so a
sitemap can be checked against the table at compile time, the same way the router checks a
controller against its contract.

## Context

### What a route table is at runtime

`route()` from `remix/routes` (`@remix-run/fetch-router` 1.0) returns a plain nested object.
Each leaf is a `Route` with:

| Member    | What it gives                                                                                 |
| --------- | --------------------------------------------------------------------------------------------- |
| `method`  | `"GET"`, `"POST"`, … or `"ANY"`                                                               |
| `pattern` | The parsed `RoutePattern`, whose tokens mark each `:param`, `*splat` and optional `(…)` group |
| `href()`  | Builds the path from params, with params typed from the pattern                               |

`form(pattern)` expands to a nested map with an `index` (`GET`) and an `action` (`POST`) route.
Because the object's type keeps each route's method and pattern, the type system sees the
whole table too.

### Why listing every route automatically falls short

If the package took every `GET` route with no params, the blog's sitemap would gain `/colors`,
`/sponsor` (a redirect), `/.well-known/*`, `/activitypub/*`, `/nodeinfo/2.1`, `/healthcheck`,
`/frames/*`, `/mcp.md`, every feed, and the `auth` and `cms` trees. It would also still be
missing the pages that matter most, `post` and `topic`, which have params whose values only
the app's database knows. Whether a route is a page meant for search engines is the app's
decision, and only params can come from the app.

## Decision

Add a `@sdxc/sitemap/remix` entry point. Its `fromRoutes(routes, origin, decisions)` takes the
route table, the origin to resolve URLs against, and an object that decides every `GET` and
`ANY` route in the table. A route left out of that object is a type error. The sitemap
controller calls it inside its handler after running its own queries, so each decision is a
plain value and every query runs once:

```ts
import { xml } from "@sdxc/http/response";
import { fromRoutes } from "@sdxc/sitemap/remix";
import { createAction } from "remix/router";

import routes from "~/routes/web";

export default createAction(routes.sitemap, async (ctx) => {
	let [articles, tutorials] = await Promise.all([
		ctx.models.articles.findAll({ includePreview: false }),
		ctx.models.tutorials.findAll({ includePreview: false }),
	]);

	let sitemap = fromRoutes(routes, ctx.url, {
		feed: { priority: 1 },
		articles: { updatedAt: articles.at(0) && new Date(articles[0].created_at) },
		post: [
			...articles.map((article) => ({
				params: { postType: "articles", postSlug: article.meta.slug },
				updatedAt: new Date(article.created_at),
			})),
			...tutorials.map((tutorial) => ({
				params: { postType: "tutorials", postSlug: tutorial.meta.slug },
				updatedAt: new Date(tutorial.created_at),
			})),
		],
		colors: false,
		healthcheck: false,
		activityPub: false,
		cms: false,
		/** …and a decision for each of the table's remaining GET routes. */
	});

	return xml(sitemap.toString(), { headers: { "Cache-Control": "public, max-age=3600" } });
});
```

### What each route accepts

| Route                          | Value                                                                                       |
| ------------------------------ | ------------------------------------------------------------------------------------------- |
| No required params             | `true`, `false`, or `Sitemap.AppendOptions`                                                 |
| Required params                | `false`, or a list of `{ params, ...Sitemap.AppendOptions }`, params typed from the pattern |
| A nested map                   | An object deciding each of its routes, or `false` for the whole subtree                     |
| `POST`, `PUT`, `DELETE`, …     | Not a key; only routes a crawler can request take a decision                                |
| A pattern `href()` can't build | `false` only (a hostname pattern with params, a nameless `*`)                               |

- Optional groups such as `(.:ext)` are left out of the URL unless the entry passes their param,
  so `topic: get("/topics/:slug(.:ext)")` lists `/topics/<slug>`.
- A `form()` route is decided through its nested `index` route.
- Pages are listed in the order the table declares its routes, and each route's pages in the
  order given.
- `fromRoutes` returns the `Sitemap` the base entry defines, so the controller keeps its own
  response, caching and headers.

### Package boundary

`@sdxc/sitemap` stays a format package: `.` reads and writes the protocol and depends on
neither Remix nor a router. The route-table helper is the `./remix` subpath, with `remix` as a
peer dependency, the same split `@sdxc/markdown` uses for its `./remix` entry.

## Consequences

### Positive

- **No page is forgotten** - adding a `GET` route to `routes/web.ts` fails `bun typecheck` until
  the sitemap includes it or excludes it with `false`.
- **Params are checked** - every page listed for `post` must pass `postType` and `postSlug`, inferred
  from `/:postType/:postSlug(.:ext)`, so a renamed param breaks the build.
- **One shape for every app** - the blog, uptime, the sdxc site and the `app` template stop
  hand-rolling the same loop of `new URL(routes.x.href(), origin)` calls.

### Negative

- **Every non-page route is listed once** - the blog writes about 20 `false` entries, fewer where
  a whole subtree such as `cms`, `auth` or `activityPub` is excluded at once.
- **Type cost** - a mapped type over the whole route table, with params inferred per leaf, adds
  work to every typecheck of the file that declares the sitemap.
- **Runtime shape dependency** - the walk reads `method`, `pattern` and `href()` from each
  `Route`, so a change to that class in a Remix release can break the helper.

### Neutral

- **Hostname patterns** - a route whose pattern includes a hostname builds its own absolute URL,
  and `origin` is used only for path-only routes.
- **The app decides priority and frequency** - the package adds no defaults beyond what
  `Sitemap.append` already writes.

## Implementation Plan

### Phase 1: `@sdxc/sitemap/remix`

**Priority:** High

1. Add `src/remix/index.ts` with `fromRoutes()` and its `Decisions` type.
2. Test it against a route table with static, param, optional-group, `form()`, write-only and nested
   routes, plus type tests that a missing `GET` route and a wrong param fail.
3. Add the `./remix` export and the `remix` peer dependency, and document the entry in the
   README and the sdxc site's SEO guide.

### Phase 2: Move the apps onto it

**Priority:** Medium

Move the blog first, since it has the most routes to decide and the most param pages, then
uptime, the sdxc site and the `app` template, each in its own commit.

## Alternatives Considered

### 1. Include every static `GET` route automatically

Walk the table and list every `GET` route without params, with an `exclude` list.

**Rejected because**: a new route would join the sitemap without anyone deciding it should,
which is how `/healthcheck` or a frame endpoint would end up indexed. Requiring a decision
catches the same forgotten pages without that risk.

### 2. Mark routes in the route table itself

Annotate each route in `routes/web.ts` with a sitemap flag.

**Rejected because**: `remix/routes` has no place for metadata on a route, and the params of a
param page still come from the database, so the sitemap would be split across two files.

### 3. A test instead of a type

Keep the hand-written controllers and add a test that requests `/sitemap.xml` and compares it
to the route table.

**Rejected because**: a param page needs data in the test database to show up, and the failure
appears at test time rather than in the editor.

### 4. A builder whose decisions are functions of the request context

Declare the sitemap once at module scope, with a function per route that receives the request
context and runs its own query, and call `build(ctx, origin)` from the controller.

**Rejected because**: the functions' context type cannot be inferred alongside the route table
without an explicit type argument, and routes that share data (a listing page dated by its
newest post, and the posts themselves) would each query it. Calling `fromRoutes` inside the
handler lets the handler run each query once and pass plain values.

## References

- [Sitemaps protocol](https://www.sitemaps.org/protocol.html)

## Current Progress

- [x] Phase 1: `@sdxc/sitemap/remix`
- [ ] Phase 2: Move the apps onto it
  - [x] blog
  - [x] uptime
  - [x] sdxc site
  - [ ] `app` template
