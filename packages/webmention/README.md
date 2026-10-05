# @sdxc/webmention

Receive, verify, discover and send Webmentions.

## Installation

```bash
npm add @sdxc/webmention
```

Fallible functions return [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result) values.
It installs alongside this package with [`@sdxc/microformats`](https://www.npmjs.com/package/@sdxc/microformats),
which reads a source's entry, author and response type, and
[`@sdxc/html`](https://www.npmjs.com/package/@sdxc/html), which parses sources once and
sanitizes their content.

[Webmention](https://www.w3.org/TR/webmention/) tells a page it was linked to. The linking site
discovers the linked page's endpoint and POSTs two URLs, `source` and `target`; the receiver
fetches `source`, confirms it links to `target`, and shows it as a reply, a like, a repost, a
bookmark or a plain mention. This package holds the protocol; storage, moderation and queueing
stay with you.

- **`@sdxc/webmention/receiver`** reads the endpoint's request without fetching anything,
  answers it `202` or `400`, and verifies a queued pair in a background task: a bounded fetch of
  `source`, an exact link check, and a display-ready summary read from the source's
  microformats.
- **`@sdxc/webmention/discover`** finds a page's endpoint (`Link` header first, then the first
  `<link>` or `<a>` in document order) and writes the values advertising your own. `endpointOf`
  passes all 23 [webmention.rocks](https://webmention.rocks/) discovery tests.
- **`@sdxc/webmention/sender`** lists an entry's outbound links, plans which targets a create,
  update or delete notifies, and discovers and POSTs one mention.
- **`@sdxc/webmention`** holds the shared `Webmention` types and the three errors.

Every outbound fetch is bounded: HTTP(S) to public hosts only, every redirect hop re-checked,
five hops, one megabyte and five seconds by default. A public host is a name, never an address
literal, outside the reserved suffixes (`localhost`, `local`, `internal`, `test`, `example` and
the like), and a URL carrying credentials is refused. The five seconds cover the redirect chain
and the body read after it.

## Usage

### Receive

Queue verification rather than running it inside the endpoint's request, so an anonymous POST
cannot make your server fetch a URL of the caller's choosing while it waits.

```typescript
import { isFailure } from "@sdxc/result";
import { accepted, parseRequest, rejected } from "@sdxc/webmention/receiver";

export async function webmentionEndpoint(request: Request) {
	let parsed = await parseRequest(request, {
		formData: await request.formData(),
		accepts: (target) => posts.has(target.pathname),
	});
	if (isFailure(parsed)) return rejected(parsed.error);

	await queue.send({ source: parsed.data.source.href, target: parsed.data.target.href });
	return accepted();
}
```

### Verify In The Background

Key stored mentions on the pair: a `linked` outcome upserts, `gone` and `unlinked` delete.

```typescript
import { isFailure } from "@sdxc/result";
import { verify } from "@sdxc/webmention/receiver";

let pair = { source: new URL(message.source), target: new URL(message.target) };
let outcome = await verify(pair, { userAgent: "Example/1.0 (+https://example.com)" });
if (isFailure(outcome)) {
	if (outcome.error.retryable) return message.retry();
	return message.ack();
}

if (outcome.data.status === "linked") await mentions.upsert(pair, outcome.data.mention);
else await mentions.delete(pair);
```

### Send

```typescript
import { outboundLinks, plan, send } from "@sdxc/webmention/sender";

let current = outboundLinks(post.html, post.url);
let previous = await sentTargets(post.url);
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
`Mention.content.html` is already sanitized, with the source as its base URL.

#### `WebmentionRequestError`

A request the specification answers with `400`. `reason` (a `WebmentionRequestReason`) is
`media-type`, `missing`, `invalid-url`, `same-url` or `target-not-accepted`; `message` is the
text `rejected` sends.

#### `WebmentionFetchError`

A fetch that did not finish. `retryable` is `true` for a timeout, a network failure (a body
that broke off mid-read included), or a `5xx`/`429` answer, and `false` for a refused host, a
redirect chain over the limit, or a body over the cap.

#### `WebmentionSendError`

An endpoint that answered a send outside 2xx; `status` is what it answered.

### `@sdxc/webmention/receiver`

#### `parseRequest(request: Request, options: Receiver.ParseOptions): Promise<Result<Webmention.Pair, WebmentionRequestError>>`

Reads `source` and `target` from `options.formData`, the body your framework already read
(the request stream is consumed by then), and checks them in the specification's order: a form-encoded body, both URLs
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

The mention from the entry that responds to `target`, found with `responseTo` from
[`@sdxc/microformats/vocabulary`](https://www.npmjs.com/package/@sdxc/microformats): its
kind, `u-url`, author by the authorship algorithm, sanitized content (or its `summary` as
text), `published` instant, and its name when it is an article. A page with no such entry
is a `mention` named by `title` and authored by the page's representative `h-card`.

#### `Receiver`

Types only: `ParseOptions` (`formData`, `accepts`), `VerifyOptions` (`userAgent`, `maxBytes`,
`timeoutMs`, `maxRedirects`) and `Outcome`.

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

#### `Discover`

Types only: `Options` (the same bounds as `Receiver.VerifyOptions`) and `Advertisement`.

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

#### `Sender`

Types only: `Options` (the same bounds), `Delivery` and `Plan`.

## Pattern: Delete A Post

Serve `410 Gone` from the post's URL first, then notify every past target, so each receiver's
verification sees the deletion and removes its mention:

```typescript
import { plan, send } from "@sdxc/webmention/sender";

let { targets } = plan([], await sentTargets(post.url));
for (let target of targets) {
	await send({ source: new URL(post.url), target }, { userAgent });
}
```

## Pattern: Retry Or Acknowledge

`WebmentionFetchError.retryable` and `WebmentionSendError.status` are what a background task
reads:

```typescript
import { isFailure } from "@sdxc/result";
import { WebmentionFetchError } from "@sdxc/webmention";
import { send } from "@sdxc/webmention/sender";

let delivery = await send(pair, { userAgent });
if (isFailure(delivery)) {
	let error = delivery.error;
	let retry =
		error instanceof WebmentionFetchError
			? error.retryable
			: error.status >= 500 || error.status === 429;
	if (retry) return message.retry();
	return message.ack();
}
```

Rate-limit the endpoint per client IP and verification per source host. Store mentions as
pending and show them once approved; `content.html` is safe to render, and author photos render
best with `referrerpolicy="no-referrer"` and fixed dimensions.

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
		"@sdxc/webmention": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
