# @sdxc/webmention

Receive, verify, discover and send Webmentions.

## Overview

[Webmention](https://www.w3.org/TR/webmention/) tells a page it was linked to. The linking
site discovers the linked page's endpoint and POSTs two URLs, `source` and `target`; the
receiver fetches `source`, confirms it links to `target`, and shows it as a reply, a like,
a repost, a bookmark or a plain mention.

This package holds the protocol and leaves storage, moderation and queueing to the app:

- **`@sdxc/webmention/receiver`** reads the endpoint's request without fetching anything,
  answers it `202` or `400`, and verifies a queued pair in a background job: a bounded fetch
  of `source`, an exact link check, and a display-ready summary read from the source's
  microformats with [`@sdxc/microformats`](../microformats/README.md).
- **`@sdxc/webmention/discover`** finds a page's endpoint (`Link` header first, then the
  first `<link>` or `<a>` in document order) and writes the values advertising your own.
  `endpointOf` is a pure function run against all 23
  [webmention.rocks](https://webmention.rocks/) discovery tests.
- **`@sdxc/webmention/sender`** lists an entry's outbound links, plans which targets a
  create, update or delete notifies, and discovers and POSTs one mention.
- **`@sdxc/webmention`** holds the shared `Webmention` types and the three errors.

Every outbound fetch goes through [`@sdxc/distill/retrieve`](../distill/README.md): HTTP(S)
to public hosts only, every redirect hop re-checked, five hops, one megabyte, five seconds.

## Usage

### Receive

```typescript
import { accepted, parseRequest, rejected } from "@sdxc/webmention/receiver";
import { isFailure } from "@sdxc/result";

let parsed = await parseRequest(ctx.request, {
	formData: ctx.formData,
	accepts: (target) => Posts.acceptsMentions(ctx.db, target),
});
if (isFailure(parsed)) return rejected(parsed.error);

await dispatcher.enqueue(jobs.webmentions.verify, {
	source: parsed.data.source.href,
	target: parsed.data.target.href,
});
return accepted();
```

### Verify In A Job

```typescript
import { verify } from "@sdxc/webmention/receiver";
import { isFailure } from "@sdxc/result";

let pair = { source: new URL(ctx.input.source), target: new URL(ctx.input.target) };
let outcome = await verify(pair, { userAgent: "Example/1.0 (+https://example.com)" });
if (isFailure(outcome)) {
	if (outcome.error.retryable) return ctx.retry({ delay: "10 minutes" });
	return ctx.ack(outcome.error.message);
}

if (outcome.data.status === "linked") await Mentions.upsert(ctx.db, pair, outcome.data.mention);
else await Mentions.markDeleted(ctx.db, pair);
```

### Send

```typescript
import { outboundLinks, plan, send } from "@sdxc/webmention/sender";

let current = outboundLinks(post.html, post.url);
let previous = await Sends.targetsFor(ctx.db, post.id);
for (let target of plan(current, previous).targets) {
	let delivery = await send(
		{ source: new URL(post.url), target },
		{ userAgent: "Example/1.0 (+https://example.com)" },
	);
}
```

### Advertise

```typescript
import { advertise } from "@sdxc/webmention/discover";

let { header, link } = advertise("https://example.com/webmention");
response.headers.append("Link", header); // <https://example.com/webmention>; rel="webmention"
<link rel={link.rel} href={link.href} />;
```

## API

### `@sdxc/webmention`

#### `Webmention` namespace

`Pair` (`source`, `target` as `URL`s; a repeated pair is an update), `Kind` (`reply`, `like`,
`repost`, `bookmark`, `mention`), `Author` (`name`, `url`, `photo`, each nullable) and
`Mention` (`kind`, `url`, `author`, `content: { html, text } | null`, `name`, `published`).
`Mention.content.html` is already sanitized with `HTML.sanitize` against the source.

#### `WebmentionRequestError`

A request the specification answers with `400`. `reason` is `media-type`, `missing`,
`invalid-url`, `same-url` or `target-not-accepted`; `message` is the text `rejected` sends.

#### `WebmentionFetchError`

A fetch that did not finish. `retryable` is `true` for a timeout, a network failure, a
redirect chain over the limit, or a `5xx`/`429` answer, and `false` for a refused host or a
body over the cap.

#### `WebmentionSendError`

An endpoint that answered a send outside 2xx; `status` is what it answered.

### `@sdxc/webmention/receiver`

#### `parseRequest(request: Request, options: Receiver.ParseOptions): Promise<Result<Webmention.Pair, WebmentionRequestError>>`

Reads `source` and `target` from `options.formData` (the body middleware already consumed
the stream) and checks them in the specification's order: a form-encoded body, both URLs
present, both HTTP(S), `source` on a public host, the two different, and `options.accepts(target)`
true. It fetches nothing.

#### `accepted(location?: string | URL): Response`

`202 Accepted`, with `Location` when you have a status page for the mention.

#### `rejected(error: WebmentionRequestError): Response`

`400 Bad Request` with the error's message as `text/plain`.

#### `verify(pair: Webmention.Pair, options: Receiver.VerifyOptions): Promise<Result<Receiver.Outcome, WebmentionFetchError>>`

Fetches `source` under bounds (`userAgent` required; `maxBytes` 1 MiB, `timeoutMs` 5000 and
`maxRedirects` 5 by default) and answers:

- `{ status: "linked", mention, document, finalUrl }`: the source links to the target;
  `document` is its microformats, `finalUrl` where the redirects ended.
- `{ status: "gone" }`: the source answered `410`.
- `{ status: "unlinked" }`: any other 4xx, a body without the link, or a format that
  carries no links (an image, say).

HTML is parsed once for `linksTo`, the microformats and the `<title>`. A JSON source links
when a string in it is the target, and is summarized like HTML when it is a microformats
document; a text source links when it contains the target.

#### `linksTo(document: DOMDocument, baseUrl: string, target: URL): boolean`

Whether a parsed page links to `target` from an `href`, `src`, `poster` or `data`
attribute, each resolved against the page's `<base href>` or `baseUrl`. Fragments are
ignored on both sides; the URL as plain text, in a comment or in escaped markup is no link.

#### `summarize(document: MF2.Document, source: URL, target: URL, title?: string | null): Webmention.Mention`

The mention from the entry that responds to `target` (`responseTo` in the vocabulary): its
kind, `u-url`, author by the authorship algorithm, sanitized content (or its `summary` as
text), `published` instant, and its name when it is an article. A page with no such entry
is a `mention` named by `title` and authored by the page's representative `h-card`.

### `@sdxc/webmention/discover`

#### `endpointOf(response: Response, finalUrl: string): Promise<URL | null>`

The endpoint a response advertises: the first `Link` value whose `rel` holds `webmention`,
else, for an HTML body, the first `<link href>` or `<a href>` in document order whose `rel`
holds it. Resolved against `finalUrl`, query string kept; an empty `href` is the page itself.

#### `discover(target: string | URL, options: Discover.Options): Promise<Result<URL | null, WebmentionFetchError>>`

Fetches `target` under the same bounds as `verify` and runs discovery. A 4xx target has no
endpoint (`null`); a `5xx` or `429` is a retryable failure; an endpoint on a private host is
a non-retryable failure, so a page cannot point a sender at an internal address.

#### `advertise(endpoint: string | URL): Discover.Advertisement`

`{ header, link }`: the `Link` header value and the `<link>` attributes for your endpoint. A
`URL` is written absolute, a string as given.

### `@sdxc/webmention/sender`

#### `send(pair: Webmention.Pair, options: Sender.Options): Promise<Result<Sender.Delivery, WebmentionFetchError | WebmentionSendError>>`

Discovers the target's endpoint and POSTs the pair form-encoded, following no redirect.
Answers `{ status: "sent", endpoint, code, location }` for any 2xx (`location` absolute, or
`null`), or `{ status: "no-endpoint" }`.

#### `outboundLinks(html: string, baseUrl: string | URL): URL[]`

The `<a>` and `<area>` links in an entry's content, resolved against its URL, HTTP(S) only,
each once in document order, leaving out the entry's own origin.

#### `plan(current: URL[], previous: URL[]): Sender.Plan`

`{ targets }`: the current links, then every previously notified target the post no longer
links to, since the specification has removed links notified too.

## Patterns

### Delete A Post

Serve `410 Gone` from the post's URL first, then notify every past target, so each
receiver's verification sees the deletion and removes its mention:

```typescript
let { targets } = plan([], await Sends.targetsFor(ctx.db, post.id));
await dispatcher.enqueueMany(
	jobs.webmentions.deliver,
	targets.map((target) => ({ source: post.url, target: target.href })),
);
```

### Retry Or Acknowledge

`WebmentionFetchError.retryable` and `WebmentionSendError.status` are what a job reads:

```typescript
let delivery = await send(pair, { userAgent });
if (isFailure(delivery)) {
	let error = delivery.error;
	let retry =
		error instanceof WebmentionFetchError
			? error.retryable
			: error.status >= 500 || error.status === 429;
	if (retry) return ctx.retry({ delay: "1 hour" });
	return ctx.ack(error.message);
}
```

## Related Packages

- [`@sdxc/microformats`](../microformats/README.md) - Reads the source's entry, author and
  response type
- [`@sdxc/distill`](../distill/README.md) - Its `./retrieve` subpath bounds every fetch
- [`@sdxc/html`](../html/README.md) - Parses sources once and sanitizes their content
- [`@sdxc/pagination`](../pagination/README.md) - Parses the `Link` header
- [`@sdxc/jobs`](../jobs/README.md) - Runs verification and delivery in the background

## Tips

1. Never call `verify` inside the endpoint's request; queue it, so an anonymous POST cannot
   make your server fetch a URL of the caller's choosing while it waits.
2. Rate-limit the endpoint per client IP and the verify job per source host.
3. Store mentions `pending` and show them once approved; `content.html` is safe to render,
   and author photos render best with `referrerpolicy="no-referrer"` and fixed dimensions.
4. Key stored mentions on the pair: a `linked` outcome upserts, `gone` and `unlinked` delete.
