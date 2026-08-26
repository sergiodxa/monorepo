# ADR-003: MCP Server For The Blog

## Status

**Accepted** - 2026-08-25

## Background

The blog publishes articles, tutorials, bookmarks, and glossary entries, and every one of them is already reachable by a machine — as HTML, as RSS, and in the sitemap. What none of those give an agent is a way to _ask a question_: RSS carries the most recent items in publication order, and an agent that wants the tutorial about a particular topic has to fetch the feed, guess from titles, and then fetch pages.

An MCP server closes that gap. Someone connects this blog to their own agent once, and from then on the agent can search the writing and read a post in full when the conversation calls for it, instead of relying on whatever it happened to memorize during training or on a general web search that may surface an outdated copy.

This is the first consumer of [`@pkg/mcp`](../ADR-036-model-context-protocol-server-package.md), and the smaller of the two planned: everything it exposes is public, so there is no credential to design and no write path to guard.

## Context

### Current State

| Situation                                        | Consequence                                                                                                        |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Content is reachable as HTML, RSS, and a sitemap | A machine can enumerate posts, but cannot ask for one                                                              |
| No search exists anywhere in the app             | `Post` has `findAll`, `findBySlug` and `findRelatedByTypeAndSlug`, and nothing that takes a query                  |
| `post_meta` is a key/value table                 | Title, excerpt, content and tags are rows, not columns                                                             |
| Publish state is computed in TypeScript          | `Post.isPublishedAt` decides it; SQL never filters on it                                                           |
| The app is SSR-only, with no `/api` surface      | Every global middleware assumes an HTML response                                                                   |
| Four content types with different shapes         | Articles and tutorials have content; bookmarks are a title and a URL; glossary entries are a term and a definition |

### What An Agent Needs

Three things, in the order it needs them: find the handful of posts relevant to a question, read one of them in full, and — occasionally — enumerate what exists in a category small enough to enumerate. Everything else the site does is for a person.

## Decision

Serve one anonymous MCP endpoint at `POST /mcp`, offering six read-only tools over the existing repositories, with a new `Post.search()` behind the search tool. Nothing is written, nothing is authenticated, and no unpublished content is reachable.

### 1. One Route, Anonymous

`POST /mcp`, mapped like any other controller: `router.map(routes.mcp, (ctx) => mcp.fetch(ctx))`. `GET` is refused with `405` by the package.

Passing `ctx` rather than `ctx.request` is what makes §6 below cheap — the handler runs under the app's own middleware, so a tool reads the database with the same `ctx.get(Database)` every other handler uses, and nothing about the MCP surface is configured twice.

Anonymous because the content is already public: every post this server can reach is served as HTML to anyone who asks, so a credential would protect nothing while stopping the thing the server exists for — somebody adding this blog to their agent without asking permission first. What that costs is a public endpoint that does real work per call, which §6 bounds.

### 2. Six Tools

| Tool                | Arguments                                                      | Answers                                                                 |
| ------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `search_posts`      | `query`, optional `type`, optional `tag`, `limit` (default 10) | Matching posts as title, type, slug, URL, excerpt, tags, published date |
| `list_posts`        | `type`, `limit` (default 20), `offset`                         | The same projection, newest first                                       |
| `get_post`          | `type` (`articles` \| `tutorials`), `slug`                     | The post's full Markdown, with its metadata                             |
| `list_bookmarks`    | `limit`, `offset`                                              | Title and target URL per bookmark                                       |
| `list_glossary`     | none                                                           | Every term with its slug                                                |
| `get_glossary_term` | `slug`                                                         | The term and its definition                                             |

`get_post` covers articles and tutorials only, matching the constraint the `post.tsx` controller already carries: those are the two types with a full-content page, and there is nothing for the tool to return for the others. A bookmark _is_ its title and URL, and `list_glossary` is short enough to return whole, so neither needs a search of its own.

Every tool declares `readOnlyHint: true`, so a client can run one without stopping to ask a person, and `openWorldHint: false`, since nothing here reaches past this server's own database. No tool declares `available`, so the list is identical for every caller and its `cacheScope` stays `public` — which is what lets §7's caching apply to the list itself and not only to the results.

