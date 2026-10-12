# @sdxc/robots

Read, write and evaluate robots.txt and robots directives.

`parse`, `stringify` and `isAllowed` implement the robots.txt rules of
[RFC 9309](https://www.rfc-editor.org/rfc/rfc9309): groups picked by the agent's product token,
the longest matching `Allow` or `Disallow` deciding, `*` and `$` wildcards. `./fetch` retrieves
an origin's file and turns every HTTP result into the decision the RFC assigns it, and
`./directives` reads and writes the per-page `X-Robots-Tag` header and `robots` meta tag.

## Installation

```sh
npm add @sdxc/robots
```

## Usage

### Evaluate a file you already hold

```typescript
import { crawlDelay, isAllowed, parse } from "@sdxc/robots";

let document = parse(`
User-agent: *
Disallow: /private/
Allow: /private/press/
Crawl-delay: 10

Sitemap: https://example.com/sitemap.xml
`);

isAllowed(document, "ExampleBot/1.0", "https://example.com/private/report"); // false
isAllowed(document, "ExampleBot/1.0", "/private/press/launch"); // true
crawlDelay(document, "ExampleBot/1.0"); // 10
document.sitemaps; // ["https://example.com/sitemap.xml"]
```

`parse` reads any text and always returns a document: lines that are not records are skipped, so
an HTML page parses to a document with no groups, which allows everything.

### Check a URL before crawling it

```typescript
import { fetchRobots, isAllowedBy } from "@sdxc/robots/fetch";

let AGENT = "ExampleBot/1.0 (+https://example.com/bot)";

let outcome = await fetchRobots("https://example.com/articles/1", { userAgent: AGENT });
if (isAllowedBy(outcome, AGENT, "https://example.com/articles/1")) {
	// fetch the page
}
```

A 2xx is parsed, a 4xx allows everything, and a 5xx, a 429 or a network failure disallows
everything. `outcome.lifetimeMs` says how long to keep the decision.

### Write a robots.txt

```typescript
import { stringify } from "@sdxc/robots";

let body = stringify({
	groups: [
		{
			userAgents: ["*"],
			rules: [
				{ allow: true, pattern: "/" },
				{ allow: false, pattern: "/admin" },
			],
			contentSignals: { search: true, "ai-input": true, "ai-train": false },
		},
	],
	sitemaps: ["https://example.com/sitemap.xml"],
	records: [],
});
```

What `stringify` writes parses back to the same document.

### Read and write per-page directives

```typescript
import { directivesFor, stringifyDirectives } from "@sdxc/robots/directives";

let directives = directivesFor(response, "ExampleBot/1.0");
directives.noindex; // true when any X-Robots-Tag for this bot or every bot says so

stringifyDirectives({ noindex: true }, { explicit: true }); // "noindex, follow"
stringifyDirectives({ botName: "examplebot", nosnippet: true }); // "examplebot: nosnippet"
```

## API

### `@sdxc/robots`

#### `parse(source: string, options?: Robots.ParseOptions): Robots.Document`

Reads any text as robots.txt, up to the last whole line within `maxBytes` (default `512_000`).
`Crawl-delay` and `Content-Signal` lines are read into the group they follow, `Sitemap` lines
are collected from anywhere, rules before the first group are dropped, and every other record is
kept in `records`.

#### `stringify(document: Robots.Document): string`

Writes groups, then sitemaps, then other records, with LF line ends and a blank line between
sections; an empty document writes `""`.

#### `isAllowed(robots: Robots.Document, userAgent: string, url: string | URL): boolean`

Whether an agent may fetch an absolute URL or a `/`-rooted path. Every group naming the agent's
product token applies, merged; with none, the `*` groups apply. The longest matching pattern
decides, `Allow` wins a tie, an unmatched path and `/robots.txt` are allowed, and percent-encoding
is normalized in both pattern and path before matching.

#### `crawlDelay(robots: Robots.Document, userAgent: string): number | undefined`

The `Crawl-delay`, in seconds, of the groups that apply to the agent.

#### `productToken(userAgent: string): string`

The lower-cased leading run of letters, `_` and `-`: `"ExampleBot/1.0 (+https://…)"` gives
`"examplebot"`. Both the agent and every `User-agent` line are compared through it.

#### `robotsUrl(url: string | URL): string | null`

The origin's `/robots.txt` URL, or `null` for text that is not a URL or a URL with no origin.

### `@sdxc/robots/fetch`

#### `fetchRobots(url: string | URL, options: RobotsFetch.Options): Promise<RobotsFetch.Outcome>`

Fetches the robots.txt of `url`'s origin, sending `options.userAgent`, following up to
`maxRedirects` (default `5`) redirects within `timeoutMs` (default `10_000`) for the whole
retrieval, and parsing up to `maxBytes` (default `512_000`). `signal` aborts it. It always
resolves:

| Result                                                      | `status`        | Evaluates as | `lifetimeMs` |
| ----------------------------------------------------------- | --------------- | ------------ | ------------ |
| 2xx                                                         | `"parsed"`      | its rules    | 24 hours     |
| 4xx other than 429                                          | `"unavailable"` | allow all    | 24 hours     |
| 5xx, 429, network error, timeout, too many redirects, abort | `"unreachable"` | disallow all | 1 hour       |

#### `isAllowedBy(outcome: RobotsFetch.Outcome, userAgent: string, url: string | URL): boolean`

`isAllowed` over an outcome, fresh or from a cache: a parsed document is evaluated, unavailable
allows everything, and unreachable refuses everything but `/robots.txt`.

### `@sdxc/robots/directives`

#### `parseDirectives(value: string): Directives.Set[]`

Reads one `X-Robots-Tag` value or `robots` meta content into one set per bot, in order of first
appearance. `name:` scopes what follows to that bot until the next scope; directives before any
scope form the unscoped set (`botName: null`).

#### `directivesFor(response: Response, userAgent: string): Directives.Set`

Merges the response's `X-Robots-Tag` headers into the set for one bot: the unscoped sets plus
those naming its product token. The more restrictive value wins: a flag set anywhere is on, and
the smaller limit, smaller image preview and earlier `unavailableAfter` apply.

#### `stringifyDirectives(set: Partial<Directives.Set>, options?: Directives.StringifyOptions): string`

Writes a set, prefixed with `botName:` when it has one. Missing fields are off, and defaults are
omitted unless `explicit: true` spells out `index` and `follow`.

### Types

#### `Robots.Document`

`{ groups, sitemaps, records }`: groups in file order, sitemap URLs, and every other record as
`{ name, value }` with `name` lower-cased (`Robots.Record`).

#### `Robots.Group`

`userAgents` as written (`*` for the wildcard), `rules` as `Robots.Rule` (`{ allow, pattern }`;
an empty pattern matches nothing), an optional `crawlDelay` in seconds, and optional
`contentSignals`.

#### `Robots.ContentSignals`

`Content-Signal` keys mapped to `true` (`yes`) or `false` (`no`); `search`, `ai-input` and
`ai-train` are typed, and any other key is kept.

#### `Robots.ParseOptions`

`{ maxBytes?: number }`.

#### `RobotsFetch.Outcome`

`RobotsFetch.Parsed` (`{ status: "parsed", document, lifetimeMs }`), `RobotsFetch.Unavailable`
(`{ status: "unavailable", httpStatus, lifetimeMs }`) or `RobotsFetch.Unreachable`
(`{ status: "unreachable", httpStatus: number | null, lifetimeMs }`). It is plain data, so it
stores as JSON.

#### `RobotsFetch.Options`

`{ userAgent: string; timeoutMs?: number; maxBytes?: number; maxRedirects?: number; signal?: AbortSignal }`.

#### `Directives.Set`

`botName` (lower-cased, or `null`), the `Directives.Flags` booleans `noindex`, `nofollow`,
`noarchive`, `nosnippet`, `noimageindex` and `notranslate` (`none` sets the first two),
`maxSnippet` and `maxVideoPreview` (`-1` for no limit), `maxImagePreview`
(`"none" | "standard" | "large"`), `unavailableAfter` as a `Date`, and `other` for unknown
directives such as `noai`, lower-cased.

#### `Directives.StringifyOptions`

`{ explicit?: boolean }`.

## Pattern: Cache The Outcome Per Origin

The outcome carries its own lifetime, so an unreachable origin is asked again within the hour
while a parsed file is kept for a day.

```typescript
import type { RobotsFetch } from "@sdxc/robots/fetch";

import { fetchRobots, isAllowedBy } from "@sdxc/robots/fetch";

let AGENT = "ExampleBot/1.0 (+https://example.com/bot)";
let cache = new Map<string, { outcome: RobotsFetch.Outcome; expiresAt: number }>();

async function robotsFor(url: string): Promise<RobotsFetch.Outcome> {
	let origin = new URL(url).origin;
	let held = cache.get(origin);
	if (held !== undefined && held.expiresAt > Date.now()) return held.outcome;

	let outcome = await fetchRobots(url, { userAgent: AGENT });
	cache.set(origin, { outcome, expiresAt: Date.now() + outcome.lifetimeMs });
	return outcome;
}

async function mayCrawl(url: string): Promise<boolean> {
	return isAllowedBy(await robotsFor(url), AGENT, url);
}
```

RFC 9309 lets a crawler treat an origin unreachable for a long time (30 days) as unavailable; a
cache that keeps history can apply that by swapping the outcome before calling `isAllowedBy`.

## Pattern: Pace Requests And Discover Sitemaps

A parsed outcome carries the whole document, so one retrieval answers what to crawl, how fast,
and where the sitemaps are.

```typescript
import { crawlDelay } from "@sdxc/robots";
import { fetchRobots, isAllowedBy } from "@sdxc/robots/fetch";

let AGENT = "ExampleBot/1.0 (+https://example.com/bot)";

async function crawlSite(origin: string, paths: string[]) {
	let outcome = await fetchRobots(origin, { userAgent: AGENT, timeoutMs: 5_000 });
	let delaySeconds = outcome.status === "parsed" ? (crawlDelay(outcome.document, AGENT) ?? 1) : 1;
	let sitemaps = outcome.status === "parsed" ? outcome.document.sitemaps : [];

	for (let path of [...sitemaps, ...paths]) {
		let url = new URL(path, origin).toString();
		if (!isAllowedBy(outcome, AGENT, url)) continue;
		await fetch(url, { headers: { "user-agent": AGENT } });
		await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));
	}
}
```

## Pattern: Serve robots.txt With Per-Bot Rules

Groups name one or more agents; a bot named in a group follows only that group, every other bot
follows `*`.

```typescript
import { stringify } from "@sdxc/robots";

function robotsTxt(origin: string): Response {
	let body = stringify({
		groups: [
			{
				userAgents: ["*"],
				rules: [
					{ allow: false, pattern: "/search" },
					{ allow: false, pattern: "/*.json$" },
				],
				contentSignals: { search: true, "ai-train": false },
			},
			{
				userAgents: ["GPTBot", "CCBot"],
				rules: [{ allow: false, pattern: "/" }],
			},
			{
				userAgents: ["SlowBot"],
				rules: [{ allow: true, pattern: "/" }],
				crawlDelay: 30,
			},
		],
		sitemaps: [`${origin}/sitemap.xml`],
		records: [],
	});

	return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
```

## Pattern: Send Page Directives As Header And Meta Tag

`stringifyDirectives` writes the same value for both places; one header per bot scopes a policy
to it.

```typescript
import { stringifyDirectives } from "@sdxc/robots/directives";

function robotsMeta({ index = true, follow = true }) {
	return stringifyDirectives({ noindex: !index, nofollow: !follow }, { explicit: true });
}

let headers = new Headers({ "content-type": "text/html; charset=utf-8" });
headers.append("X-Robots-Tag", stringifyDirectives({ maxSnippet: 160, maxImagePreview: "large" }));
headers.append("X-Robots-Tag", stringifyDirectives({ botName: "examplebot", noarchive: true }));
headers.append(
	"X-Robots-Tag",
	stringifyDirectives({ unavailableAfter: new Date("2026-12-31T00:00:00Z") }),
);

let metaContent = robotsMeta({ index: false }); // "noindex, follow", for <meta name="robots">
```

## Pattern: Honor A Page's Directives When Indexing

`directivesFor` reads the headers; the meta tag's content goes through `parseDirectives`, whose
sets a crawler picks by `botName`.

```typescript
import { productToken } from "@sdxc/robots";
import { directivesFor, parseDirectives } from "@sdxc/robots/directives";

let AGENT = "ExampleBot/1.0 (+https://example.com/bot)";

function indexPolicy(response: Response, metaContent: string | null) {
	let header = directivesFor(response, AGENT);
	let meta = parseDirectives(metaContent ?? "").filter(
		(set) => set.botName === null || set.botName === productToken(AGENT),
	);

	let noindex = header.noindex || meta.some((set) => set.noindex);
	let expired = header.unavailableAfter !== undefined && header.unavailableAfter < new Date();
	let snippetLength = header.maxSnippet === -1 ? Infinity : (header.maxSnippet ?? Infinity);

	return {
		index: !noindex && !expired,
		follow: !header.nofollow && !meta.some((set) => set.nofollow),
		cache: !header.noarchive,
		snippetLength: header.nosnippet ? 0 : snippetLength,
	};
}
```

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published,
written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one
release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no
compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/robots": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
