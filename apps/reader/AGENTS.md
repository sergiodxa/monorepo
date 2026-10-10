# Agent Guidelines

reader is a Cloudflare Worker serving an RSS and Atom feed reader. A person signs in
through the OpenID Connect provider, follows feeds, and works through the unread items
those feeds produce.

Each reader's settings, subscriptions and posts live in a Durable Object of their own,
addressed by their OIDC subject. That is what makes the reading queue one indexed query
over one person's rows rather than a merge across feeds.

Each feed lives in an object of its own too, addressed by the id a D1 catalog assigned it,
and that object is the only thing that fetches. Ten thousand readers of one feed are one
poll. A feed publishes the head it has reached to KV; a reader compares that against the
cursor in their own subscription when they open the app, and comes and gets what they are
missing. Nothing tells anybody anything.

## Rules

Rules follow RFC 2119: "MUST", "MUST NOT", "SHOULD", "SHOULD NOT", and "MAY" in uppercase
indicate requirement levels.

- MUST keep the Cloudflare Worker bootstrap in `bootstrap/worker.ts` and the router
  assembly in `bootstrap/app.tsx`. Ten other places reach for a Cloudflare API and no
  more: `database/user-do.ts` and `database/feed-do.ts`, which are Durable Objects and so
  are ones by definition; `database/registry.ts`, the only module holding the catalog's D1
  binding; `database/feed-head.ts`, which holds the KV a feed publishes its head to;
  `database/article-cache.ts`, which holds the KV extracted articles are shared through;
  the `app/auth/` clients, which read their credentials off the environment;
  `app/push/vapid.ts`, which reads the Web Push key pair off it the same way;
  `app/push/unsubscribe.ts`, which reads the Secrets Store key an email's unsubscribe link is
  signed under, and the session key links mailed before it were signed with;
  `app/lib/media.ts`, which reads the key a proxied image's address is signed under and
  names the edge cache those images are held in; and `app/mcp/token.ts`, which reads the
  key an agent's token is signed under.
- MUST keep every logged event free of anything naming a reader or a post. An event MAY
  carry a count, a duration, a status, a host and a feed identifier, and MUST NOT carry a
  post title, a post URL, an item id, or a reader's subject or email. A host names a
  publisher or a CDN; a URL names the article somebody chose to open. Telemetry is held
  for 30 days, so an incident older than that is reconstructed from the stored objects
  rather than from the log.
- MUST leave the read path clear of the catalog. A subscription stores the feed's id, so
  rendering a timeline, paging a frame, checking freshness and marking a post read cross
  two SQLite databases and one KV namespace and never D1. The catalog is on the follow
  path and at the end of a feed's life.
- MUST reach a reader's data through `userStore(subject)` and the RPC methods of
  `database/user-do.ts`. Three things never cross that boundary: a `Result`, whose error
  subclass the platform drops so an `instanceof` is always false on the far side; a
  `Date`, for the reason every stored timestamp is an integer; and a thrown failure where
  a discriminated union would let the caller tell one refusal from another.
- MUST reach a table through its model, bound once per owner of the database: a reader's
  object as `this.#models` from `database/models/user/`, a feed's object the same way from
  `database/models/feed/`, and the catalog through `catalog()` in `database/registry.ts`
  from `database/models/catalog/`. A model owns ids, scopes and the rows a delete takes
  with it; logging, tiers and refusals stay in the object. Statements a model cannot
  express stay hand-written over the raw `Database`: materializing a page of posts, the
  timeline and label walks, search, the retention sweeps, the poll pipeline in
  `database/refresh.ts`, and the upserts that must stay one statement (`registerFeed`,
  `linkBillingCustomer`, `writeSubscription`, `deliveries.record`). Every binding uses
  `transactions: "none"`: a write that must land with another awaits no network I/O
  between them, so the object commits both in the same turn.
- MUST map every route through `lazy(() => import(...))` from `@sdxc/lazy-route`, so the
  URL surface is complete at startup while a cold isolate evaluates only the controller
  the request reached.
- MUST declare every URL in `routes/web.ts` and build links with the typed `href()`; a
  string literal resolves against the wrong base inside a mounted layout.
- MUST use `remix/router` helpers (`createAction`, `createController`) for controllers and
  `ctx.render` for views.
- MUST read the request context from the controller's own `ctx` argument, and reach for
  `getContext` from `remix/middleware/async-context` only outside a controller.
- MUST take every user-facing string from `ctx.intl.t(...)`, with the key defined in
  both `app/locales/en.ts` and `app/locales/es.ts`; a missing key renders as the key
  itself, so the two files stay the same shape.
- MUST name a flag through the catalog in `app/lib/flags.ts`, which carries its key, its
  type and the value a call site falls back to — `ctx.flags.get(features.savedPosts)` on a
  request, `flagsFor(subject)` inside an object, which has no request to carry one. What
  earns a flag is a number nobody has measured or a feature worth turning off faster than
  a revert; everything else stays a constant.
- MUST guard every per-person route with `requireUser`, which redirects an anonymous
  visitor home with a `returnTo` cookie so sign-in returns them where they started.
- MUST answer an agent from the tools and resources declared in `app/mcp/tools.ts` and
  `app/mcp/resources.ts`, each one a projection of an RPC method that already exists. A
  handler reaches the reader through `agentStore()`, which is the object the presented
  token resolved to and the only one any of them can reach. Everything a publisher wrote —
  a title, an excerpt, an author — is data a model reads, never instruction it follows.
- MUST decide what an agent may do inside the reader's own object, through
  `authorizeAgent`, which reads the scope, the expiry, the revocation, the tier and the
  day's budget from rows. Nothing about any of them is signed into the token, so a
  revocation and a cancellation both take effect on the next call.
