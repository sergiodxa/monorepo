# ADR-006: The Reader Over the Model Context Protocol

## Status

**Accepted** - 2026-09-16

## Background

`apps/reader` is a web application: a person signs in through `auth.sergiodxa.com`, lands on
`/reading`, and works through a queue rendered as HTML. Everything it knows how to do is
already a typed RPC method on a Durable Object — `openReader`, `readingQueue`, `feedTimeline`,
`followFeed`, `markRead`, `saveItem` — with the Worker doing nothing but turning the answers
into markup.

`@sdxc/mcp` ([ADR-036](../ADR-036-model-context-protocol-server-package.md),
[ADR-037](../ADR-037-resources-in-the-mcp-package.md)) turns that same layer into something an
agent can call, as an ordinary `remix/router` route with no infrastructure of its own.
`apps/blog` already runs one. The reader is the harder consumer: the blog's server is
anonymous and read-only, and this one is neither — every answer belongs to exactly one person,
and half of what it offers writes.

## Context

### MCP substitutes for the interface rather than adding to it

The blog's MCP server is a second door onto a corpus anybody can already read. This one is
not. A person who wants their feeds inside an agent wants them _instead of_ a browser tab:
they will ask their assistant what is new, have it summarize what matters, and never load
`/reading` at all. That is not a power-user garnish — for that person it _is_ the product, and
they will subscribe for it alone.

This decides the tier before anything technical does. Premium is where the expensive things
go, and MCP is the cheapest thing the reader can offer: every tool is a query the web app
already runs against data the reader already stores, and the only new code is a projection and
a credential. Putting the cheapest feature behind the highest price would mean charging the
most for the least, and would price out exactly the person it was built for. **MCP is a
Paid-tier feature**, alongside the rest of what $5 a month buys.

It is not free-tier for the symmetric reason: an agent calls in a loop and a person does not,
so the one account shape that can generate unbounded load is the one paying nothing.

### The data model is already agent-shaped

[ADR-001](./ADR-001-rss-reader-on-per-user-durable-objects.md) put one reader's whole dataset
in one object addressed by their OIDC subject. Two properties of that matter here, and
neither was designed for it.

There is no cross-reader query anywhere in the app, so there is no parameter on any tool that
could name another person's data. Isolation is not a check this server has to get right; it
is a consequence of which object the credential resolved to.

And the RPC boundary rules — never a `Result`, never a `Date`, a discriminated union instead
of a throw — already produce values that are plain, structured and serializable. A tool
handler is a projection of one of those unions into JSON, which is the smallest thing an
adapter layer can be.

### An agent has no browser, and the session scheme assumes one

The app authenticates through `@sdxc/auth`'s session scheme: an OIDC authorization code
flow in a browser, an ID token and a refresh token stored in a KV-backed session, a signed
cookie, and a silent renewal when the access token lapses. Every step of that assumes a
user agent that can follow a redirect and hold a cookie.

An MCP client is a process reading a config file. Handing it the reader's session cookie
would hand it the whole web surface including the routes this ADR deliberately withholds, tie
the agent's life to a session the person can sign out of by accident, and give them a
credential with no name, no scope, and no way to revoke one holder without revoking all.

### What the provider does and does not offer

`auth.sergiodxa.com` ([ADR-038](../ADR-038-auth-sdk-package.md), served by `apps/r3-auth`)
publishes both discovery documents, a JWKS, an authorization endpoint, a token endpoint, and
`/oauth/introspect` and `/oauth/revoke`. It grants `authorization_code`, `refresh_token` and
`client_credentials`, supports PKCE, and issues ES256 JWT access tokens whose `aud` is the
client id and whose life is an hour.

Four things MCP's authorization flow needs are absent, and they are absent together. There is
no RFC 7591 dynamic client registration, and clients are administrator-created, always
confidential, and carry one exact-match redirect URI each — so a client expecting a loopback
redirect on whatever port it got cannot be registered at all, not even by hand. There is no
RFC 9728 protected-resource metadata, so nothing lets a client discover the authorization
server _from_ the reader. Resource indicators exist only on `client_credentials` and are
copied into `aud` unvalidated, so nothing audience-restricts a token granted to a person. And
the scope vocabulary is a hardcoded four — `openid`, `email`, `profile`, `offline_access` —
with anything else silently dropped, so `reader:read` cannot be asked for.

