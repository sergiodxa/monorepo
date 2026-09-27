# ADR-087: robots.txt Package

## Status

**Accepted** - 2026-09-24

## Background

[RFC 9309](https://www.rfc-editor.org/rfc/rfc9309) standardized the Robots Exclusion Protocol in
2022, 28 years after `robots.txt` came into use: how the file is grouped by user agent, how a
crawler picks its group, how `Allow` and `Disallow` patterns match (longest match wins, `*` and
`$` wildcards), how much of the file a crawler must read, and what an HTTP error fetching it
means. The per-page counterpart, the `robots` meta tag and the `X-Robots-Tag` header, is
documented by the search engines rather than an RFC, and is what a page says about itself once
fetched.

The repo reads and writes this family in four places that know nothing of each other.
`@sdxc/distill` parses `robots.txt` before extracting an article and reads `X-Robots-Tag` after;
`@sdxc/blog-engine` writes a `robots.txt` as a string template; `@sdxc/seo` writes the `robots`
meta tag; and `apps/reader` caches each origin's file. The repo's rule is that a format capability
gets its own package with `parse` and `stringify`, and this one has a parser buried in a
distiller and a writer buried in a template literal.

## Context

### Inventory

| Location                                                     | Lines | Reads / writes       | What it does                                                                 |
| ------------------------------------------------------------ | ----- | -------------------- | ---------------------------------------------------------------------------- |
| `packages/distill/src/lib/robots.ts`                         | 121   | reads `robots.txt`   | `robotsUrl`, `productToken`, `isAllowed(source, path, userAgent)`            |
| `packages/distill/src/index.ts` (`fetchRobots`, `distill`)   | ~40   | fetches `robots.txt` | Retrieves the file, answers `null` on any failure; refuses a disallowed path |
| `packages/distill/src/lib/limits.ts` (`mayArchive`)          | ~12   | reads `X-Robots-Tag` | `noarchive` (optionally bot-prefixed) turns off caching of the article       |
| `packages/blog-engine/src/syndication/controllers/robots.ts` | 26    | writes `robots.txt`  | `User-agent: *` / `Allow: /` / `Sitemap:` from a template string             |
| `packages/seo/src/lib/robots.ts`                             | 31    | writes meta `robots` | `robotsDirectives({ index, follow })` to `"noindex, follow"`                 |
| `apps/reader/app/lib/article.ts` (`robotsFor`)               | ~25   | caches `robots.txt`  | One fetch per origin per day, through `articleCache()`                       |
| `apps/reader/database/article-cache.ts`                      | 92    | cache keys and TTLs  | `robotsKey(origin)`, `ROBOTS_TTL = "24 hours"`                               |

`@sdxc/distill` is public and exports `isAllowed`, `productToken`, `robotsUrl` and `fetchRobots`,
so moving them is a change to a published surface. Only `apps/reader` consumes them in the repo.
No app other than those built on `@sdxc/blog-engine` (`apps/blog-saas`) serves a `robots.txt`;
`apps/blog`, `apps/uptime` and `apps/sdxc` serve none.

### What RFC 9309 asks, and where distill stands

| Rule                                                                                                          | distill today                                                   | Consequence for the package                                             |
| ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------- |
| A group is one or more `user-agent` lines followed by rules; groups naming the same agent combine (§2.1)      | combines them                                                   | same, over a parsed document rather than per call                       |
| The crawler matches its product token (`[a-zA-Z_-]+`) case-insensitively; no match falls back to `*` (§2.2.1) | matches the whole lower-cased line value against the token      | the line value is reduced to its product token before comparing         |
| Longest matching path wins; on equal length `Allow` wins (§2.2.2)                                             | same                                                            | same                                                                    |
| `*` matches any sequence, `$` anchors the end (§2.2.3)                                                        | compiles a `RegExp` per rule per call                           | a linear wildcard matcher, no regular expressions built from input      |
| Paths compare after percent-encoding normalization: non-ASCII encoded, unreserved escapes decoded (§2.2.2)    | compares raw strings                                            | both the pattern and the path are normalized first                      |
| `/robots.txt` itself is always allowed (§2.2.2)                                                               | not special-cased                                               | `isAllowed` answers `true` for it                                       |
| Lines end in CR, LF or CRLF; a UTF-8 BOM may lead (§2.2)                                                      | splits on `\r?\n`, keeps a BOM                                  | all three line ends, BOM dropped                                        |
| A crawler must parse at least 500 KiB (§2.5)                                                                  | refuses past 2 MiB, which then permits everything               | reads up to 500 KiB, parses the whole lines within it, ignores the rest |
| Follow at least five redirects (§2.3.1.2)                                                                     | follows five                                                    | same                                                                    |
| 4xx "unavailable": the crawler may access anything (§2.3.1.3)                                                 | allow all (401/403/429 via a refusal error, others via failure) | allow all, except `429`, which is treated as unreachable                |
| 5xx or network error "unreachable": assume complete disallow (§2.3.1.4)                                       | **allow all** (any failure answers `null`)                      | disallow all                                                            |
| Do not use a cached copy for more than 24 hours (§2.4)                                                        | the reader caches for 24 hours                                  | the fetch result carries the lifetime a cache should give it            |
| Records other than groups (`Sitemap`) are allowed and parsers may keep them (§2.2.4)                          | skipped                                                         | `sitemaps` and other records are kept                                   |
| `Crawl-delay` is not part of the standard                                                                     | skipped                                                         | parsed per group as a non-standard extension                            |

The 5xx row is a correctness bug, not a style difference: an origin whose `robots.txt` answers 503
is asking not to be crawled, and distill crawls it.

### The per-page directives

`X-Robots-Tag` carries the same comma-separated directives as the meta tag, optionally prefixed
with a bot name (`googlebot: noindex`), and some directives take a value (`max-snippet: 50`,
`unavailable_after: 2026-12-31`). distill's `mayArchive` reads one directive with a split that
works for `noarchive` and would misread a value-carrying directive; `@sdxc/seo` writes two
directives. Both sides are small, but they are the same grammar, and it belongs to the Robots
Exclusion family more than to SEO or to article extraction.

### AI crawler signals

Three newer conventions come up next to `robots.txt`:

| Convention                               | Shape                                                                 | Decision                                                       |
| ---------------------------------------- | --------------------------------------------------------------------- | -------------------------------------------------------------- |
| Content Signals (`Content-Signal:` line) | A record inside `robots.txt`: `search=yes, ai-input=yes, ai-train=no` | parsed and written by this package, as a typed group record    |
| IETF AI Preferences (`aipref`)           | A vocabulary with a `robots.txt` attachment, still a draft            | tracked; the generic record list carries it until it is an RFC |
| `ai.txt`                                 | A separate file with its own format                                   | out of scope                                                   |
| `llms.txt`                               | A Markdown site map for models, not an exclusion mechanism            | stays in `apps/sdxc` (`app/services/llms.ts`)                  |

## Decision

Add `@sdxc/robots`: parse, write and evaluate `robots.txt` per RFC 9309, fetch it with the RFC's
status rules, and parse and write the per-page `robots` directives. Move distill's parser and the
blog-engine template onto it.

### Package name

| Name                       | Trade-off                                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------------- |
| **`@sdxc/robots`**         | Covers the file and the per-page directives under the word both share                             |
| `@sdxc/robots-txt`         | Exact for the file, and wrong the moment `./directives` exists                                    |
| `@sdxc/robots-exclusion`   | The RFC's title, precise, and a name nobody types when looking for it                             |
| Keep it in `@sdxc/distill` | No new package, but `@sdxc/blog-engine` would depend on an article extractor to write three lines |

`@sdxc/robots` wins: it is the name the RFC's title shortens to in every crawler's code, and it
stays accurate across both subpaths.

### Scope

The package includes:

- `parse` and `stringify` for `robots.txt`, keeping groups, sitemaps, `Crawl-delay`,
  `Content-Signal` and any other record
- `isAllowed` and `crawlDelay` over a parsed document, per RFC 9309 matching
- `fetchRobots`, which applies the RFC's size, redirect and status-code rules and reports an
  outcome a cache can store
- `./directives`: parse and write `X-Robots-Tag` and meta `robots` values

Out of scope, and where each lives instead:

- Caching fetched files lives in the caller: `apps/reader` keeps `articleCache()` and its keys
- The `<meta name="robots">` element lives in `@sdxc/seo`, which builds its content with
  `./directives`
- Sitemaps themselves live in `@sdxc/sitemap`
- `llms.txt` lives in `apps/sdxc`
- Serving `/robots.txt` and `/.well-known/*` routing live in each app, and in `@sdxc/well-known`
  ([ADR-083](./ADR-083-well-known-package.md)) for the latter

### Exports

#### `"."`

```ts
export namespace Robots {
	export interface Rule {
		allow: boolean;
		pattern: string; // as written, e.g. "/private/*.pdf$"
	}

	export interface Group {
		userAgents: string[]; // product tokens as written, "*" for the wildcard group
		rules: Rule[];
		/** Non-standard, seconds; the last value in the group wins. */
		crawlDelay?: number;
		/** Content Signals for this group: search, ai-input, ai-train, and any other key written. */
		contentSignals?: Record<string, boolean>;
	}

	/** A record that is neither a group line nor a sitemap, kept so stringify round-trips it. */
	export interface Record {
		name: string; // lower-cased field name
		value: string;
	}

	export interface Document {
		groups: Group[];
		sitemaps: string[];
		records: Record[];
	}

	export interface ParseOptions {
		/** @default 512_000 */
		maxBytes?: number;
	}
}

/** Reads any text as robots.txt. Lines that are not records are skipped, as §2.2 requires. */
export function parse(source: string, options?: Robots.ParseOptions): Robots.Document;

/** Writes groups, then sitemaps, then other records, one field per line, LF line ends. */
export function stringify(document: Robots.Document): string;

/** Whether an agent may fetch a URL: its product token's groups, or `*`, longest match. */
export function isAllowed(robots: Robots.Document, userAgent: string, url: string | URL): boolean;

/** The Crawl-delay of the group that applies to an agent, in seconds. */
export function crawlDelay(robots: Robots.Document, userAgent: string): number | undefined;

/** The token a user-agent line is compared against: "SergioReader/1.0 (+https://…)" gives "sergioreader". */
export function productToken(userAgent: string): string;

/** The origin's robots.txt URL for any URL on it. */
export function robotsUrl(url: string | URL): string;
```

`parse` returns a document rather than a `Result`. RFC 9309 defines no invalid file: a parser
skips what it cannot read, and a file of HTML parses to a document with no groups, which permits
everything. A `Result` here would have a failure branch no caller could reach.

#### `"./fetch"`

```ts
import type { Robots } from "@sdxc/robots";

export namespace RobotsFetch {
	export type Outcome =
		| { status: "parsed"; document: Robots.Document; lifetimeMs: number }
		| { status: "unavailable"; httpStatus: number; lifetimeMs: number } // 4xx: allow all
		| { status: "unreachable"; httpStatus: number | null; lifetimeMs: number }; // 5xx, 429, network: disallow all

	export interface Options {
		userAgent: string;
		timeoutMs?: number; // @default 10_000
		maxBytes?: number; // @default 512_000
		maxRedirects?: number; // @default 5
		signal?: AbortSignal;
	}
}

/** Fetches an origin's robots.txt; every outcome is a decision, so none is a failure. */
export function fetchRobots(
	url: string | URL,
	options: RobotsFetch.Options,
): Promise<RobotsFetch.Outcome>;

/** isAllowed over an outcome: parsed documents are evaluated, unavailable allows, unreachable refuses. */
export function isAllowedBy(
	outcome: RobotsFetch.Outcome,
	userAgent: string,
	url: string | URL,
): boolean;
```

The request sends the caller's `User-Agent`, `Accept: text/plain`, no credentials, and walks
redirects itself with `redirect: "manual"` so the count is enforced. The outcome is plain data, so
a caller stores it as JSON and evaluates it later. `lifetimeMs` is 24 hours for `parsed` and
`unavailable`, per §2.4, and one hour for `unreachable`, so a brief outage does not keep an
origin disallowed for a day. The RFC's 30-day rule (an origin unreachable for a month may be
crawled as if it had no file) needs history only the cache holds, so it stays with the caller.

