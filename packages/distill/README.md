# @sdxc/distill

Extract the article from a web page: bounded fetch, scoring and sanitizing.

A page wraps its article in navigation, share rails, comments and related-post blocks. This
package scores the page's containers to find the article, reads its title, byline and excerpt,
and sanitizes the body, treating every page as untrusted markup.

## Installation

```sh
npm add @sdxc/distill
```

Every function answers a `Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result).
To honour `robots.txt`, also install [`@sdxc/robots`](https://www.npmjs.com/package/@sdxc/robots).

## Usage

### Distill a URL

```typescript
import { distill } from "@sdxc/distill";
import { isFailure } from "@sdxc/result";

let article = await distill("https://example.com/post", {
	userAgent: "MyReader/1.0 (+https://example.com/about)",
});

if (isFailure(article)) {
	article.error.outcome; // "refused" | "timeout" | "empty"
} else {
	article.data.html; // sanitized body
	article.data.title; // string | null
	article.data.byline; // string | null
	article.data.excerpt; // string | null
}
```

`userAgent` is required, so a publisher can tell who is asking.

### Honour robots.txt

```typescript
import { distill } from "@sdxc/distill";
import { fetchRobots } from "@sdxc/robots/fetch";

let url = "https://example.com/post";
let userAgent = "MyReader/1.0 (+https://example.com/about)";

let robots = await fetchRobots(url, { userAgent });
let article = await distill(url, { userAgent, robots });
```

A path the rules disallow fails with `DistillRefusedError` before any request goes out.

### Distill markup you already have

```typescript
import { distillFrom } from "@sdxc/distill";

let article = distillFrom(html, "https://example.com/post");
```

The URL is the address the page was served from; every relative URL resolves against it.

### Summarize any page

```typescript
import { summaryFrom } from "@sdxc/distill";

let summary = summaryFrom(html, "https://example.com/watch?v=1");
// success({ title: "A Video", excerpt: "Five minutes on harbours.", url: "https://example.com/watch?v=1" })
```

A landing page or a video page has no article but still has a headline and a summary.

## API

### `distill(url: string, options: Distill.Options): Promise<Result<Distill.Retrieved, DistillError>>`

Fetches a page under the bounds below and reads the article out of it. A response that is not
`text/html` fails as `empty`.

- `options.userAgent`: the `User-Agent` the request is sent with. Required.
- `options.robots`: the outcome `fetchRobots` from `@sdxc/robots/fetch` answered for the origin.
  Parsed rules are evaluated for `userAgent`, an unavailable file (4xx) allows everything, and
  an unreachable one (5xx, 429, network failure) refuses everything.
- `options.maxBytes`, `options.maxRedirects`, `options.timeoutMs`: move the default bounds.
- `options.signal`: aborts the retrieval alongside its deadline.
- `options.sign`: signs each hop's request before it is sent, such as `webBotAuthSigner` from
  `@sdxc/http-signatures/web-bot-auth`, so the publisher can verify who is asking.

Bounds every request runs under:

- HTTP(S) only, checked on the first request and every redirect hop. URLs with credentials,
  IP literals, single-label hosts and reserved suffixes (`localhost`, `local`, `internal`,
  `test`) are refused.
- `MAX_REDIRECTS` (5) redirects, `MAX_BYTES` (2 MB) of body counted off the stream, and
  `TIMEOUT_MS` (8 seconds) for the whole chain plus the body read.
- No cookies or credentials; only `Accept` and `User-Agent` headers.

A 401, 402, 403, 429 or 451 fails as `refused`; any other non-2xx status, like a spent bound,
fails as `timeout`.

### `distillFrom(source: string, url: string): Result<Distill.Article, DistillEmptyError>`

Scores, sanitizes and reads metadata from markup in hand. Fails when the source has no markup
or no article.

### `summaryFrom(source: string, url: string): Result<Distill.Summary, DistillEmptyError>`

The page's `title`, `excerpt` and canonical `url`, read as `distillFrom` reads them. Fails only
when the source carries no markup.

### `addressable(url: string): Result<URL, DistillRefusedError>`

Applies the same host rule as `distill` without making a request, so a link can be refused
before it is queued.

### `MAX_BYTES`, `MAX_REDIRECTS`, `TIMEOUT_MS`

The default bounds: `2097152`, `5` and `8000`.

### `EXCERPT_LENGTH`

`300`. An excerpt is the page's `og:description`, `description` or `twitter:description`, else
the article's first paragraph, cut at the last whole word within this many characters.

### Errors

Each error carries an `outcome` to render copy from.

| Error                 | `outcome`   | Meaning                                                           |
| --------------------- | ----------- | ----------------------------------------------------------------- |
| `DistillRefusedError` | `"refused"` | The site said no, robots.txt disallows it, or the host is refused |
| `DistillLimitError`   | `"timeout"` | Time, bytes or redirects ran out, or the site failed              |
| `DistillEmptyError`   | `"empty"`   | The page carried no article or was not HTML                       |

`DistillError` is the union of the three.

### Sanitization

The body is cleaned by an allow-list: prose, lists, tables, figures, links and images survive.
`href` and `src` keep only `http:`, `https:` and `mailto:` URLs, relative URLs resolve against
the article's canonical address, and every image gets `referrerpolicy="no-referrer"` and
`loading="lazy"`. Scripts, iframes, forms, `on*` handlers, `style`, `class` and `id` are removed.
Images still load from the publisher; route them through an image proxy when that matters.

### Types

- `Distill.Article`: `html`, `title`, `byline`, `excerpt`, canonical `url`, `chars` (length of the
  readable text) and `sanitized` (the `SanitizeReport` from
  [`@sdxc/html`](https://www.npmjs.com/package/@sdxc/html): removed elements, attributes and
  URLs).
- `Distill.Retrieved`: an `Article` plus `bytes` read off the wire and `mayCache`, `false` when
  the response's `X-Robots-Tag` carries `noarchive` for every agent or for `userAgent`.
- `Distill.Summary`: `title`, `excerpt` and `url`.
- `Distill.Options`: the options `distill` takes.
- `Distill.Outcome`: `"extracted" | "refused" | "timeout" | "empty"`, for recording what an
  attempt amounted to.

## Pattern: Copy For Every Outcome

Map each failure to what a reader sees, falling back to the excerpt the link came with.

```typescript
import type { Distill } from "@sdxc/distill";