That is a project in another application gating a feature that is otherwise small in this one.
It is the constraint this decision is made against, stated here rather than discovered later.

### There is no control-plane database to look a token up in

`apps/uptime` already issues API keys: an opaque `uptime_<hex>` string, a SHA-256 of it in a
`api_keys` table, a scope list beside it, and a middleware that hashes what arrived and looks
it up. It works because that app has a D1 database every request can reach.

The reader deliberately has none. [ADR-001](./ADR-001-rss-reader-on-per-user-durable-objects.md)
put it plainly — no control-plane database at all, the OIDC subject addresses the object
directly — and [ADR-002](./ADR-002-canonical-feed-objects-and-lazy-reader-timelines.md) added
D1 only for the feed catalog, on the condition that the read path never touches it. An opaque
token would need a global index from a hash to a subject: exactly the table both ADRs refused,
on the hottest path this app has. So the credential has to answer "whose is this?" by itself.

### An agent is a caller this app has never had

Two things about it are new. It pays for what comes back in context tokens, which a browser
does not, so a page size chosen for a viewport is the wrong number for it. And it is bounded
by nothing: every request this app has served so far came from a browser somebody was waiting
in front of, while an agent in a retry loop, or one whose prompt told it to check for news
every thirty seconds, will simply keep going.

The timeline's keyset cursor is already opaque and already stable under concurrent
synchronization, so paging needs no rebuilding — only a decision about how much crosses at a
time, and how an opaque string survives a model that will try to read it. The loop needs a
limit, and the app has none today.

## Decision

Serve MCP at `POST /mcp` through `@sdxc/mcp`, authenticated by signed per-reader tokens the
reader mints for themselves, entitled against the `tier` column on their settings row, and
bounded by two limiters from `@sdxc/rate-limit`.

### Eleven tools and three resources

A tool is chosen by the model; a resource is picked by the person. The split is not a
taxonomy exercise — it decides whether something is reachable when nobody has a slug yet.

**Resources**, all under a `reader://` scheme:

| Resource                 | Lists as                 | Why a resource                                            |
| ------------------------ | ------------------------ | --------------------------------------------------------- |
| `reader://feeds/:feedId` | Enumerated instances     | A person attaches one feed; there is no argument to guess |
| `reader://posts/:itemId` | Template only            | Tens of thousands of posts is what templates exist for    |
| `reader://saved`         | Itself, one concrete URI | "Everything I kept" is one document, handed over whole    |

Those are ADR-037's three rows, one each. The scheme is custom rather than `https://`, which
is the opposite of the blog's answer and for the reason the blog gave: prefer `https://` only
when the client can fetch the resource itself. Here it cannot — every one of these is behind a
session cookie and scoped to one reader — so a URI is an identity rather than a fetchable
address and every read goes through `resources/read`. A post's resource carries the
publisher's own link, which is the address a client _can_ follow.

**Tools**, grouped the way one controller file owns one group:

| Tool              | Wraps                            | Annotations           |
| ----------------- | -------------------------------- | --------------------- |
| `read_timeline`   | `openReader` / `readingQueue`    | read-only             |
| `search_timeline` | `readingQueue` with `query`      | read-only             |
| `read_feed`       | `feedTimeline`                   | read-only             |
| `read_saved`      | `savedQueue`                     | read-only             |
| `list_feeds`      | `listFeeds`                      | read-only             |
| `get_feed`        | `getFeed` plus the feed's health | read-only, open-world |
| `mark_read`       | `markRead`                       | idempotent            |
| `mark_feed_read`  | `markFeedRead`                   | destructive           |
| `save_post`       | `saveItem`                       | idempotent            |
| `follow_feed`     | `followFeed`                     | open-world            |
| `unfollow_feed`   | `unfollowFeed`                   | destructive           |

`read_timeline` and `search_timeline` are two tools over one RPC method with an optional
`query`. A tool whose search term is optional gets called with an empty one when the model
means "everything", and a description is the only thing a model reads when choosing — so the
pair is spelled as two descriptions that each say when to reach for it. ADR-036's notes flag
exactly this pair as the one worth revising after watching an agent pick wrong.