#### `"./directives"`

```ts
export namespace Directives {
	export interface Set {
		/** The bot the set is scoped to, lower-cased; null for a set that applies to every bot. */
		botName: string | null;
		noindex: boolean; // "none" sets both noindex and nofollow
		nofollow: boolean;
		noarchive: boolean;
		nosnippet: boolean;
		noimageindex: boolean;
		notranslate: boolean;
		maxSnippet?: number;
		maxImagePreview?: "none" | "standard" | "large";
		maxVideoPreview?: number;
		unavailableAfter?: Date;
		/** Directives outside the list above, lower-cased, e.g. "noai". */
		other: string[];
	}
}

/** Reads one header or meta value, splitting bot-scoped sets. Unknown directives land in `other`. */
export function parseDirectives(value: string): Directives.Set[];

/** Merges every X-Robots-Tag on a response into the set that applies to one bot (its own plus the unscoped ones). */
export function directivesFor(response: Response, userAgent: string): Directives.Set;

/** Writes a set; `explicit` spells out "index, follow" instead of omitting defaults. */
export function stringifyDirectives(
	set: Partial<Directives.Set>,
	options?: { explicit?: boolean },
): string;
```

### Usage

#### `@sdxc/distill`

`packages/distill/src/lib/robots.ts` is deleted. The `robots` option accepts a fetch outcome, and
`fetchRobots` in distill becomes the `./fetch` one:

