# @sdxc/distill

Distill the article out of a web page: fetch under bounds, score the candidates, sanitize what
is left.

A page is not a document. It is an article wrapped in navigation, a share rail, a comment
thread and three related-post blocks, and deciding which subtree is the article is a scoring
heuristic rather than a question the markup answers. This package does that scoring, and it
treats the page it scored as what it is — untrusted markup from an origin nobody vetted — so
what comes back out is sanitized before any caller can render it.

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

## Related Packages

- `@sdxc/html` — the parser both packages share, and the sanitizer this calls
- `@sdxc/result` — every answer here is a `Result`

## Tips

- Cache by the article's URL rather than per reader. Nothing about a distilled article is
  about who asked for it, so one distillation serves everybody who opens the same link.
- Cache a failure too, for far less time than a success. A blocked site asked once an hour is
  politer than one asked on every open.
- Compare `chars` against whatever excerpt you already have. An article no longer than the
  excerpt has bought the reader nothing, which is one predicate covering teasers, consent
  interstitials and error pages together.