`list_feeds` and the `reader://feeds/:feedId` enumerator run the same query and are not
redundant. The listing gives a person's picker a name and a URI; the tool gives a model unread
counts and velocities, which is what it needs to decide where to look. Same rows, two
audiences, and only one of them can be browsed.

There is no `get_post` tool, because a model holding an item id already has that post's fields
from the page that gave it the id; the resource exists for the person, who has neither until
they pick one. `get_feed` reaches the feed's own object for its health and measured posts per
day, the one RPC `/reading/:feed` already makes, and is marked open-world for it.

### Pagination

The cursor crosses as an opaque `string`, described in the schema as a value to pass back
verbatim and never to construct or parse, and comes back as `nextCursor`. `prevCursor` does
not cross at all: a backwards cursor is a scrolling affordance, and a model handed two picks
the wrong one — ADR-036's reason for keeping unions out of tool arguments. There is no
`offset` either, because the timeline moves under a reader who is away and offset paging
silently duplicates and skips where a keyset cursor cannot.

`{ ok: false, reason: "bad-cursor" }` becomes a `ToolError`, which is the one exception whose
message reaches the model. It says the page reference expired and to ask again without one,
because that is a thing the model can act on — and the alternative, answering the first page
silently, would look to an agent like a loop that never ends.

**Twenty posts a page, fifty at most.** A post's summary is already capped at 280 characters
by `MAX_SUMMARY_LENGTH`, so one post is roughly 120 tokens of title, excerpt, author, link
and dates. Twenty is about 2,500 tokens: a page a model can hold beside the rest of a turn.
Fifty is 6,000, which is already most of what anybody wants to spend on one tool call, so it
is the ceiling rather than the default. The browser's page size is larger and stays larger,
because bandwidth is cheap and context is not.

### Authentication: signed per-reader tokens

A reader mints a token from `/settings`, names it, chooses whether it may write, and copies
it once. It looks like `rdr_<payload>.<signature>`, where the payload is a Base64url JSON
object carrying the OIDC subject and a `tok_` TypeID, and the signature is an HMAC over it
under a Worker secret.

The token is self-describing, which is the same trick ADR-001 used to avoid a control-plane
database: **the name is the lookup**. Verifying the signature yields the subject with no
round trip, no KV read and no index that could go missing, and `env.USER.getByName(subject)`
reaches the object from there. The credential path costs nothing, and there is no table
anywhere that every reader shares.

What the payload deliberately does not carry is anything that can go stale. Not the scope,
not the tier, not an expiry the row disagrees with. All three live on a `tokens` table inside
the reader's own object — `id`, `name`, `scope`, `hash`, `created_at`, `last_used_at`,
`expires_at`, `revoked_at` — and are read on every request by one RPC:

```text
authorizeAgent(tokenId)
  -> { ok: true, scope, tier }
  |  { ok: false, reason: "unknown-token" | "revoked" | "expired" | "tier" | "budget" }
```

A discriminated union, per the boundary rules, so the middleware can tell an expired token
from an unpaid account and say the right thing about each. One call answers four questions —
is this token real, is it still allowed, is this account entitled, and is it inside its daily
budget — against an object the request was about to wake anyway.

**Revocation is immediate and costs nothing extra.** The reader stamps `revoked_at` from
`/settings`; the next request's `authorizeAgent` refuses, with no cache to invalidate because
the row is the only place the answer was ever read from. `last_used_at` is stamped at most
hourly, so a reader can recognize a token they forgot about without paying a write per call,
and `hash` is a SHA-256 of the signature segment so `/settings` can name a token without
holding anything replayable.

**Scope is two values, `read` and `write`.** A reader who wants an agent that summarizes
issues a read token; one that marks things read issues a write token. This is exactly where
ADR-036's `available` predicate belongs: a read token's `tools/list` omits the five writing
tools and `tools/call` reports them as unknown, so an agent never learns it could have
written and never tries. The middleware backstop stays, for a client working from a stale
list.

