# ADR-094: Webmention Package

## Status

**Accepted** - 2026-09-24

## Background

[Webmention](https://www.w3.org/TR/webmention/) is a W3C Recommendation for telling a page
it was linked to. The linking site finds the linked page's endpoint and POSTs two URLs,
`source` and `target`. The receiver fetches `source`, confirms it really links to `target`,
and may then show it: a reply under the post, a like, a repost, or a plain mention. It is
how independent sites hold a conversation across domains, and it is how Bridgy delivers
responses from Mastodon, Bluesky and GitHub back to the page they were about.

`apps/blog` neither receives nor sends Webmentions. Nothing on its pages advertises an
endpoint, a post that links to another site notifies nobody, and a reply written on
somebody else's site never reaches the post it answers. ADR-009 lists Webmention among the
features `apps/blog-saas` deferred. The blog adopts it first, as the single-tenant case,
and blog-saas follows once the user rebuilds it.

## Context

### What the blog has today

| Area            | Current state                                                                                                         |
| --------------- | --------------------------------------------------------------------------------------------------------------------- |
| Post pages      | Only articles and tutorials have permalinks (`app/http/controllers/post.tsx`); bookmarks and glossary appear in lists |
| Deleted posts   | `ArticlePost.destroy` removes the rows, so a deleted post answers 404                                                 |
| Publishing      | `app/http/controllers/cms/*.tsx` write through the repositories; the only side effect is `ctx.cache.purgeLater`       |
| Scheduled posts | A future `published_at` becomes visible on read; no code runs when it arrives                                         |
| Background work | No `@sdxc/jobs`, no queue binding, no cron in `apps/blog/wrangler.jsonc`                                              |
| Rate limiting   | `app/mcp/rate-limit.ts` uses `@sdxc/rate-limit` with a `CloudflareAdapter` binding (`MCP_RATE_LIMITER`)               |
| `Link` headers  | None emitted; `<head>` carries only canonical, Open Graph and stylesheet links                                        |
| Microformats    | None; ADR-093 adds `h-entry` and `h-card` markup                                                                      |
| Body parsing    | `formData()` middleware in `bootstrap/app.tsx` consumes form bodies into `ctx.formData` before any controller runs    |

`apps/blog-saas/app/jobs/dispatcher.ts` is the working pattern for a queue-backed
dispatcher in this repository: `createJobDispatcher` with `cloudflare.queue(() => env.QUEUE)`,
handlers mapped lazily, and the worker's `queue` and `scheduled` exports delegating to it.

### What the repository already has

| Need                                           | Where it lives                                                                                     |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Parse fetched HTML once, walk it               | `@sdxc/html/document` (`parseDocument`), ADR-055                                                   |
| Read the source's `h-entry`, author, type      | `@sdxc/microformats` and its `./vocabulary`, ADR-093                                               |
| Render a stranger's `e-content` safely         | `HTML.sanitize` in `@sdxc/html`                                                                    |
| Refuse private hosts, cap redirects/bytes/time | `addressable`, `retrieve` and `readWithin` in `packages/distill/src/lib/limits.ts`, internal today |
| Parse and write RFC 8288 `Link` headers        | `parseLinkHeader` and `serializeLinkHeader` in `@sdxc/pagination`                                  |
| Background jobs, retries                       | `@sdxc/jobs`                                                                                       |
| Rate limits                                    | `@sdxc/rate-limit`                                                                                 |

Only `addressable` and the three limit constants are exported from `@sdxc/distill`; the
retrieval loop that re-checks every redirect hop and the byte-capped body reader are
private. Webmention needs exactly those, twice: the receiver fetches an arbitrary `source`,
and the sender fetches an arbitrary `target` and then POSTs to whatever endpoint that page
names, which may be an internal address.

### What the specification asks of an implementation

| Rule                                                                                                     | Consequence for the package                                                                      |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| The request is `application/x-www-form-urlencoded` with `source` and `target`                            | the receiver reads two fields from the already-parsed form                                       |
| Both must be `http(s)` URLs, and `source` must differ from `target`                                      | a synchronous `400` for either, before anything is queued                                        |
| The receiver should check `target` is a resource it accepts                                              | the app supplies an `accepts(target)` predicate, run synchronously                               |
| Verification should be asynchronous, answered with `202 Accepted` (or `201` with a status `Location`)    | the receiver answers `202` and the app enqueues a job; nothing fetches during the request        |
| Verification fetches `source` and looks for `target` as an exact link (`href`, `src`, …) in HTML         | the link check walks the parsed tree's URL-bearing attributes and compares resolved URLs exactly |
| A `410 Gone` source, or one that no longer links, deletes an existing mention                            | verification reports `gone` and `unlinked` as outcomes, distinct from a fetch failure            |
| A repeated `source`/`target` pair is an update                                                           | outcomes are keyed by the pair; storage upserts on it                                            |
| Receivers should bound redirects, response size and time                                                 | every fetch goes through the bounded retrieval                                                   |
| Discovery: `Link` header first, then the first `<link>` or `<a>` with `rel=webmention` in document order | discovery is one pure function over a `Response` and its body, testable without a network        |
| The endpoint URL resolves against the target's final URL after redirects, keeping its query string       | discovery returns an absolute URL                                                                |
| An empty `href` names the target page itself                                                             | handled as a relative URL, as the discovery tests require                                        |
| On update, the sender notifies both current and removed targets; on delete, every past target            | the sender computes the target set from the current links plus the targets already notified      |

The discovery rules are exercised by the 23 discovery tests on
[webmention.rocks](https://webmention.rocks/): `Link` headers with relative and absolute
URLs, odd casing, quoted and unquoted `rel`, multiple values in one header and across
several; `<link>` and `<a>` in each order; multi-valued `rel`; an endpoint inside an HTML
comment or escaped markup that must be ignored; an empty `href`; a `<link>` with no
`href`; an endpoint with a query string; and a target that redirects before its relative
endpoint resolves.

## Decision

Add `@sdxc/webmention`: parse and answer Webmention requests, verify a mention against its
source, discover endpoints and send mentions, with every outbound fetch bounded. Storage,
moderation and display stay in the app.

### Package name

| Name                         | Trade-off                                                                                            |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- |
| **`@sdxc/webmention`**       | The spec's own name, one word, what someone searching npm types                                      |
| `@sdxc/webmentions`          | Reads as the stored collection, which the package deliberately leaves to the app                     |
| `@sdxc/indieweb` (umbrella)  | One package for mf2, Webmention and Micropub; rejected in ADR-093 for coupling three release streams |
| Receiver and sender packages | Separates the halves, but they share the link check, the URL rules and the bounded fetch             |

`@sdxc/webmention` wins because the protocol is one spec whose two halves share their
rules, and subpath exports already let a site that only receives import only the receiver.

### Scope

The package includes:

- Reading a Webmention request and answering it (`202`, `201`, `400`)
- Verifying a mention: bounded fetch of `source`, exact link check, and a display-ready
  summary built from the source's microformats
- Endpoint discovery from a `Response`, and a bounded fetch-and-discover
- Sending a mention, and computing which targets a create, update or delete notifies
- `Link` header and `<link>` values advertising an endpoint

What stays out:

- Storing mentions, and the record of what was sent, lives in the app's database
- Moderation, blocklists and approval live in the app's CMS
- Queueing lives in `@sdxc/jobs`; the package returns what to enqueue
- Request rate limits live in `@sdxc/rate-limit`, configured by the app
- Microformats parsing lives in `@sdxc/microformats`
- The bounded retrieval lives in `@sdxc/distill`, exported for this package through a new
  `@sdxc/distill/retrieve` subpath

### Exports

#### `"."` — shared types and errors

```ts
export namespace Webmention {
	export interface Pair {
		source: URL;
		target: URL;
	}

	/** What a mention is, as Post Type Discovery reads the source entry. */
	export type Kind = "reply" | "like" | "repost" | "bookmark" | "mention";

	export interface Author {
		name: string | null;
		url: string | null;
		photo: string | null;
	}

	/** A verified mention, ready to store and render. */
	export interface Mention {
		kind: Kind;
		/** The entry's `u-url` when it has one, `source` otherwise. */
		url: string;
		author: Author | null;
		/** Sanitized by `HTML.sanitize` with the source as base, so it renders as it stands. */
		content: { html: string; text: string } | null;
		name: string | null;
		published: Date | null;
	}
}

/** A request the spec says to reject with 400: wrong media type, bad URLs, same URL, unaccepted target. */
export class WebmentionRequestError extends Error {
	override name = "WebmentionRequestError";
	readonly reason: "media-type" | "missing" | "invalid-url" | "same-url" | "target-not-accepted";
}

/** A fetch that did not finish: refused host, timeout, too many redirects, too large, 5xx. */
export class WebmentionFetchError extends Error {
	override name = "WebmentionFetchError";
	/** Whether retrying later can succeed, which is how a job decides between retry and ack. */
	readonly retryable: boolean;
}

/** An endpoint that answered a send with a status outside 2xx. */
export class WebmentionSendError extends Error {
	override name = "WebmentionSendError";
	readonly status: number;
}
```

#### `"./receiver"` — the endpoint and verification

```ts
import type { DOMDocument } from "@sdxc/html/document";
import type { MF2 } from "@sdxc/microformats";
import type { Result } from "@sdxc/result";

export namespace Receiver {
	export interface ParseOptions {
		/** The body the `formData()` middleware already read; the request stream is consumed by then. */
		formData: FormData;
		/** Whether this receiver takes mentions for `target`: a published post on this origin. */
		accepts(target: URL): boolean | Promise<boolean>;
	}

	export interface VerifyOptions {
		/** Sent on the source fetch, so a publisher can tell who is asking. */
		userAgent: string;
		/** @default 1_048_576 */
		maxBytes?: number;
		/** @default 5_000 */
		timeoutMs?: number;
		/** @default 5 */
		maxRedirects?: number;
	}

	export type Outcome =
		| { status: "linked"; mention: Webmention.Mention; document: MF2.Document; finalUrl: string }
		/** The source answered 410; an existing mention is deleted. */
		| { status: "gone" }
		/** The source answered and no longer links to the target; an existing mention is deleted. */
		| { status: "unlinked" };
}

/** Reads and checks a request; every failure is one the spec answers with 400. */
export function parseRequest(
	request: Request,
	options: Receiver.ParseOptions,
): Promise<Result<Webmention.Pair, WebmentionRequestError>>;

/** `202 Accepted`, with a status page `Location` when the app has one. */
export function accepted(location?: string | URL): Response;

/** `400 Bad Request` with the reason as plain text. */
export function rejected(error: WebmentionRequestError): Response;

/** Fetches `source` under bounds and decides what the pair now is. */
export function verify(
	pair: Webmention.Pair,
	options: Receiver.VerifyOptions,
): Promise<Result<Receiver.Outcome, WebmentionFetchError>>;

/** Whether a parsed page links to `target` by `href`, `src`, `poster` or `data`, compared after resolution. */
export function linksTo(document: DOMDocument, baseUrl: string, target: URL): boolean;

/** Builds the display summary from a source page's microformats, falling back to its `<title>`. */
export function summarize(document: MF2.Document, source: URL, target: URL): Webmention.Mention;
```

`verify` fetches with `Accept: text/html`, reads HTML sources through `parseDocument`, runs
`linksTo` and `summarize` over the one tree, and treats a non-HTML source the spec's way: a
JSON body links when a string value equals `target`, and a plain-text body when it
contains it. A 4xx other than 410 is `unlinked`, since the source is not serving the
mention; timeouts, refused redirects and 5xx are `WebmentionFetchError`s with
`retryable` set, so the job retries them and acks the rest.

#### `"./discover"` — endpoint discovery

```ts
export namespace Discover {
	export interface Options {
		userAgent: string;
		timeoutMs?: number;
		maxRedirects?: number;
		maxBytes?: number;
	}
}

/** The endpoint a response advertises: `Link` header first, then the first `<link>`/`<a>` in document order. */
export function endpointOf(response: Response, finalUrl: string): Promise<URL | null>;

/** Fetches `target` under bounds and discovers its endpoint; a private endpoint address is refused. */
export function discover(
	target: string | URL,
	options: Discover.Options,
): Promise<Result<URL | null, WebmentionFetchError>>;

/** The `Link` header value and the `<link>` attributes that advertise an endpoint. */
export function advertise(endpoint: string | URL): {
	header: string;
	link: { rel: "webmention"; href: string };
};
```

`endpointOf` reads the `Link` header through `@sdxc/pagination`'s `parseLinkHeader`, which
already lowercases relations and splits multi-valued `rel`, and reads the body only when
no header matched and the content type is HTML. `rel` must contain the token `webmention`
exactly, so `rel="not-webmention"` never matches. Markup inside comments and escaped text
never reaches the tree, so the false endpoints in the discovery tests are ignored by
construction. `discover` refuses an endpoint whose host `addressable` rejects, which is the
server-side request forgery the spec's security section warns senders about.

#### `"./sender"` — sending

```ts
export namespace Sender {
	export interface Options extends Discover.Options {}

	export type Delivery =
		| { status: "sent"; endpoint: URL; code: 200 | 201 | 202; location: string | null }
		| { status: "no-endpoint" };

	export interface Plan {
		/** Every target to notify now: current links plus those notified before and since removed. */
		targets: URL[];
	}
}

/** Discovers and POSTs one mention. */
export function send(
	pair: Webmention.Pair,
	options: Sender.Options,
): Promise<Result<Sender.Delivery, WebmentionFetchError | WebmentionSendError>>;

/** The outbound links of an entry's content, excluding the entry's own origin. */
export function outboundLinks(html: string, baseUrl: string | URL): URL[];

/** What a create, update or delete notifies, given what was notified before. */
export function plan(current: URL[], previous: URL[]): Sender.Plan;
```

`plan` is a set union, but naming it keeps the spec rule (removed links are notified too)
in the package rather than in each app. On delete the app calls `plan([], previous)` after
the post starts answering 410, so each receiver's verification sees the deletion.

### Usage

#### Receiving in `apps/blog`

```ts
import { accepted, parseRequest, rejected } from "@sdxc/webmention/receiver";

import { dispatcher } from "~/app/jobs/dispatcher";

/** Accepts a mention for a published post on this origin and queues its verification. */
export default createAction(routes.webmention, async (ctx) => {
	let parsed = await parseRequest(ctx.request, {
		formData: ctx.formData,
		accepts: (target) => Post.acceptsMentions(ctx.db, target),
	});
	if (isFailure(parsed)) return rejected(parsed.error);

	await dispatcher.enqueue(jobs.webmentions.verify, {
		source: parsed.data.source.href,
		target: parsed.data.target.href,
	});
	return accepted();
});
```

```ts
import { verify } from "@sdxc/webmention/receiver";

export default createJobHandler(jobs.webmentions.verify, async (ctx) => {
	let pair = { source: new URL(ctx.input.source), target: new URL(ctx.input.target) };
	let outcome = await verify(pair, { userAgent: USER_AGENT });
	if (isFailure(outcome)) {
		if (outcome.error.retryable) ctx.retry({ delay: "10 minutes" });
		ctx.ack(outcome.error.message);
	}

	if (outcome.data.status === "linked") {
		await Webmentions.upsert(ctx.db, pair, outcome.data.mention);
	} else {
		await Webmentions.markDeleted(ctx.db, pair);
	}
});
```

#### Sending from `apps/blog`

The endpoint and the CMS actions enqueue through the blog's `dispatcher`, imported the way
`apps/blog-saas` imports its own, since no test substitutes it. The CMS actions enqueue `webmentions.send` with the post id after a create, update or
delete. The handler reads the rendered content, computes the plan against the
`webmention_sends` rows for that post, enqueues one `webmentions.deliver` per target (so one
slow endpoint delays nobody), and records each delivery.

```ts
let current = outboundLinks(post.html, post.url);
let previous = await WebmentionSends.targetsFor(ctx.db, post.id);
let { targets } = plan(current, previous);
await dispatcher.enqueueMany(
	jobs.webmentions.deliver,
	targets.map((target) => ({ source: post.url, target: target.href })),
);
```

#### Files that change in `apps/blog`

| File                                                        | Change                                                                                                                         |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `wrangler.jsonc`                                            | queue producer/consumer, a cron trigger, and a `WEBMENTION_RATE_LIMITER` binding                                               |
| `bootstrap/worker.ts`                                       | `queue` and `scheduled` exports delegating to the dispatcher                                                                   |
| `app/jobs/` (new)                                           | `index.ts` job map, `dispatcher.ts`, `webmentions/{verify,send,deliver,scheduled}.ts`                                          |
| `database/migrations/0004_webmentions.sql` (new)            | `webmentions` (unique `source`,`target`; status `pending`/`approved`/`rejected`/`deleted`) and `webmention_sends`              |
| `routes/web.ts`, `bootstrap/app.tsx`                        | `POST /webmention`, behind a rate limit keyed on client IP and on the source host                                              |
| `app/http/controllers/webmention.ts` (new)                  | the receiving action above                                                                                                     |
| `app/http/controllers/cms/*.tsx`                            | enqueue `webmentions.send` after writes                                                                                        |
| `app/http/controllers/cms/webmentions.tsx` (new)            | moderation queue: approve, reject, block a domain                                                                              |
| `app/http/controllers/post.tsx`, `resources/views/post.tsx` | `Link: <…/webmention>; rel="webmention"`, approved mentions under the post                                                     |
| `resources/layouts/document.tsx`                            | `<link rel="webmention">` in `<head>`                                                                                          |
| `app/repositories/post.ts`                                  | `acceptsMentions(db, url)` for published article and tutorial URLs, and a `deleted_at` tombstone so a deleted post answers 410 |

### Abuse controls

The endpoint is anonymous by definition, so the blog bounds it in layers:

1. **Nothing fetches during the request.** The endpoint validates two URLs and queues a
   job, which removes the reflection attack where one POST makes the receiver fetch an
   arbitrary URL on the attacker's schedule.
2. **Rate limits** on the endpoint per client IP, and inside the verify job per source
   host, through `@sdxc/rate-limit`.
3. **Bounded fetches.** Public hosts only, re-checked on every redirect hop, five hops,
   one megabyte, five seconds.
4. **Moderation.** A verified mention is stored `pending` and shown only once approved in
   the CMS. Domains can be allowlisted (auto-approved) or blocked (dropped at the
   endpoint), and both lists live in the blog's database.
5. **Rendering.** Content goes through `HTML.sanitize`; author photos render with
   `referrerpolicy="no-referrer"` and fixed dimensions.

### Multi-tenant notes for `apps/blog-saas`

- The endpoint is per blog host (`https://<blog>/webmention`), so `accepts` resolves the
  target's host to the tenant and checks the post in that tenant's store.
- Mentions live in the tenant's own storage, beside its posts; the platform database holds
  none, so one tenant's mentions can never surface on another's page.
- Jobs go through the platform queue carrying the tenant id, and the verify handler
  writes through the tenant's Durable Object, the boundary that owns its data.
- Rate limits key on tenant plus client IP at the endpoint and tenant plus source host in
  the job, so a flood aimed at one blog spends only that blog's budget.
- Moderation and the allow/block lists are per tenant, in the blog-engine CMS.
- Sending uses the tenant's canonical host as `source`, custom domain included.

### Interoperability

Bridgy backfeeds responses from Mastodon, Bluesky and GitHub as Webmentions whose `source`
is a `brid.gy` page carrying the response as an `h-entry`, so the receiver handles them
like any other mention. Bridgy Fed can bridge the blog into the fediverse from the same
microformats and Webmentions. Both are context for this decision and need no code of their
own.

## Consequences

### Positive

- **Cross-site replies reach the post** - a response written anywhere that sends
  Webmentions, or relayed by Bridgy, appears under the post it answers
- **The blog notifies what it links to** - a post that cites someone else's article tells
  that article
- **Discovery is conformance-tested** - the webmention.rocks cases become a fixture table
  run against a pure function
- **Every outbound fetch shares one set of bounds** - the receiver, the sender and
  `@sdxc/distill` refuse the same hosts and stop at the same limits

### Negative

- **The blog gains a queue** - a queue binding, a consumer, a cron trigger and a dispatcher,
  which is new infrastructure for an app that had none
- **A moderation surface** - pending mentions need someone to approve them, and an
  unattended queue means responses never appear
- **Tombstones for deleted posts** - Webmention's delete semantics need a 410 page, so the
  blog changes from hard deletes to a `deleted_at` column
- **Bounded retrieval lives in a package named for articles** - `@sdxc/distill/retrieve`
  is an odd home for a generic fetch; a dedicated package would be a separate decision

### Neutral

- **Bookmarks cannot be sources yet** - they have no permalink page, so a bookmark sends
  no mention until it gets one
- **`@sdxc/pagination` as a dependency** - it holds the repository's `Link` header
  parser; moving that parser into its own package would change an import and nothing else
- **Scheduled posts need a cron** - a post with a future `published_at` sends its mentions
  from a cron job that picks up posts published since its last run

## Implementation Plan

### Phase 1: Expose the bounded retrieval

**Priority:** High
**Estimated Effort:** 1 hour

1. Add `"./retrieve"` to `@sdxc/distill` exporting `addressable`, `retrieve`,
   `readWithin` and the limits, with no behavior change

### Phase 2: Build the package

**Priority:** High
**Estimated Effort:** 1.5 days

1. Encode the webmention.rocks discovery cases as fixtures (headers plus body) and write
   the `endpointOf` table test first
2. Write receiver tests: request validation cases, exact-link matching (relative, fragment,
   `src`, `<a>` in comments), 410 and unlinked outcomes, JSON and text sources, redirect
   and size limits through MSW
3. Implement `./discover`, `./receiver` and `./sender`, then the README and root README row

### Phase 3: Receive in the blog

**Priority:** High
**Estimated Effort:** 1.5 days

1. Add the queue, the dispatcher and the worker exports, following the blog-saas pattern
2. Add the migration, the repository, the endpoint, the rate limits and the verify job
3. Advertise the endpoint in the `Link` header and `<head>`
4. Add the moderation page and render approved mentions on post pages
5. Build, migrate, deploy; send a test mention from webmention.rocks

### Phase 4: Send from the blog

**Priority:** Medium
**Estimated Effort:** 1 day

1. Add `deleted_at` and the 410 response for deleted posts
2. Add the `send`/`deliver` jobs, the CMS hooks and the scheduled-post cron
3. Verify with the webmention.rocks receiver tests

### Phase 5: Publish

**Priority:** Low
**Estimated Effort:** 30 minutes

1. Make `@sdxc/distill` and `@sdxc/microformats` public first, then this package

## Current Progress

- [x] Phase 1: Expose the bounded retrieval as `@sdxc/distill/retrieve`
- [x] Phase 2: Build the package
  - [x] The 23 webmention.rocks discovery tests as a fixture table run against `endpointOf`
  - [x] Receiver: request validation, exact-link matching, `gone`/`unlinked`, JSON and text
        sources, redirect, size and time bounds through MSW
  - [x] `./discover`, `./receiver`, `./sender`, README
- [ ] Phase 3: Receive in the blog
- [ ] Phase 4: Send from the blog
- [ ] Phase 5: Publish

## Notes

- Implementation: `@sdxc/distill/retrieve` also exports `follow`, which answers the last
  response of the chain whatever its status. `verify` and `discover` need it, since `410`,
  other 4xx and 5xx each mean something different to them; `retrieve` answers only a 2xx.
  `isAddressableHost` and `release` ride along.
- Implementation: `summarize` takes an optional fourth argument, the page's `<title>`,
  because an `MF2.Document` carries no title; `verify` passes the one it read from the tree.
  `Mention.name` is the entry's name only when Post Type Discovery calls it an article, so a
  note's implied name (its whole text) is never repeated as a title.
- Implementation: `linksTo` ignores fragments on both sides (`/post#comments` links to
  `/post`) and resolves against `<base href>` when the page has one. Discovery resolves
  against the final URL, as the discovery tests require.
- Implementation: `parseRequest` also rejects a `source` that `addressable` refuses (a
  private or literal-IP host) as `invalid-url`, since its verification could never succeed.
- Implementation: retryability. A refused host is final; a timeout, network failure or
  redirect chain over the limit (`DistillLimitError` from `follow`) is retryable; a body over
  the cap is final and a body cut off by the deadline is retryable; `5xx` and `429` answers
  are retryable. `discover` answers `null` for a target answering any other 4xx.
- Implementation: `Sender.Delivery.code` is any 2xx status as a `number`, since the
  specification treats every 2xx as success; `send` follows no redirect on the POST.
- Implementation: `outboundLinks` reads `<a href>` and `<area href>` and keeps each URL as
  written, fragment included, so the target a receiver checks is the exact link on the page.
- Implementation: the discovery fixtures live in `src/fixtures/discovery.ts`, transcribed
  from the live pages (headers and markup) on 2026-09-24; the site's source is
  `aaronpk/webmention.rocks` at `7b97198`, Apache-2.0. Test #23's redirect tokens are
  per-visit, so the fixture keeps the pair observed that day.

## Alternatives Considered

### 1. `@sdxc/indieweb`, one package for microformats, Webmention and Micropub

**Rejected because**: of the reasons in ADR-093. A receiver-only site would install a
Micropub request parser, and every Webmention fix would republish the microformats parser
under ADR-007's per-package release notes.

### 2. Verify synchronously in the request

Simpler, with no queue for the blog.

**Rejected because**: the spec recommends against it for good reason. A synchronous receiver
turns every anonymous POST into an outbound fetch of the caller's choosing, made while the
caller waits, and a slow source holds a request open for the whole timeout.

### 3. Use webmention.io as a hosted receiver

It receives, verifies and stores mentions, and the blog would fetch them from its API.

**Rejected because**: mentions would live in a third party's database, moderation would
happen in its dashboard, and the blog would still need the sender, the discovery rules and
the microformats reading for its own display. It also cannot carry over to blog-saas, where
each tenant needs its own store.

### 4. Copy the bounded retrieval into this package

**Rejected because**: two copies of the private-host check drift, and the first gap found in
one would stay open in the other.

## References

- [Webmention - W3C Recommendation](https://www.w3.org/TR/webmention/)
- [webmention.rocks - conformance tests](https://webmention.rocks/)
- [Bridgy](https://brid.gy/) and [Bridgy Fed](https://fed.brid.gy/)
- [RFC 8288 - Web Linking](https://www.rfc-editor.org/rfc/rfc8288)
- [ADR-009: Blog SaaS Platform](./ADR-009-blog-saas-platform.md)
- [ADR-054: Jobs Package With Queue Adapters](./ADR-054-jobs-package-with-queue-adapters.md)
- [ADR-055: HTML Package](./ADR-055-html-package.md)
- [ADR-093: Microformats2 Package](./ADR-093-microformats-package.md)
- [ADR-095: Micropub Package](./ADR-095-micropub-package.md)
