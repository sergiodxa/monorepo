# @sdxc/robots

Read, write and evaluate robots.txt and robots directives.

## Overview

[RFC 9309](https://www.rfc-editor.org/rfc/rfc9309) standardized the Robots Exclusion Protocol:
how `robots.txt` groups rules by user agent, how a crawler picks its group, how `Allow` and
`Disallow` patterns match (longest match wins, `*` and `$` wildcards), how much of the file a
crawler must read, and what an HTTP error fetching it means. This package is that protocol in
both directions: `parse` and `stringify` for the file, `isAllowed` and `crawlDelay` over a parsed
document, and `fetchRobots`, which turns every HTTP outcome into the decision the RFC assigns it.

`parse` never fails. The RFC defines no invalid file: a parser skips what it cannot read, so a
page of HTML parses to a document with no groups, which allows everything. Matching normalizes
percent-encoding in both the pattern and the path, and compares with a wildcard walker rather
than a regular expression built from the file.

The per-page counterpart, the `robots` meta tag and the `X-Robots-Tag` header, is documented by
the search engines rather than an RFC. `./directives` reads and writes that grammar, including
bot-scoped sets and value-carrying directives such as `max-snippet`.

| Subpath                   | Exports                                                                                |
| ------------------------- | -------------------------------------------------------------------------------------- |
| `@sdxc/robots`            | `parse`, `stringify`, `isAllowed`, `crawlDelay`, `productToken`, `robotsUrl`, `Robots` |
| `@sdxc/robots/fetch`      | `fetchRobots`, `isAllowedBy`, `RobotsFetch`                                            |
| `@sdxc/robots/directives` | `parseDirectives`, `directivesFor`, `stringifyDirectives`, `Directives`                |

## Usage

### Check a URL before crawling it

```typescript
import { fetchRobots, isAllowedBy } from "@sdxc/robots/fetch";

const AGENT = "SergioReader/1.0 (+https://sergiodxa.com/bot)";

let outcome = await fetchRobots(url, { userAgent: AGENT });
if (!isAllowedBy(outcome, AGENT, url)) return refuse();
```

### Evaluate a file you already hold

```typescript
import { crawlDelay, isAllowed, parse } from "@sdxc/robots";

let document = parse(text);
isAllowed(document, "SergioReader/1.0", "https://example.com/private/x"); // false
crawlDelay(document, "SergioReader/1.0"); // 10, or undefined
```

### Serve a robots.txt

```typescript
import { stringify } from "@sdxc/robots";

let body = stringify({
	groups: [
		{
			userAgents: ["*"],
			rules: [
				{ allow: true, pattern: "/" },
				{ allow: false, pattern: "/cms" },
			],
			contentSignals: { search: true, "ai-input": true, "ai-train": false },
		},
	],
	sitemaps: ["https://example.com/sitemap.xml"],
	records: [],
});
```

### Read a page's own directives

```typescript
import { directivesFor } from "@sdxc/robots/directives";

let mayCache = !directivesFor(response, AGENT).noarchive;
```

## API

### `@sdxc/robots`

#### `parse(source: string, options?: Robots.ParseOptions): Robots.Document`

Reads any text as robots.txt. A leading byte order mark is dropped, CR, LF and CRLF all end a
line, `#` starts a comment, and field names are case-insensitive. Only the whole lines within
`maxBytes` (default `512_000`, the RFC's 500 KiB floor) are read.

- A group is one or more `User-agent` lines and the lines after them. `Allow`, `Disallow`,
  `Crawl-delay` and `Content-Signal` are group members and end the run of user-agent lines;
  `Sitemap` and unknown records do not, so they never split a group (§2.2.4).
- Rules before the first group are dropped (§2.2.2).
- `Crawl-delay` is non-standard, read per group in seconds, last value wins.
- `Content-Signal: search=yes, ai-train=no` is read per group into `contentSignals`.
- `Sitemap` lines are collected from anywhere; every other record is kept in `records`.

```typescript
interface Document {
	groups: {
		userAgents: string[];
		rules: { allow: boolean; pattern: string }[];
		crawlDelay?: number;
		contentSignals?: ContentSignals;
	}[];
	sitemaps: string[];
	records: { name: string; value: string }[]; // name lower-cased
}
```

#### `stringify(document: Robots.Document): string`

Writes groups, then sitemaps, then other records, one field per line with LF line ends and a
blank line between sections. What it writes parses back to the same document.

#### `isAllowed(robots, userAgent, url): boolean`

Whether an agent may fetch a URL (absolute, or a path starting with `/`). The agent's product
token picks every group naming it, merged into one; with none, the `*` groups apply; with
neither, everything is allowed. The longest matching pattern decides, `Allow` wins a tie, and
`/robots.txt` is always allowed. Patterns and paths are both normalized first: non-ASCII
percent-encoded as UTF-8, escapes uppercased, escapes of unreserved characters decoded, and a
raw `*` or `$` in the URL encoded so `%2A` and `%24` in a pattern match them.

#### `crawlDelay(robots, userAgent): number | undefined`

The `Crawl-delay` of the groups that apply to the agent, in seconds.

#### `productToken(userAgent: string): string`

The lower-cased leading `[A-Za-z_-]+` run: `"SergioReader/1.0 (+https://…)"` gives
`"sergioreader"`. User-agent lines in the file are reduced the same way, so `User-agent: Foo Bar`
applies to `foo`.

#### `robotsUrl(url: string | URL): string | null`

The origin's `/robots.txt`, or `null` for text that is not a URL or a URL with no origin.

### `@sdxc/robots/fetch`

#### `fetchRobots(url, options): Promise<RobotsFetch.Outcome>`

Fetches the origin's robots.txt with the caller's `User-Agent`, `Accept: text/plain` and no
credentials, walking redirects itself so `maxRedirects` (default `5`) holds across hosts. Every
outcome is a decision:

| Result                                                                      | Outcome                                 | Evaluates as | `lifetimeMs` |
| --------------------------------------------------------------------------- | --------------------------------------- | ------------ | ------------ |
| 2xx                                                                         | `{ status: "parsed", document }`        | the rules    | 24 hours     |
| 4xx other than 429                                                          | `{ status: "unavailable", httpStatus }` | allow all    | 24 hours     |
| 5xx, 429, other statuses, network error, timeout, too many redirects, abort | `{ status: "unreachable", httpStatus }` | disallow all | 1 hour       |

The body is read up to `maxBytes` (default `512_000`) and parsed to the last whole line within
it. The outcome is plain data, so a cache stores it as JSON for `lifetimeMs`. Options:
`userAgent` (required), `timeoutMs` (default `10_000`, for the whole retrieval), `maxBytes`,
`maxRedirects`, `signal`.

#### `isAllowedBy(outcome, userAgent, url): boolean`

`isAllowed` over an outcome: parsed documents are evaluated, unavailable allows, and unreachable
refuses everything but `/robots.txt` itself.

### `@sdxc/robots/directives`

#### `parseDirectives(value: string): Directives.Set[]`

Reads one `X-Robots-Tag` value or `robots` meta content. `name:` that is not a value-carrying
directive scopes what follows to that bot, until the next scope; directives before any scope form
an unscoped set (`botName: null`).

```typescript
interface Set {
	botName: string | null;
	noindex: boolean; // "none" sets noindex and nofollow
	nofollow: boolean;
	noarchive: boolean;
	nosnippet: boolean;
	noimageindex: boolean;
	notranslate: boolean;
	maxSnippet?: number; // -1 for no limit
	maxImagePreview?: "none" | "standard" | "large";
	maxVideoPreview?: number;
	unavailableAfter?: Date; // ISO 8601, RFC 822 and RFC 850 dates
	other: string[]; // unknown directives, lower-cased, e.g. "noai"
}
```

#### `directivesFor(response: Response, userAgent: string): Directives.Set`

Merges every `X-Robots-Tag` on the response into the set for one bot: the unscoped sets plus
those naming its product token. The more restrictive value wins: any flag set is on, and the
smaller limit, smaller image preview and earlier `unavailable_after` apply.

#### `stringifyDirectives(set, options?): string`

Writes a set, prefixed with `botName:` when it has one. Defaults are omitted unless
`explicit: true` spells out `index` and `follow`:
`stringifyDirectives({ noindex: true }, { explicit: true })` is `"noindex, follow"`.

## Pattern: Cache The Outcome, Not The Text

The outcome carries its own lifetime, so an unreachable origin is asked again within the hour
instead of being disallowed for a day.

```typescript
import type { RobotsFetch } from "@sdxc/robots/fetch";

import { fetchRobots, isAllowedBy } from "@sdxc/robots/fetch";

async function robotsFor(url: string): Promise<RobotsFetch.Outcome> {
	let key = `robots:v2:${new URL(url).origin}`;
	let held = await cache.read<RobotsFetch.Outcome>(key);
	if (held !== null) return held;

	let outcome = await fetchRobots(url, { userAgent: AGENT });
	await cache.write(key, outcome, { ttl: outcome.lifetimeMs });
	return outcome;
}

if (!isAllowedBy(await robotsFor(url), AGENT, url)) return refuse();
```

## Pattern: A Meta Tag From Two Booleans

```typescript
import { stringifyDirectives } from "@sdxc/robots/directives";

function robotsMeta({ index = true, follow = true }) {
	return stringifyDirectives({ noindex: !index, nofollow: !follow }, { explicit: true });
}
```

## Conformance

The tests run RFC 9309's §5 examples and its percent-encoding tables, and the RFC matching cases
from Google's open-source robots.txt parser (`src/fixtures/google-robotstxt.ts`, Apache 2.0,
license beside it). Google-only extensions in that suite are left out: a missing colon read as
one, `index.html` read as its directory, the 16 KiB line limit, and an empty URL refused. Two of
its assertions differ by design and are left out too: this package parses the URL, so a raw
`/foo/bar/ツ` matches its encoded pattern, and it decodes unreserved escapes as §2.2.2 asks, so
`%62%61%7A` in a pattern matches `/baz`.

## Related Packages

- [`@sdxc/distill`](/packages/distill) - Article extraction, which consults robots.txt before fetching
- [`@sdxc/seo`](/packages/seo) - Head tags, including the `robots` meta tag
- [`@sdxc/sitemap`](/packages/sitemap) - The sitemaps a robots.txt points to

## Tips

1. **Pass your full user agent** - Only the product token is compared, so the string you send as `User-Agent` works as is.
2. **Treat unreachable as temporary** - It disallows everything, so keep it for its one-hour `lifetimeMs` rather than a day.
3. **The 30-day rule is yours** - RFC 9309 lets a crawler treat an origin unreachable for a month as unavailable; only a cache with history can tell, so apply it there.
4. **`429` refuses** - The RFC files it under unavailable, but an origin rate-limiting you is asking you to stay away, so it evaluates as unreachable.
5. **Several `X-Robots-Tag` headers join with commas** - A bot scope runs until the next one, so a header with a scope followed by an unscoped header reads the second under the first's bot.