**Tokens expire after a year**, stamped in the row and checked there, because a credential in
a config file with no end is one nobody ever reviews. There is no refresh flow — there is no
browser to run one in — so an agent whose token expired starts failing and a person mints
another. Rotating the Worker secret invalidates every token at once: the blast radius, and the
emergency lever if one is ever needed.

**What this assumes of the provider**: only that it is the sole source of a reader's identity
and that the `sub` it issues is stable and never reassigned to another person — which
[ADR-001](./ADR-001-rss-reader-on-per-user-durable-objects.md) already depends on for the
object's name. Nothing else. No introspection call, no audience claim, no new client, no new
scope, no provider change at all. Minting a token needs a browser session, which is where the
provider does its work, and after that the provider is not on the path.

A `401` answers an absent or bad token, carrying `WWW-Authenticate: Bearer` so a client that
tried OAuth gets a refusal it can report rather than a hang. What it does **not** carry is a
pointer to protected-resource metadata, because publishing metadata that promises a flow
nobody can complete turns a clear failure into a confusing one.

**OAuth lands additively when the provider is ready.** The whole credential path is one
middleware producing a subject and a scope set, and `@sdxc/auth` already ships the other half
of it: `bearerScheme` and `ResourceServer` are built, verify a JWT against the cached JWKS,
and are used by nothing yet. `apps/reader` authenticates through a single-element `schemes`
array today, so an OAuth access token becomes a second entry in it rather than a second
server.

### Entitlement is read live, and refused out loud

The `tier` column [ADR-004](./ADR-004-background-freshness-checks.md) puts on the settings
row is the single place the answer lives, and `authorizeAgent` reads it on every request.
Never from the token: a token minted while paid would keep working after a cancellation until
it expired, which is a year of free service granted by a caching decision.

A free-tier account is refused at the route, with `403` and a sentence naming the upgrade page
— not by hiding every tool behind `available`. Hiding is right for scope, where the agent has
no business knowing; it is wrong for a paywall, because a server listing no tools reads as
broken rather than as unpaid, and the person debugging it is the person who might have paid.

### Two limiters, both from `@sdxc/rate-limit`

A `CloudflareAdapter` over a new `MCP_RATE_LIMITER` binding, **60 requests a minute**, as
route middleware keyed on the token id rather than on the client address — an agent's egress
is a datacenter shared with everyone else's. It is the burst catch: cheap, no storage, and it
stops a retry loop inside a minute.

A `DataTableAdapter` over the reader's own SQLite, **500 tool calls a day**, spent inside
`authorizeAgent` on the same wake. This is the one that bounds cost, because the Cloudflare
binding counts per location and an agent spread across regions slips it. It costs one row
written per MCP request, which is the honest price of per-account accuracy — the only kind
that bounds a per-account bill. Five hundred is ten times the workload modelled below, or one
call every three minutes sustained all day.

Both fail open, per ADR-019's default: a limiter that is down should not sign everybody out.

### MCP triggers a freshness check, on a first page only

`read_timeline` with no cursor calls `openReader`, which is the whole of ADR-002's
check — compare each subscription's cursor against the head its feed published, return the
page with what it found stale, and synchronize behind the response through `waitUntil`. An
agent asking for the timeline of a reader who has not opened the app in a week gets what a
person opening the app would get, which is the point of asking.

A call **with** a cursor checks nothing, which is not a new rule: ADR-002 already says paging
a frame is not opening the reader, and `lazy-frame` already relies on it. Applying it here
means an agent that pages through fifty posts pays for one check rather than three.

The cost is named rather than hidden: a check is one KV read per subscription, bulk-read in
one round trip, and it is the largest line in the model below — five times everything else put
together. It is also what the web app pays on every full page load, so this is not a new kind
of spending, only more of it. The throttle considered and not built is a minimum interval
between checks: it would have cut the dominant line, and it would have given an agent a
staler view than a browser gets, for a bound the daily budget already provides.

### What is not exposed, and why

