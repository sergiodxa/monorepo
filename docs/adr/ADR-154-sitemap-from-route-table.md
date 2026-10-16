# ADR-154: Sitemaps Decide Every Route in the Route Table

## Status

**Proposed** - 2026-10-15

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

`route()` from `remix/routes` (`@remix-run/fetch-router` 0.22) returns a plain nested object.
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

Add a `@sdxc/sitemap/remix` entry point. Its `sitemap()` function takes the route table and an
object that decides every `GET` and `ANY` route in it. A route left out of that object is a
type error.

```ts
import { sitemap } from "@sdxc/sitemap/remix";

import routes from "~/routes/web";

export const SITEMAP = sitemap(routes, {
	feed: { priority: 1 },
	/** `findAll` answers newest first, so the first row dates the listing. */
	articles: async (ctx) => {
		let latest = (await ctx.models.articles.findAll({ includePreview: false })).at(0);
		return { updatedAt: latest ? new Date(latest.created_at) : undefined };
	},
	post: async (ctx) => {
		let [articles, tutorials] = await Promise.all([
			ctx.models.articles.findAll({ includePreview: false }),
			ctx.models.tutorials.findAll({ includePreview: false }),
		]);
		return [
			...articles.map((article) => ({
				params: { postType: "articles", postSlug: article.meta.slug },
				updatedAt: new Date(article.created_at),
			})),
			...tutorials.map((tutorial) => ({
				params: { postType: "tutorials", postSlug: tutorial.meta.slug },
				updatedAt: new Date(tutorial.created_at),
			})),
		];
	},
	colors: false,
	healthcheck: false,
	activityPub: false,
	cms: false,
	/** …and a decision for each of the table's remaining GET routes. */
});
```

### What each route accepts

| Route                      | Value                                                                                                    |
| -------------------------- | -------------------------------------------------------------------------------------------------------- |
| No params                  | `Sitemap.AppendOptions`, a function returning them, or `false`                                           |
| Params (`:slug`, `*path`)  | A function returning `{ params, ...Sitemap.AppendOptions }[]`, params typed from the pattern, or `false` |
| A nested map               | An object deciding each of its routes, or `false` for the whole subtree                                  |
| `POST`, `PUT`, `DELETE`, … | Not a key; only routes a crawler can request take a decision                                             |

- Optional groups such as `(.:ext)` are left out of the URL unless the entry passes their param,
  so `topic: get("/topics/:slug(.:ext)")` lists `/topics/<slug>`.
- A `form()` route is decided through its nested `index` route.
- Functions receive whatever context the caller passes, so a controller hands in its `ctx` and
  reads `ctx.models` the way its other handlers do.

### What `sitemap()` returns

A builder, not a controller. `SITEMAP.build(ctx, origin)` resolves every entry, turns each into an
absolute URL with `route.href(params)` against `origin`, and returns the `Sitemap` the base
entry already defines. The app's controller keeps its own response, caching and headers:

```ts
export default createAction(routes.sitemap, async (ctx) => {
	let document = await SITEMAP.build(ctx, ctx.url);
	return xml(document.toString(), { headers: { "Cache-Control": "public, max-age=3600" } });
});
```

### Package boundary

`@sdxc/sitemap` stays a format package: `.` reads and writes the protocol and depends on
neither Remix nor a router. The route-table helper is the `./remix` subpath, with `remix` as a
peer dependency, the same split `@sdxc/markdown` uses for its `./remix` entry.

## Consequences

### Positive

- **No page is forgotten** - adding a `GET` route to `routes/web.ts` fails `bun typecheck` until
  the sitemap includes it or excludes it with `false`.
- **Params are checked** - a function for `post` must return `postType` and `postSlug`, inferred
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

1. Add `src/remix/index.ts` with `sitemap()`, its decision types and `build()`.
2. Test it against a route table with static, param, optional-group, `form()`, `ANY` and nested
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

## References

- [Sitemaps protocol](https://www.sitemaps.org/protocol.html)

## Current Progress

- [ ] Phase 1: `@sdxc/sitemap/remix`
- [ ] Phase 2: Move the apps onto it