Each tool answers with the post's canonical URL alongside its slug. An agent that quotes a post should be able to link it, and building that URL from a slug is knowledge the agent should not have to hold.

### 3. Search Reads Per Type And Matches In Memory, Not FTS5

`PostSearch.query()` reads each content type through its own repository — `ArticlePost.findAll`, `TutorialPost.findAll`, `GlossaryPost.findAll` — and matches in memory, the way `Feed.listActivity` already composes the activity list.

This is a change from the `LIKE` predicate this ADR originally specified, for two reasons. `post_meta` is a key/value table, so a `LIKE` search means a joined predicate over a metadata key set, and the repository's own comment notes that plain predicates are what the app's D1 adapter executes reliably; this app has no database test harness, so a new query shape could not be verified before shipping. Meanwhile the per-type reads are paths every page already exercises. The cost is transferring every published post's metadata per search instead of only the matches — a few hundred rows, the same order the feed page already pays.

The signature is the part meant to last. Replacing the internals with an FTS5 index changes `search.ts` and nothing that calls it, and that becomes worth doing once there is evidence about what the current matching misses.

Matching covers title, excerpt and tags, and results are ranked: a title hit sorts above a tag hit, which sorts above an excerpt hit, and ties break newest-first. Post bodies stay out of the match — including them multiplies the work for recall that mostly surfaces passing mentions, and a post whose subject appears in none of those three is mis-titled.

### 4. Preview Posts Are Invisible

The publish rule is the app's existing one: `published_at === null` means published, a past `published_at` means published, and a future one means preview. Every tool filters through `Post.isPublishedAt`, so a scheduled post is unreachable by search, by list, and by direct slug.

That last one is the case worth stating: `get_post` takes a slug, and an agent that learned a slug from somewhere else must not be able to read a draft with it. The check therefore lives in the tool, not only in the listing paths.

### 5. Posts Are Also Resources

The six tools are all model-invoked. A reader who wants to hand _one specific post_ to their agent has no slug to give `get_post` and nothing to browse, which is the gap resources close: a tool is chosen by the model, a resource is picked by the person.

Three declarations, over the URLs the app already serves:

| Resource       | Pattern                                    |
| -------------- | ------------------------------------------ |
| Article        | `https://sergiodxa.com/articles/:slug.md`  |
| Tutorial       | `https://sergiodxa.com/tutorials/:slug.md` |
| Glossary entry | `https://sergiodxa.com/glossary/:term.md`  |

The `https://` scheme, and the `.md` extension rather than relying on `Accept: text/markdown`, because [post.tsx](../../../apps/blog/app/http/controllers/post.tsx) already content-negotiates Markdown from both. The specification says to use `https://` only when the client can fetch and load the resource itself — here it can, so a client may read a post without this server in the path at all, and what the capability actually adds is the enumeration that puts the corpus in a picker. The extension rather than the header because it holds for every client regardless of what it sends.

Each resource declares a `list` enumerating published posts, so `resources/list` is the browsable set, and a `read` that goes through the same repository the tools use. That read must re-apply the publish rule: the HTTP route returns `403` for a draft, but the repository does not, so a scheduled post would otherwise be readable by anybody who guessed its slug — the same trap as `get_post` in §4.

Bookmarks stay tool-only. A bookmark is a title and somebody else's URL, so there is no content of ours to read.

### 6. The Route Skips The HTML Middleware, Not The Rest

The blog's global chain ends in things built for a person's page view. For `/mcp` the HTML renderer constructs a renderer nothing calls, the redirect middleware spends a KV read per request, and the session middleware parses a cookie no agent sends.

Introduce a path-prefix exemption in `bootstrap/app.tsx` and scope those middlewares to the HTML surface, so adding a second machine route later is one edit to a prefix list. This is the shape `apps/uptime` already uses for its own machine surfaces, arrived at for the same reasons.

What the route keeps is everything a tool actually needs, because `mcp.fetch(ctx)` receives the same `RequestContext` that chain wrote to. The exemption is about skipping wasted work, not about isolating the MCP surface from the app.