| Withheld                            | Why                                                                                                                                                        |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `markAllRead`                       | One call empties a queue with no undo; a person clicks that where they can see it                                                                          |
| `importFeeds` / `exportFeeds`       | Import is a bulk write from a document the agent supplies; export hands the whole subscription list out in one call, which is the shape of an exfiltration |
| `setVelocity`                       | It is the one setting that deletes unread posts, so it is consent — and consent given to a model is not consent                                            |
| `checkFeedNow` / `checkAllFeedsNow` | An agent in a loop spends a publisher's bandwidth, not ours; freshness is pull and the timeline tool already triggers it                                   |
| `ensureUser`, account deletion      | Creating and destroying an account are not things a credential scoped to one account should reach                                                          |
| Anything about billing              | The tier is read to refuse, and never reported, never changed, and never named beyond the refusal                                                          |
| Anything about another reader       | There is nothing to withhold: no RPC takes a subject, so the only reader reachable is the one the token resolved to                                        |

The last row is worth stating positively. Cross-reader access is not prevented by a check that
could be forgotten; it is absent from the shape of the storage, and this server adds no
parameter that would reintroduce it.

### What one reader costs

Rates from `apps/uptime/app/lib/cost-rates.ts`, in cents. One tool call is one HTTP request,
since this revision has no batching and no stream.

| Per call        | Units | Rate      | Cents      |
| --------------- | ----- | --------- | ---------- |
| `workerRequest` | 1     | 3.0e-5    | 3.0e-5     |
| `workerCpuMs`   | 8     | 2.0e-6    | 1.6e-5     |
| `doRequest`     | 2     | 1.5e-5    | 3.0e-5     |
| `doDurationMs`  | 30    | 1.5625e-7 | 4.7e-6     |
| **Total**       |       |           | **8.1e-5** |

Two `doRequest`s: `authorizeAgent`, then the tool's own. No `kvRead` at all on the credential
path — that is what the self-describing token buys.

At **50 tool calls a day**, of which ten are first-page timeline reads, for a reader
following forty feeds:

| Line                                | Monthly units | Cents    |
| ----------------------------------- | ------------- | -------- |
| 1,500 tool calls                    | 1,500         | 0.12     |
| Freshness: 300 checks x 40 `kvRead` | 12,000        | 0.60     |
| Synchronization the checks trigger  | ~600 DO calls | 0.01     |
| **Total**                           |               | **0.73** |

**Under a cent a month, against a $5 subscription — about one part in seven hundred.** Storage
does not appear because it is unchanged: the reader has one object whether they read through a
browser or an agent, and MCP adds no row beyond a token. At the daily ceiling — 500 calls, all
first-page timeline reads, forty feeds — it is about 31 cents a month, six per cent of the
price, and that reader is visible in the logs. The ceiling exists so that number has a number.

The headline is the ratio, not the total. MCP is among the cheapest things in the Paid tier
because it reuses queries that already exist: nothing here fetches a feed, parses a document,
or stores a post that was not going to be stored anyway.

### Observability

Structured events through `@sdxc/logger`
([ADR-033](../ADR-033-wide-events-as-the-logging-contract.md)):

| Event            | Fields                                   |
| ---------------- | ---------------------------------------- |
| `mcp.authorized` | `tokenId`, `scope`, `tier`               |
| `mcp.refused`    | `reason`                                 |
| `mcp.tool`       | `tool`, `durationMs`, `isError`, `items` |
| `mcp.resource`   | `resource`, `found`                      |
| `mcp.token`      | `tokenId`, `scope`, `action`             |

Token ids, never token values; counts, never post contents. Tool failures ride inside a `200`,
so anything alerting on these routes counts `isError` rather than statuses.

## Consequences

### Positive

- A person can read, search, follow and mark their feeds without opening the app, which is a
  product for somebody who was never going to open it.
- Every tool is a projection of an RPC that already exists and is already tested. There is no
  second data path to keep correct — a schema, a credential, a projection.
- Cross-reader isolation needs no enforcement, because a token resolves to one object and no
  method takes a subject.
- Revocation and entitlement cannot go stale, because the only place either is read from is
  the row the reader's own object holds. A cancellation takes effect on the next call.
- The credential path costs no lookup at all — a signature verify and a `getByName` — and adds
  no table that every reader shares.
- Rate limiting, protocol, pagination and logging come from packages this monorepo already
  runs. The app contributes a tool table and eleven small handlers.
- Freshness works for an agent exactly as it does for a browser, with no second mechanism,
  because `openReader` already answers the question an agent is asking.