import { distill } from "@sdxc/distill";
import { isFailure } from "@sdxc/result";

let MESSAGES: Record<Exclude<Distill.Outcome, "extracted">, string> = {
	refused: "This site does not allow reading here.",
	timeout: "The page took too long to load.",
	empty: "There is no article on this page.",
};

async function readerView(url: string, excerpt: string) {
	let article = await distill(url, { userAgent: "MyReader/1.0 (+https://example.com/about)" });
	if (isFailure(article)) {
		return { html: null, excerpt, notice: MESSAGES[article.error.outcome] };
	}
	return { html: article.data.html, excerpt: article.data.excerpt ?? excerpt, notice: null };
}
```

## Pattern: Caching By URL

A distilled article is the same for everyone, so the URL is the whole cache key. Cache failures
for less time than successes, and skip storing a page whose `mayCache` is `false`.

```typescript
import { distill } from "@sdxc/distill";
import { isFailure } from "@sdxc/result";

interface ArticleStore {
	read(url: string): Promise<{ html: string | null } | null>;
	write(url: string, entry: { html: string | null }, options: { ttl: number }): Promise<void>;
}

async function articleFor(url: string, store: ArticleStore): Promise<string | null> {
	let hit = await store.read(url);
	if (hit !== null) return hit.html;

	let article = await distill(url, { userAgent: "MyReader/1.0 (+https://example.com/about)" });

	if (isFailure(article)) {
		await store.write(url, { html: null }, { ttl: 60 * 60 });
		return null;
	}

	if (article.data.mayCache) {
		await store.write(url, { html: article.data.html }, { ttl: 7 * 24 * 60 * 60 });
	}

	return article.data.html;
}
```

## Pattern: Keeping The Article Only When It Adds Something

A teaser, a consent wall or an error page can distill cleanly and still carry less than the
excerpt you already have. Compare `chars` against it.

```typescript
import { distill } from "@sdxc/distill";
import { isFailure } from "@sdxc/result";

async function betterThanExcerpt(url: string, excerpt: string): Promise<string | null> {
	let article = await distill(url, { userAgent: "MyReader/1.0 (+https://example.com/about)" });
	if (isFailure(article)) return null;
	return article.data.chars > excerpt.length ? article.data.html : null;
}
```

## Pattern: Robots Rules Cached Per Origin

`fetchRobots` answers an outcome with a `lifetimeMs`, so one fetch serves every article on the
origin until it expires.

```typescript
import type { RobotsFetch } from "@sdxc/robots/fetch";

import { distill } from "@sdxc/distill";
import { fetchRobots } from "@sdxc/robots/fetch";

let USER_AGENT = "MyReader/1.0 (+https://example.com/about)";
let ROBOTS = new Map<string, { outcome: RobotsFetch.Outcome; expiresAt: number }>();

async function robotsFor(url: string): Promise<RobotsFetch.Outcome> {
	let origin = new URL(url).origin;
	let cached = ROBOTS.get(origin);
	if (cached !== undefined && cached.expiresAt > Date.now()) return cached.outcome;

	let outcome = await fetchRobots(url, { userAgent: USER_AGENT });
	ROBOTS.set(origin, { outcome, expiresAt: Date.now() + outcome.lifetimeMs });
	return outcome;
}

async function politeDistill(url: string) {
	return distill(url, { userAgent: USER_AGENT, robots: await robotsFor(url) });
}
```

## Pattern: Background Distillation With Tighter Bounds

Refuse an unaddressable link before it reaches the queue, then give the job its own budget and
cancel it with the job.

```typescript
import { addressable, distill } from "@sdxc/distill";
import { isFailure } from "@sdxc/result";

function enqueueIfAddressable(link: string, queue: { push(url: string): void }): boolean {
	let url = addressable(link);
	if (isFailure(url)) return false;
	queue.push(url.data.href);
	return true;
}

async function runJob(url: string, signal: AbortSignal) {
	return distill(url, {
		userAgent: "MyReader/1.0 (+https://example.com/about)",
		maxBytes: 512 * 1024,
		maxRedirects: 2,
		timeoutMs: 20_000,
		signal,
	});
}
```

## Pattern: Testing Against A Fixture

`distillFrom` runs the same scoring and sanitizing as `distill`, so a saved page tests extraction
without a network.

```typescript
import { readFile } from "node:fs/promises";

import { distillFrom, summaryFrom } from "@sdxc/distill";
import { isSuccess } from "@sdxc/result";
import { expect, test } from "vitest";

test("extracts the article from a saved page", async () => {
	let html = await readFile("fixtures/post.html", "utf8");
	let article = distillFrom(html, "https://example.com/post");

	expect(isSuccess(article)).toBe(true);
	if (!isSuccess(article)) return;
	expect(article.data.html).not.toContain("<script");
	expect(article.data.sanitized.removedElements).toBeGreaterThan(0);

	let summary = summaryFrom(html, "https://example.com/post");
	expect(isSuccess(summary) && summary.data.title).toBe(article.data.title);
});
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
		"@sdxc/distill": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