The database arrives through a new `database()` middleware mapped onto this route alone, rather than through `@pkg/service-container` the way every HTTP controller here resolves it. An MCP handler is called with a context and nothing else — its signature belongs to the package — so what it needs has to be _in_ that context. Scoping the middleware to this one route leaves every other handler resolving services exactly as before.

### 7. A Budget And A Cache

The endpoint is public, unauthenticated, and every search reads the whole published corpus's metadata, so it needs both.

**The budget** is a new `MCP_RATE_LIMITER` binding in `wrangler.jsonc` — sixty requests a minute per client address, spent by `@pkg/rate-limit` middleware on the route before the handler runs. A Cloudflare rate-limiter binding rather than a KV counter, because this endpoint bills nothing per call: a KV read plus write per counted request would cost several times the request being protected, so the protection would cost more than the abuse. `namespace_id` is Worker-local, so nothing has to be provisioned.

Sixty a minute is an abuse bound, not a product one — an agent answering a question makes a handful of calls and then thinks. Callers behind one egress share a bucket, which is the cost of having no credential to key on and the reason the limit is set well above real use. A deployment without the binding gets a pass-through rather than a refusal, so a deploy predating it keeps serving.

**The cache** is the existing `CACHE` KV namespace via `@pkg/kv-cache`, keyed by name and a hash of the arguments, with a five-minute TTL. Tool results go through a `toolMiddleware`, which is the one thing a request-level middleware cannot do — caching a result means seeing it. Resources cache explicitly in their `list` and `read`, since resources have no middleware layer.

Two properties worth stating because breaking either is silent. Entries are **shared by every caller**, which is only correct because this surface is anonymous and no tool declares `available`; adding a credential means the caller's identity has to enter the key. And a **failed call is never cached**, because `isError` usually means a slug that does not exist yet, and storing that would keep answering "not found" for the whole TTL after the post appears.

Caching pushed `waitUntil` into `App.Env`: the store defers its writes so a miss never waits on KV, which means the Worker's `ExecutionContext` has to reach it. `CACHE` is also typed as the platform `KVNamespace` rather than the app's `KVStore` contract, because its only consumer is the cache package, and that contract exists to keep repositories and services off the binding — a cache is neither.

### 8. Discovery Is A Page At The Same URL, Written As Markdown

MCP has no discovery mechanism for an anonymous server. A person adds the URL to their client by hand, so the endpoint needs somewhere to be found, and the obvious place is the endpoint itself: `GET /mcp` renders a page explaining what the server offers and how to point a client at it, while `POST /mcp` speaks the protocol.

One `form()` route rather than two paths, because both audiences arrive at the same string. Somebody handed `https://sergiodxa.com/mcp` is as likely to paste it into a browser as into a config file, and a 404 for the first of those is a bad answer to a reasonable act.

That makes the machine-path exemption method-aware: a `POST` here skips the session, the redirects and the auth resolver, and a `GET` keeps all three, because it is a page view like any other.

**The content is Markdown, one file per language.** The page is prose, so it is written the way a post is written and rendered the way a post is rendered, through the same `Typeset` reading rhythm and the same `MarkdownView`. It is not the post view itself, since that one builds its links from a post type and slug this page has neither of.

Writing it as Markdown also means it can be served _as_ Markdown, at `/mcp.md` or through `Accept: text/markdown`, exactly as a post can. A page about serving agents is a poor place to make that an exception, and the fenced snippets are easier to copy from the source than from the syntax-highlighted page.

**English and Argentine Spanish.** Language is chosen from `?lang=` first, then `Accept-Language`, matching exactly and then on the base tag, so `es`, `es-MX` and `es-419` all reach `es-AR`. There is one Spanish translation and there should be one: the regional tag says which Spanish it is written in, not which readers it is for. The chosen tag reaches `<html lang>`, which needed a `locale` prop on the blog layout.

The page shows no language chrome, neither a label naming the language nor a link to the other translation. Which one a reader gets is settled before the view runs, so either would be the only furniture on the page that exists to explain the page rather than the server. `?lang=` still resolves, so a translation can be reached and shared by hand, it is just not advertised.