```ts
import { isAllowedBy } from "@sdxc/robots/fetch";
import { directivesFor } from "@sdxc/robots/directives";

if (options.robots !== undefined && !isAllowedBy(options.robots, options.userAgent, address.data)) {
	return failure(new DistillRefusedError(`Refused ${input}: robots.txt disallows it`));
}

mayCache: !directivesFor(retrieved.data.response, options.userAgent).noarchive,
```

`mayArchive` goes, and with it the per-call regular expressions.

#### Reader

`apps/reader/app/lib/article.ts` caches the outcome instead of the text, with the lifetime the
outcome carries:

```ts
import { fetchRobots } from "@sdxc/robots/fetch";

async function robotsFor(url: string): Promise<RobotsFetch.Outcome | undefined> {
	let origin = new URL(url).origin;
	let cache = articleCache();

	let held = await cache.read<RobotsFetch.Outcome>(robotsKey(origin));
	if (isSuccess(held) && held.data !== null) return held.data;

	let outcome = await fetchRobots(origin, { userAgent: EXTRACTION_USER_AGENT });
	await cache.write(robotsKey(origin), outcome, { ttl: outcome.lifetimeMs });
	return outcome;
}
```

`@sdxc/cache`'s `fetch` takes one fixed `ttl`, so the reader reads and writes in two steps, and the
lifetime is the package's decision. `ROBOTS_TTL` in `database/article-cache.ts` is deleted.

