# @sdxc/distill

Distill the article out of a web page: fetch under bounds, score the candidates, sanitize what
is left.

A page is not a document. It is an article wrapped in navigation, a share rail, a comment
thread and three related-post blocks, and deciding which subtree is the article is a scoring
heuristic rather than a question the markup answers. This package does that scoring, and it
treats the page it scored as what it is — untrusted markup from an origin nobody vetted — so
what comes back out is sanitized before any caller can render it.

## Installation

```bash
npm add @sdxc/distill
```

Every answer is a `Result`, so install
[`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result) alongside this package to read
one.

## Usage

```typescript
import { distill } from "@sdxc/distill";
import { isFailure } from "@sdxc/result";

let article = await distill(post.url, {
	userAgent: "MyApp/1.0 (+https://myapp.example/about)",
});

if (isFailure(article)) return excerptAnd(post.url, article.error.outcome);

render(article.data.html, article.data.title, article.data.byline);
```

Already holding the markup — from a fixture, or from a response somebody else retrieved:

```typescript
import { distillFrom } from "@sdxc/distill";

let article = distillFrom(source, "https://example.com/post");
```

## API

### `distill(url, options)`

Retrieves a page and reads the article out of it, answering
`Result<Distill.Retrieved, DistillError>`.

`options.userAgent` is required: a publisher who wants to refuse should be able to tell who
is asking, and only the caller knows what to call itself. `options.robots` takes the origin's
`robots.txt` as the caller already holds it, and a `Disallow` covering the path refuses before
any request goes out; omitting it consults nothing. `maxBytes`, `maxRedirects`, `timeoutMs`
and `signal` move the four bounds below.

### `distillFrom(source, url)`

The same scoring, sanitization and metadata over markup in hand, answering
`Result<Distill.Article, DistillEmptyError>`. `url` is what every relative URL in the
markup resolves against, so it is the address the page was actually served from.

### `fetchRobots(url, options)`

Retrieves an origin's `robots.txt` for the caller to hold and cache, answering `null` for an
origin that serves none — which permits everything.

### `isAllowed(robots, path, userAgent)`, `robotsUrl(url)`, `productToken(userAgent)`

The `robots.txt` rules on their own: the groups naming an agent replace the wildcard group,
the longest matching pattern decides, `*` and `$` are honoured, and a document nobody could
parse permits everything.

### `addressable(url)`

Whether an address is somewhere this package is willing to go, before any request is made.

### Outcomes

Three errors, each carrying an `outcome` a caller renders copy from.

| Error                 | `outcome` | What happened                                                 |
| --------------------- | --------- | ------------------------------------------------------------- |
| `DistillRefusedError` | `refused` | The site said no, or the address is one this will not ask for |
| `DistillLimitError`   | `timeout` | Time, bytes or hops ran out                                   |
| `DistillEmptyError`   | `empty`   | The page arrived carrying no article                          |

`Distill.Retrieved` adds `bytes`, and `mayCache` — `false` for a response carrying
`X-Robots-Tag: noarchive`, which is the exact name for asking not to be kept.

## The four bounds

Exported as `MAX_BYTES`, `MAX_REDIRECTS` and `TIMEOUT_MS`, and moved per call through
`options`.

- **HTTP(S) only**, checked before the request, with it a refusal of any host that is a
  literal IP address, a loopback name or a `.local` name.
- **Five redirects**, walked manually with `redirect: "manual"`, which is what gives the chain
  a length it can exceed and makes the final URL a fact this package tracked.
- **Two megabytes**, counted off the stream and abandoned mid-body, so a response lying about
  its length is refused by the same bytes as one that is honest.
- **Eight seconds**, because somebody is waiting on this one.

The request carries no cookies, no credentials and no header naming whoever asked for it.

## Sanitization

`distill` and `distillFrom` both sanitize before they answer, so no consumer can forget to.
An allow-list decides what survives: prose, lists, tables, figures, links and images, with
`href` and `src` restricted to `http:`, `https:` and `mailto:`, every relative URL resolved
against the article's own address, and every surviving image carrying `referrerpolicy="no-referrer"`
and `loading="lazy"`. Everything else — `on*` handlers, `style`, `class`, `id`, scripts,
iframes and forms — is gone.

Sanitization alone leaves the publisher able to see an address when an image loads. Closing
that needs an image proxy, which belongs to whoever is rendering rather than here.

## Pattern: Caching What Comes Back

Nothing about a distilled article is about who asked for it, so the URL is the whole key and
one distillation serves everybody who opens the same link. Keep a failure too, for far less
time than a success: a blocked site asked once an hour is politer than one asked on every
open, and `mayCache` is a page asking not to be kept at all.

```typescript
import { distill } from "@sdxc/distill";
import { isFailure } from "@sdxc/result";

const DAY_MS = 86_400_000;

/** Whatever store you already have, keyed by the article's URL. */
interface ArticleStore {
	read(url: string): Promise<{ html: string | null } | null>;
	write(url: string, entry: { html: string | null }, options: { ttl: number }): Promise<void>;
}

async function articleFor(url: string, cache: ArticleStore): Promise<string | null> {
	let hit = await cache.read(url);
	if (hit !== null) return hit.html;

	let article = await distill(url, { userAgent: "MyApp/1.0 (+https://myapp.example/about)" });

	if (isFailure(article)) {
		// An hour, so a site that refuses today is asked again tomorrow rather than hourly.
		await cache.write(url, { html: null }, { ttl: DAY_MS / 24 });
		return null;
	}

	// A page carrying `X-Robots-Tag: noarchive` is answered, never stored.
	if (article.data.mayCache) {
		await cache.write(url, { html: article.data.html }, { ttl: DAY_MS * 7 });
	}

	return article.data.html;
}
```

## Pattern: Deciding The Article Was Worth It

A teaser, a consent interstitial and an error page are all pages that parse, score and
sanitize perfectly well while carrying nothing the reader did not already have. Comparing
`chars` against the excerpt already in hand is the one predicate that covers all three.

```typescript
import { distill } from "@sdxc/distill";
import { isFailure } from "@sdxc/result";

async function betterThanExcerpt(url: string, excerpt: string): Promise<string | null> {
	let article = await distill(url, { userAgent: "MyApp/1.0 (+https://myapp.example/about)" });
	if (isFailure(article)) return null;
	return article.data.chars > excerpt.length ? article.data.html : null;
}
```

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published, written
`YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out
per day.

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

A caret or tilde range reads the date as major, minor and patch, so it accepts every later
release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