Storing the content as prose gives up the guarantee the generated version had, that the page cannot describe a tool the server does not serve. A test restores it: it renders both languages and asserts every mapped tool's name appears in each, and it interpolates the rate limit from the constant the middleware enforces rather than repeating the number.

No `.well-known` document and no `<link rel>` in the document head. Neither is a thing any client reads, and inventing one advertises a convention nothing follows.

## Consequences

### Positive

- An agent can answer a question from this blog's actual writing, and cite the post it came from.
- Search exists as a repository method, so the site can use it later — there is no search page today, and this removes the reason there isn't one.
- The machine-path exemption gives the blog the boundary it lacks, so the next non-HTML route costs one line rather than a rethink.
- The whole surface is read-only and public, so the worst outcome of a bug is content that was already public being served differently.
- Resources cost almost nothing beyond enumeration, because the URLs they point at are ones the app already serves — and a client that fetches them directly never touches this endpoint.
- The cache is verified against a real KV namespace in the Workers pool, so "it caches" is asserted rather than assumed.
- The page reads like the rest of the blog, because it is written and rendered the same way, and it can be read as Markdown by the agents it describes.

### Negative

- A public endpoint that scans metadata per call is a new abuse surface, and the app gains its first rate-limiter binding to bound it.
- `LIKE` search has no ranking. Results come back newest first, not best first, which for a query matching many posts is close to arbitrary.
- Recall stops at titles, excerpts and tags. A post about a topic it never names in those three is unfindable, and nothing surfaces that to the agent — it sees an empty result, not a limited index.
- The handlers have no test coverage in this app, because they need a database and the blog has no harness for one. Only the wiring — which tools and resources are served — is asserted.
- The tool descriptions become part of how well this works, and they are prose that has to be revised by watching agents use it, not verified by a test.
- MCP handlers read the database from request context, which the app's own guidance forbids for HTML controllers. The reason differs — a package-owned signature rather than a preference — but a reader now finds two patterns in one app.
- Every search reads all published metadata. That is fine at this size and is the first thing to re-measure if the endpoint gets busy.
- The publish rule is now applied in three places: the HTML route, `get_post`, and every resource `read`. Each is a separate chance to forget it, and only the first is covered by the existing tests.

### Neutral

- Six tools is a large fraction of a small agent's tool budget. Consolidating `list_glossary` and `get_glossary_term` is possible later; keeping them apart is the clearer prompt today.
- Bookmarks are exposed as titles and URLs, which is all the blog stores.
- The endpoint returns Markdown, not HTML. That is what the database holds and what a model reads best.

## Implementation Plan

### Phase 1: Search

1. Add `Post.search()` to `app/repositories/post.ts`, matching `title`, `excerpt` and `tags` in `post_meta`, scoped by post type and filtered through `Post.isPublishedAt`.
2. Test it against a preview post, a tag-only match, and a query matching nothing.

Done when a search for a known tag returns the posts carrying it and no future-dated post.

### Phase 2: The Server

1. Add the machine-path exemption to `bootstrap/app.tsx` and scope the HTML middlewares to the HTML surface.
2. Add `mcp: post("/mcp")` to `routes/web.ts`, and build the handler with `createHandler` from `@pkg/mcp`.
3. Declare the six tools over the existing repositories, with each controller in its own file via `createTool` / `createToolController`.
4. Declare the three resources, each with a `list` over published posts and a `read` that applies the publish rule.

Done when a real client — Claude Code with the URL added — lists the tools and reads a post.

### Phase 3: Bounds And Discovery

1. Add the `MCP_RATE_LIMITER` binding and apply it to the route.
2. Cache tool results through a `toolMiddleware`, and resource lists and reads explicitly.
3. Serve the page at `GET /mcp`, from a Markdown file per language, with `/mcp.md` and `Accept: text/markdown` serving the source.

## Alternatives Considered

### 1. Expose A JSON API And Let Agents Use That

Add `/api/posts` and friends, and let an agent call them over HTTP.