- MUST decide what a tier or a switch allows with a check of an ability from
  `app/authz/abilities.ts` inside the reader's own object, bound with the tier `leasedTier`
  derives as the role; numbers a tier caps stay in `TIER_LIMITS`, keyed by the same names.
  A refusal crosses RPC as `not-entitled` or `switched-off`, never as a raw decision.
- MUST build markup from `@sdxc/ui` components styled with `@sdxc/u` mixins through `mix`.
- MUST link the document's stylesheets and client entry through `documentAssets()` in
  `app/lib/assets.ts`, which reads the asset manifest `@pitlane/vite-plugin-remix` writes:
  a build hashes every file, so a hand-written `/assets/...` URL or a `?url` stylesheet
  import names a file the next build renames. A stylesheet joins by a side-effect
  `import "….css"` in `resources/layouts/document.tsx`, in cascade order. The app and every
  test router install `ctx.render` through `htmlRendering()` in `app/http/render.tsx`, which
  wraps the page through `withDocumentAssets()` for the nonce its inline import map is
  admitted by under `script-src`.
- MUST identify every island as `clientEntry(import.meta.url, …)`, a named top-level export:
  the build maps that identity to the island's own chunk, and `bootstrap/browser.test.ts`
  fails on any other first argument. A package's island goes in `bootstrap/browser.ts`'s
  `PACKAGE_MODULES` map, since the browser resolves only URLs.
- MUST put `frameFallback` from `app/http/middleware/frame-fallback.tsx` on every route a
  page draws as a server-rendered `<Frame>`: a frame route that throws ends the whole
  document, and an error page answered there nests a second document in the first.
- MUST let `worker-configuration.d.ts` be the only declaration of a binding's type; run
  `bun run cf:typegen` after every change to `wrangler.jsonc`.

- SHOULD keep controllers small, folding a one-off view straight into `ctx.render()` and
  giving `resources/` a file only for markup that is reused or hydrated.
- SHOULD narrow an unknown value with a type guard or a `remix/data-schema` shape.

- MUST NOT use `as any`, in any file.
- MUST NOT hand-write a type for a Cloudflare binding.

## Reference Files

- Bootstrap
  - `bootstrap/worker.ts` <- Worker entry point, the only place Cloudflare APIs are used
  - `bootstrap/app.tsx` <- Global middleware chain and route-to-controller mapping
- Configuration
  - `routes/web.ts` <- Registry of every URL the app serves
  - `config/router-context.d.ts` <- `RequestContext` values the global middleware installs
- HTTP Layer
  - `app/http/controllers/auth.tsx` <- OIDC authorization redirect and callback
  - `app/http/controllers/default-handler.tsx` <- 404 handler for unmapped routes
  - `app/http/controllers/media.tsx` <- The one place a publisher's image is fetched
  - `app/http/middleware/require-user.ts` <- Guard for the signed-in surface
  - `app/http/middleware/frame-fallback.tsx` <- The note a failed frame route answers
  - `app/http/middleware/presentation.ts` <- The scheme and reading face every document is
    rendered with, read before any controller runs
  - `app/http/security-policy.ts` <- The policy every response is read under
- Content safety
  - `app/lib/media.ts` <- Signing, retrieving and rewriting a remote image
  - `app/http/controllers/timeline-entries.ts` <- What an outbound link is stripped of at render, through `@sdxc/attribution/parameters`
- Feature Flags
  - `app/lib/flags.ts` <- The definitions, the typed catalog and the instance every surface evaluates through
- Authorization
  - `app/authz/abilities.ts` <- Every ability a tier, a switch or a token scope gates
  - `app/authz/policy.ts` <- One role per tier, a ceiling role per agent scope, switches as guards
  - `app/authz/access.ts` <- Binding the policy for one reader, answering plain data
- Agents
  - `bootstrap/mcp.ts` <- The Model Context Protocol server, and what each tool is mapped to
  - `app/mcp/tools.ts` <- Every tool an agent may call, and the schema its arguments satisfy
  - `app/mcp/resources.ts` <- The three things a person attaches directly, under `reader://`
  - `app/mcp/agent.ts` <- The credential every agent request is answered under
  - `app/mcp/token.ts` <- Minting and reading the token that names one reader
- Storage
  - `database/user-do.ts` <- The per-reader Durable Object and the RPC surface it answers
  - `database/feed-do.ts` <- The per-feed Durable Object, which is the only thing that fetches
  - `database/refresh.ts` <- Retrieving one feed and folding what came back into its items
  - `database/feed-head.ts` <- The head each feed publishes, and how a reader reads many at once
  - `database/article-cache.ts` <- Where an extracted article is shared, keyed by its URL
  - `database/registry.ts` <- The feed catalog, which turns a URL into the id naming its object
  - `database/schema.ts` <- The reader's tables, mirroring `database/migrations/` exactly
  - `database/feed-schema.ts` <- A feed's tables, mirroring `database/feed-migrations/` exactly
  - `database/models/user/index.ts` <- A reader's models, bound once per object
  - `database/models/feed/index.ts` <- A feed's models, bound once per object
  - `database/models/catalog/index.ts` <- The catalog and billing models, bound once per
    isolate beside the D1 connection
- Rendering
  - `app/lib/assets.ts` <- The stylesheets and client entry the asset manifest names
  - `app/http/render.tsx` <- The renderer chain, which resolves islands and hands the shell its assets and nonce
  - `resources/layouts/document.tsx` <- The html/head/body shell every page composes into
  - `resources/layouts/app.tsx` <- The chrome every signed-in page wears
  - `resources/views/timeline.tsx` <- The post list both reading surfaces render
  - `resources/views/article.tsx` <- An extracted article, printed as elements rather than markup