### Negative

- **Clients that only speak OAuth cannot connect.** A person has to use one that lets them set
  a bearer token in configuration. That is a real limit on who can use this, it is the price of
  not blocking on provider work, and it is the most likely reason this ADR gets revisited.
- A token in a config file is a credential a person can leak by pasting a file, and scope is
  the only thing between a leaked write token and somebody's subscription list.
- There is no refresh. A token expires after a year and the agent simply starts failing;
  nothing renews it and nothing warns first except a date on `/settings`.
- Rotating the signing secret signs out every agent everywhere, with no partial move.
- Every MCP request writes a row, for the daily budget, where a pure read would have written
  nothing. That is the honest price of a per-account limit.
- Freshness is five-sixths of the cost and grows with how many feeds a reader follows, so the
  most engaged readers are the most expensive over MCP exactly as they are in the browser.
- Six operations now have two callers, so a change to what marking a post read means has to be
  made in two places.
- An agent holding a stale `tools/list` can call a tool its scope no longer permits; the
  middleware refuses it, but as a protocol failure the model cannot act on.
- Tool descriptions are prompts, tuned by watching agents choose wrong rather than by review.

### Neutral

- The Paid tier gains a feature that costs it almost nothing, which improves the tier's margin
  rather than eroding it — the opposite of how features usually land.
- `reader://` URIs are unusable outside an MCP client, unlike the blog's `https://` ones.
  Nothing wanted them to be.
- A reader may hold several tokens with different scopes, capped at ten, the way `apps/uptime`
  caps its keys.
- Prompts and `subscriptions/listen` stay unimplemented for ADR-036's reasons, and nothing in
  this surface argues for either.

## Alternatives Considered

**MCP's OAuth flow against the existing provider.** The right destination, and the one the
specification assumes. It needs the five things the provider does not have, and they compound:
without dynamic registration and multi-redirect clients no MCP client can be registered at
all, so the rest never gets exercised. The design above is arranged so this lands additively
rather than as a rewrite.

**Opaque tokens in a shared table, as `apps/uptime` does it.** A well-understood shape with
working code to copy. It needs a global hash-to-subject index on the hottest path in the app,
which is the control-plane database ADR-001 exists without and ADR-002 kept off the read
path. Signing the subject into the token buys the same thing for a signature verify.

**Hand the agent the session cookie.** No new credential, no new table, works immediately.
It also grants the entire web surface including the routes this ADR deliberately withholds,
dies whenever the person signs out, and cannot be revoked for one agent without revoking
every browser the person is signed in on.

**Keep the token's scope and tier in its signed payload.** Verification answers everything with
no RPC, removing one `doRequest` per call. It also means a cancelled subscription works until
the token expires and a revoked token works forever, because there is nothing to consult. The
`doRequest` is 1.5e-5 cents; being wrong about who is paying is not.

**Index tokens in KV rather than signing them.** A `mcp:token:<hash> -> subject` key read per
request. It trades a signature verify for a KV read, makes the mapping something that can be
lost, and lets eventual consistency render a freshly minted token intermittently unknown — a
failure a person reports as "it didn't work, then it did".

**Make everything a tool, and skip resources.** Simpler by one concept. It also means a person
who wants to hand their agent one particular feed, or their saved shelf, has to describe it
well enough for a model to find it by searching — which is the problem resources remove.

**Make the timeline a resource.** It is the reader's main surface, so it looks like the thing
to address. A resource URI is an identity a client may store and hand to another tool, and a
timeline page is a query with a filter and a cursor over rows that move — addressing it would
publish a URI meaning something different every time it is read.

**Rate-limit on the client address only, as `apps/blog` does.** One limiter, no write per
request. An agent's address is a datacenter's, so the bucket is shared by every caller behind
it and bounds nobody's bill in particular — which is the only thing this limit is for, the
blog's protecting an anonymous endpoint instead.

## Tests

In the layout the app already uses: schema, projection and token-format paths in plain Vitest,
and the route, object and limiter paths in `*.workers.test.ts` with `@sdxc/cloudflare-mocks`.