**Rejected because**: an agent cannot discover what a REST API offers, what its arguments mean, or when to reach for it, so every user would have to describe the API to their own agent. That description is precisely what `tools/list` is. The two are not exclusive — the tools are thin enough that a JSON API could be added over the same repository methods — but building the API instead of the server does not achieve the goal.

### 2. Serve The Whole Corpus As One `llms.txt`

Publish every post as a single Markdown document and let agents fetch it.

**Rejected because**: it puts the entire blog into a context window to answer one question, gets worse with every post published, and is stale the moment it is generated. It is also not something an agent does on demand — it is a file a person pastes.

### 3. FTS5 From The Start

Create an FTS5 virtual table over post content, with triggers keeping it in sync.

**Rejected because**: it prices in a migration, write-path triggers, and a backfill before anything is known about how the search is actually used — including whether body-text recall matters at all. `LIKE` over three metadata keys is a few lines behind a repository method, and replacing it later changes one method's body. The cost of being wrong is small in this direction and large in the other.

### 4. Require A Token

Issue a key and ask people to configure it.

**Rejected because**: the content is public, so the token protects nothing that is not already served as HTML. What it would do is add a step between somebody hearing about this and using it, which is the only thing that decides whether it gets used.

### 5. Reuse The Existing Route Table Through One Generic Tool

Offer a single `fetch_page` tool taking a path.

**Rejected because**: it hands the model a URL space to guess at instead of a set of named capabilities, which is the failure mode MCP exists to fix. It also returns HTML that the model must re-parse, and it would make preview posts reachable by anyone who guessed a slug.

## References

- [ADR-036: Model Context Protocol Server Package](../ADR-036-model-context-protocol-server-package.md)
- [ADR-037: Resources In The MCP Package](../ADR-037-resources-in-the-mcp-package.md)
- [Model Context Protocol specification](https://modelcontextprotocol.io/specification)
- [ADR-019: Adapter-Based Rate Limiting Package](../ADR-019-adapter-based-rate-limiting-package.md)
- [ADR-032: KV Cache Package Rename](../ADR-032-kv-cache-package-rename.md)

## Current Progress

- [x] Phase 1: Search
- [x] Phase 2: The Server
- [x] Phase 3: Bounds And Discovery

## Notes

- The publish rule has to be applied in the tool, not only in the repository listing helpers. `get_post` reaches a post by slug, and that is the path a draft would leak through.
- `post_meta` is key/value, so nothing about search is a schema change: adding a searchable field means projecting one more value in `search.ts`.
- `limit` and `period` are stated twice: on the binding in `wrangler.jsonc` and as constants in `app/mcp/rate-limit.ts`. The binding reports neither back, so they are kept in step by hand.
- A post published or edited stays invisible for up to the cache TTL. That is the trade the TTL names, and it is the same staleness an RSS reader or a CDN already shows.
- The cache is keyed without any notion of who asked. Adding a credential to this endpoint without adding it to the key would serve one caller's answers to another.
- `/mcp` now has two audiences behind one path, so the middleware chain differs by method. A middleware added to the global chain without thinking about `htmlOnly` will run for agents too.
- The page's prose is written twice, once per language, and nothing but a test keeps the two saying the same thing. Adding a third language means a third file to keep in step.
- Tool names now live in prose as well as in the declarations. The test catches a rename, but only because it looks for every mapped tool's name in both files.
- Search transfers every published post's metadata per query. The cache absorbs the repeats within a conversation, so what remains is one such read per five minutes per distinct query — and the rate limit bounds how many distinct queries a caller can produce.
- Tool descriptions are prompts. `search_posts` and `list_posts` overlap enough that a model will sometimes pick the wrong one; the fix is in the wording of both, and it is worth checking against a real agent rather than against a test.
- The rate-limiter binding is new to this app. `namespace_id` is Worker-local and needs nothing provisioned, but `limit` and `period` live in `wrangler.jsonc` while the reasoning for the numbers belongs next to the route, the way `apps/uptime` keeps them.
- Caching a tool result caches an answer about published content. A post published moments ago stays invisible for the TTL, which is fine here and would not be for a status tool on a different app.