#### `@sdxc/blog-engine`

```ts
import { stringify } from "@sdxc/robots";

let body = stringify({
	groups: [
		{
			userAgents: ["*"],
			rules: [
				{ allow: true, pattern: "/" },
				{ allow: false, pattern: "/cms" },
				{ allow: false, pattern: "/auth" },
			],
		},
	],
	sitemaps: [new URL("/sitemap.xml", origin).toString()],
	records: [],
});
return text(body);
```

The CMS and auth routes gain `Disallow` rules while the file is being touched: they sit behind a
login, and a crawler following a stray link to them only collects redirects.

#### `@sdxc/seo`

`robotsDirectives` becomes `stringifyDirectives({ noindex: !index, nofollow: !follow }, { explicit: true })`,
keeping its output byte for byte.

## Consequences

### Positive

- **Origins that are down stop being crawled** - the 5xx rule, the one real bug in the current
  parser, is fixed at the source
- **One grammar, two directions** - the parser that decides and the writer that publishes share
  tests, so a file the blog writes is a file the reader reads as intended
- **Parse once** - the reader evaluates a stored document instead of re-parsing text on every
  article open
- **No regular expressions from untrusted input** - the matcher is linear in the path length
- **AI signals have a home** - Content Signals are written and read in one place, and a future
  `aipref` attachment has a record list to arrive in