| #   | Behaviour                                                                                  |
| --- | ------------------------------------------------------------------------------------------ |
| 1   | A request with no token is refused `401` carrying `WWW-Authenticate`                       |
| 2   | A token whose signature does not verify is refused, and no object is woken                 |
| 3   | A valid token resolves to the object named by its subject and no other                     |
| 4   | A revoked token is refused on the next call, with nothing cached in between                |
| 5   | An expired token is refused, and the reason is distinguishable from a revoked one          |
| 6   | A free-tier account is refused `403` and still sees that tools exist                       |
| 7   | A read-scoped token lists no writing tool, and calling one reports an unknown tool         |
| 8   | A read-scoped token working from a stale list is refused by the middleware backstop        |
| 9   | `read_timeline` with no cursor runs a freshness check; with a cursor it runs none          |
| 10  | A cursor returned by one call pages the next, and `prevCursor` never crosses               |
| 11  | An undecodable cursor answers a `ToolError` the model can act on, not the first page       |
| 12  | `limit` above fifty is refused by the schema before any handler runs                       |
| 13  | The sixty-first request in a minute is refused, keyed on the token rather than the address |
| 14  | The five-hundred-and-first call in a day is refused, and the count survives an isolate     |
| 15  | Both limiters failing open leave the server answering                                      |
| 16  | `unfollow_feed` takes the feed's posts and keeps its saved ones, per ADR-002               |
| 17  | `mark_read`, `save_post` and their inverses are idempotent across repeated calls           |
| 18  | `resources/list` enumerates the reader's own feeds, and never enumerates posts             |
| 19  | Reading a resource for an item this reader does not hold answers not-found                 |
| 20  | No tool or resource accepts an argument naming a subject                                   |
| 21  | An internal failure reaches `onError` and the model receives no database message           |
| 22  | Logged events carry token ids and counts, and no token value or post content               |

## Implementation

- [x] `@sdxc/mcp` dependency, `routes/web.ts` entry for `/mcp`, and the `GET` page explaining
      how to connect
- [x] `tokens` migration on `UserDO`, and `authorizeAgent` returning its discriminated union
- [x] Token minting, signing and verification, with `AGENT_TOKEN_SECRET` as a Worker secret
- [x] Token management on `/settings`: mint, name, scope, show last use, revoke — with copy in
      `app/locales/en.ts` and `app/locales/es.ts`
- [x] The credential middleware, its `401`/`403` answers, and the scope it publishes
- [x] `app/mcp/tools.ts`, `app/mcp/resources.ts`, and one controller file per group
- [x] `available` on the five writing tools, plus cursor and page-size handling
- [x] `MCP_RATE_LIMITER` binding in `wrangler.jsonc`, plus `bun run cf:typegen`
- [x] The daily budget through `DataTableAdapter`, and the tier gate reading
      [ADR-004](./ADR-004-background-freshness-checks.md)'s column
- [x] The events and the tests above
- [x] `AGENTS.md`, the README feature line, and the Paid-tier copy on the pricing surface

## References

- [ADR-001](./ADR-001-rss-reader-on-per-user-durable-objects.md) — the per-reader object and the RPC boundary rules these tools cross
- [ADR-002](./ADR-002-canonical-feed-objects-and-lazy-reader-timelines.md) — `openReader`, the freshness check and the keyset cursor this pages with
- [ADR-004](./ADR-004-background-freshness-checks.md) — the `tier` column the entitlement gate reads
- [ADR-036](../ADR-036-model-context-protocol-server-package.md) — the MCP package, its failure split and its `available` predicate
- [ADR-037](../ADR-037-resources-in-the-mcp-package.md) — resources, and which list a declaration lands in
- [ADR-038](../ADR-038-auth-sdk-package.md) — the auth SDK and the provider this app signs in against
- [ADR-019](../ADR-019-adapter-based-rate-limiting-package.md) — the adapters both limiters are built from
- [ADR-029](../ADR-029-pagination-package.md) — the cursor that crosses the protocol boundary
- [ADR-033](../ADR-033-wide-events-as-the-logging-contract.md) — the logging contract the events follow
- [blog ADR-003](../blog/ADR-003-mcp-server-for-the-blog.md) — the first MCP consumer, anonymous and read-only