### Negative

- **A published API moves** - `@sdxc/distill`'s `isAllowed`, `productToken`, `robotsUrl` and
  `fetchRobots` change module and, for `fetchRobots`, return type
- **`429` departs from the RFC's letter** - the RFC files it under "unavailable, allow all";
  treating it as unreachable is permitted (the RFC's allowance is a MAY) and is what the origin
  asked for, but it is a choice a reader of the RFC will notice
- **The per-page directives are a moving target** - search engines add directives without a
  standard, so `Directives.Set` will gain fields, and `other` catches the gap until then

### Neutral

- **The reader's cache entries change shape** - old text entries expire within a day; the key
  prefix changes (`robots:v2:`) so no reader of the new shape meets an old value
- **Output of `robotsDirectives` is unchanged** - `@sdxc/seo` consumers see nothing

## Implementation Plan

### Phase 1: Specify and build the package

**Priority:** High
**Estimated Effort:** 5 hours

1. Write the tests first: the RFC's own examples in §5; product-token matching with version
   suffixes; group merging; longest match and `Allow` ties; `*` and `$`; percent-encoding
   normalization in both directions; `/robots.txt` always allowed; CR, LF and CRLF files with a
   BOM; a file past 500 KiB truncated at a line boundary; `Sitemap`, `Crawl-delay` and
   `Content-Signal` round-trips; every status class in `fetchRobots` (MSW), including five and six
   redirects
2. Write `./directives` tests from the documented directive lists, bot-scoped sets, and
   `unavailable_after` dates
3. Implement, then README and root README table row

### Phase 2: Migrate `@sdxc/distill`

**Priority:** High
**Estimated Effort:** 2 hours

| Call site                                                          | Change                                                          |
| ------------------------------------------------------------------ | --------------------------------------------------------------- |
| `src/lib/robots.ts`                                                | deleted                                                         |
| `src/index.ts` exports of `isAllowed`, `productToken`, `robotsUrl` | removed; consumers import `@sdxc/robots`                        |
| `src/index.ts` `fetchRobots`                                       | removed; consumers import `@sdxc/robots/fetch`                  |
| `src/index.ts` `Distill.Options.robots`                            | typed `RobotsFetch.Outcome`                                     |
| `src/lib/limits.ts` `mayArchive`                                   | replaced by `directivesFor(...).noarchive`                      |
| `src/index.test.ts`                                                | robots cases move to `@sdxc/robots`; one integration case stays |

If a dated release of `@sdxc/distill` has shipped by then, the four exports stay for one release as
re-exports from `@sdxc/robots` with `@deprecated` tags.

### Phase 3: Migrate the reader

**Priority:** High
**Estimated Effort:** 1 hour

1. `app/lib/article.ts` `robotsFor` caches `RobotsFetch.Outcome` with its `lifetimeMs`
2. `database/article-cache.ts`: `ROBOTS_TTL` removed, key prefix versioned
3. `database/article-cache.workers.test.ts` and `app/lib/article.test.ts` gain a regression test:
   a `503` on `robots.txt` refuses the article

### Phase 4: Migrate the writers

**Priority:** Medium
**Estimated Effort:** 1 hour

1. `packages/blog-engine/src/syndication/controllers/robots.ts` writes through `stringify`, adding
   the CMS and auth `Disallow` rules
2. `packages/seo/src/lib/robots.ts` delegates to `stringifyDirectives`

### Phase 5: Publish

**Priority:** Low
**Estimated Effort:** 30 minutes

1. `description`, `LICENSE.md`, `bun run release:bootstrap @sdxc/robots`, trusted publisher

## Alternatives Considered

### 1. Fix the parser in place inside `@sdxc/distill`

**Rejected because**: the writer in blog-engine would still be a template string, and the
per-page directives would stay split between an extractor and an SEO helper. The repo's rule for
formats with a reader and a writer is a package.

### 2. Return `Result` from `parse`

**Rejected because**: RFC 9309 has no invalid document, so the failure branch would be dead code
at every call site. `fetchRobots` likewise maps every outcome to a decision.

### 3. Keep `X-Robots-Tag` in `@sdxc/seo`

**Rejected because**: distill is the only reader and has no reason to depend on a package that
renders `<head>` elements. The grammar lives here and `@sdxc/seo` writes through it.

### 4. Use an npm robots parser

`robots-parser` and similar libraries predate RFC 9309, build a `RegExp` per rule, and treat
fetching as out of scope.

**Rejected because**: the status-code rules are the part the repo gets wrong today, and the
per-page directives and Content Signals would still need writing.

## References

- [RFC 9309 - Robots Exclusion Protocol](https://www.rfc-editor.org/rfc/rfc9309)
- [RFC 3986 - URI Generic Syntax](https://www.rfc-editor.org/rfc/rfc3986) (percent-encoding)
- [Google: Robots meta tag and X-Robots-Tag specifications](https://developers.google.com/search/docs/crawling-indexing/robots-meta-tag)
- [Content Signals Policy](https://contentsignals.org/)
- [IETF AI Preferences working group](https://datatracker.ietf.org/wg/aipref/about/)
- [llms.txt proposal](https://llmstxt.org/)
- [ADR-083: Well-known URIs Package](./ADR-083-well-known-package.md)
- [ADR-007: Publishable Package Releases](./ADR-007-publishable-package-releases.md)

## Notes

- Implementation: `robotsUrl` returns `string | null`, `null` for text that is not a URL or a
  URL with no origin, so it never throws; `fetchRobots` reads that as `unreachable`.
- Implementation: `Crawl-delay` and `Content-Signal` count as group members, like `Allow` and
  `Disallow`: they end a run of user-agent lines, so `User-agent: *` / `Crawl-delay: 1` followed
  by `User-agent: SlowBot` is two groups. `Sitemap` and unknown records never split or end a
  group, per §2.2.4. A group-scoped record before every group is kept in `records`, and
  `stringify` writes it before the groups so it round-trips.
- Implementation: `Robots.ContentSignals` types the three Content Signals keys and keeps any
  other; `RobotsFetch.Outcome` is a union of the named `Parsed`, `Unavailable` and
  `Unreachable` interfaces; `Directives.Set` extends a `Directives.Flags` interface.
- Implementation: a redirect chain past `maxRedirects`, a redirect with no `Location`, a status
  outside 2xx and 4xx, a caller's abort, and a body that fails to read are all `unreachable`
  (disallow all). This matches the `unreachable` answer `@sdxc/distill`'s `fetchRobots` gives
  for an unfollowable chain, where RFC 9309 §2.3.1.2 would also permit "unavailable".
- Implementation: `isAllowed` on text that is neither an absolute URL nor a `/` path answers
  `false`, and `isAllowedBy` on an unreachable outcome still allows `/robots.txt`.
- Implementation: RFC 9309 figure 4's `https%3A%2F%2Ffoo.bar` row is not applied to raw reserved
  characters in a URL: they compare as written on both sides, which is what Google's suite
  expects for a query containing `http://`.
- Adoption: no dated release of `@sdxc/distill` carried the robots exports, so they were
  removed without re-exports. `@sdxc/cache` reads a numeric `ttl` as seconds, so the reader
  writes `lifetimeMs / 1000`. The reader checks the origin with distill's `addressable`
  before `fetchRobots`, so a non-public origin is never asked for its file.

## Current Progress

- [x] Phase 1: Specify and build the package
- [x] Phase 2: Migrate `@sdxc/distill`
- [x] Phase 3: Migrate the reader
- [ ] Phase 4: Migrate the writers
  - [ ] `@sdxc/blog-engine`'s `robots.txt` controller
  - [x] `@sdxc/seo`'s `robotsDirectives` delegates to `stringifyDirectives`
- [ ] Phase 5: Publish
