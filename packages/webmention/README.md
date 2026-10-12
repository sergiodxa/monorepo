# @sdxc/webmention

Receive, verify, discover and send Webmentions.

[Webmention](https://www.w3.org/TR/webmention/) tells a page it was linked to: the linking site
discovers the page's endpoint and POSTs a `source` and a `target`; the receiver fetches `source`,
confirms it links to `target`, and shows it as a reply, like, repost, bookmark or mention. This
package holds the protocol; storage, moderation and queueing stay with you.

## Installation

```sh
npm add @sdxc/webmention
```

Fallible functions answer a `Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result).
Sources are parsed with [`@sdxc/html`](https://www.npmjs.com/package/@sdxc/html) and read with
[`@sdxc/microformats`](https://www.npmjs.com/package/@sdxc/microformats); both install with it.

Every outbound fetch is bounded: HTTP(S) to public host names only (no address literals, reserved
suffixes such as `localhost`, `internal` or `test`, or URLs carrying credentials), each redirect
hop re-checked, and by default five hops, one megabyte and five seconds for the whole fetch.

## Usage

### Receive

The endpoint only reads and checks the request, then queues verification, so an anonymous POST
never makes your server fetch a URL while the caller waits.

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

### Verify in the background

A mention is keyed by its pair: `linked` upserts it, `gone` and `unlinked` delete it.

```typescript
import { isFailure } from "@sdxc/result";
import { verify } from "@sdxc/webmention/receiver";

let pair = { source: new URL(message.source), target: new URL(message.target) };
let outcome = await verify(pair, { userAgent: "Example/1.0 (+https://example.com)" });
if (isFailure(outcome)) return outcome.error.retryable ? message.retry() : message.ack();

if (outcome.data.status === "linked") await mentions.upsert(pair, outcome.data.mention);
else await mentions.delete(pair);
```

### Advertise your endpoint

```typescript
import { advertise } from "@sdxc/webmention/discover";

let { header, link } = advertise("https://example.com/webmention");
response.headers.append("Link", header); // <https://example.com/webmention>; rel="webmention"
// in the page head: <link rel={link.rel} href={link.href} />
```

### Send

```typescript
import { outboundLinks, plan, send } from "@sdxc/webmention/sender";

let current = outboundLinks(post.html, post.url);
for (let target of plan(current, await sentTargets(post.url)).targets) {
	await send({ source: new URL(post.url), target }, { userAgent: "Example/1.0" });
}
```

## API

### `@sdxc/webmention`

#### `Webmention`

Types only. `Pair` is `{ source: URL; target: URL }`; sending a pair again updates the same
mention. `Kind` is `"reply" | "like" | "repost" | "bookmark" | "mention"`. `Author` has `name`,
`url` and `photo`, each nullable. `Mention` has `kind`, `url` (the entry's `u-url`, else the
source), `author`, `content: { html, text } | null` (`html` already sanitized against the source),
`name` and `published: Date | null`.

#### `WebmentionRequestError`

A request answered `400`. `reason` (a `WebmentionRequestReason`) is `"media-type"`, `"missing"`,
`"invalid-url"`, `"same-url"` or `"target-not-accepted"`; `message` is the body `rejected` sends.

#### `WebmentionFetchError`

A fetch that did not finish. `retryable` is `true` for a timeout, a network failure or a `5xx`
or `429` answer, and `false` for a refused host, too many redirects or a body over the cap.

#### `WebmentionSendError`

An endpoint that answered a send outside 2xx, with that `status`.

### `@sdxc/webmention/receiver`

#### `parseRequest(request: Request, options: Receiver.ParseOptions): Promise<Result<Webmention.Pair, WebmentionRequestError>>`

Checks, in the specification's order, a form-encoded `Content-Type`, both URLs present and
HTTP(S), `source` on a public host, the two different, and `options.accepts(target)`. Pass the
already-read body as `options.formData`. It fetches nothing.

#### `accepted(location?: string | URL): Response`

`202 Accepted`, with `Location` when you have a status page for the mention.

#### `rejected(error: WebmentionRequestError): Response`

`400 Bad Request` with the error's message as `text/plain`.

#### `verify(pair: Webmention.Pair, options: Receiver.VerifyOptions): Promise<Result<Receiver.Outcome, WebmentionFetchError>>`

Fetches `source` under the bounds and answers `{ status: "linked", mention, document, finalUrl }`
(`document` is the source's microformats, `finalUrl` where redirects ended), `{ status: "gone" }`
for a `410`, or `{ status: "unlinked" }` for any other 4xx, a body without the link, or a format
that carries no links. HTML links by attribute, JSON when a string in it is the target (and is
summarized when it is a microformats document), text when it contains the target.

#### `linksTo(document: DOMDocument, baseUrl: string, target: URL): boolean`

Whether a parsed page links to `target` from an `href`, `src`, `poster` or `data` attribute,
resolved against the page's `<base href>` or `baseUrl`, ignoring fragments on both sides.

#### `summarize(document: MF2.Document, source: URL, target: URL, title?: string | null): Webmention.Mention`

The mention from the entry responding to `target`: its kind, `u-url`, author by the authorship
algorithm, sanitized content, `published` instant, and its name when it is an article. A page with
no such entry is a `mention` named `title` and authored by its representative `h-card`.

### `@sdxc/webmention/discover`

#### `discover(target: string | URL, options: Discover.Options): Promise<Result<URL | null, WebmentionFetchError>>`

Fetches `target` under the bounds and answers its endpoint, or `null` when it advertises none or
answers 4xx. An endpoint on a private host is a non-retryable failure.

#### `endpointOf(response: Response, finalUrl: string): Promise<URL | null>`

The endpoint a response you already fetched advertises: the first `Link` value with
`rel="webmention"`, else the first such `<link>` or `<a>` in an HTML body, resolved against
`finalUrl`. An empty `href` names the page itself.

#### `advertise(endpoint: string | URL): Discover.Advertisement`

`{ header, link }`: the `Link` header value and the `<link>` attributes for your endpoint. A `URL`
is written absolute, a string as given.

### `@sdxc/webmention/sender`

#### `send(pair: Webmention.Pair, options: Sender.Options): Promise<Result<Sender.Delivery, WebmentionFetchError | WebmentionSendError>>`

Discovers the target's endpoint and POSTs the pair form-encoded, following no redirect. Answers
`{ status: "sent", endpoint, code, location }` for any 2xx (`location` absolute or `null`), or
`{ status: "no-endpoint" }`.

#### `outboundLinks(html: string, baseUrl: string | URL): URL[]`

The `<a>` and `<area>` links in an entry's content, resolved against its URL, HTTP(S) only, each
once in document order, leaving out the entry's own origin.

#### `plan(current: URL[], previous: URL[]): Sender.Plan`

`{ targets }`: the current links, then every previously notified target the post no longer links
to, so receivers learn a link was removed.

### Types

- `Receiver.ParseOptions`: `formData` and `accepts(target)`, which may be async.
- `Receiver.VerifyOptions`, `Discover.Options`, `Sender.Options`: `userAgent` (required),
  `maxBytes` (default 1 MiB), `timeoutMs` (default 5000) and `maxRedirects` (default 5).
- `Receiver.Outcome`, `Sender.Delivery`, `Sender.Plan`, `Discover.Advertisement`: the results
  described above.

## Pattern: An Endpoint And Its Verification Job

The request handler answers at once; the job verifies, stores the mention as pending moderation,
and retries only what can succeed later.

```typescript
import { isFailure } from "@sdxc/result";
import { accepted, parseRequest, rejected, verify } from "@sdxc/webmention/receiver";

let USER_AGENT = "Example/1.0 (+https://example.com)";

export async function endpoint(request: Request) {
	let parsed = await parseRequest(request, {
		formData: await request.formData(),
		accepts: async (target) =>
			target.origin === "https://example.com" && (await posts.exists(target)),
	});
	if (isFailure(parsed)) return rejected(parsed.error);
	await queue.send({ source: parsed.data.source.href, target: parsed.data.target.href });
	return accepted();
}

export async function verifyJob(message: { source: string; target: string }) {
	let pair = { source: new URL(message.source), target: new URL(message.target) };
	let outcome = await verify(pair, { userAgent: USER_AGENT, timeoutMs: 10_000 });
	if (isFailure(outcome)) {
		if (outcome.error.retryable) throw outcome.error;
		return;
	}
	if (outcome.data.status === "linked") {
		await mentions.upsert(pair, { ...outcome.data.mention, approved: false });
	} else {
		await mentions.delete(pair);
	}
}
```

`mention.content.html` is safe to render as it stands. Rate-limit the endpoint per client IP and
verification per source host, and render author photos with `referrerpolicy="no-referrer"` and
fixed dimensions.

## Pattern: Notify On Create And Update

Record which targets each post notified, so the next update also notifies links you removed.

```typescript
import { isFailure } from "@sdxc/result";
import { outboundLinks, plan, send } from "@sdxc/webmention/sender";

export async function notify(post: { url: string; html: string }) {
	let source = new URL(post.url);
	let current = outboundLinks(post.html, source);
	let { targets } = plan(current, await sent.targetsOf(post.url));

	for (let target of targets) {
		let delivery = await send({ source, target }, { userAgent: "Example/1.0" });
		if (isFailure(delivery)) continue;
		if (delivery.data.status === "sent") await sent.record(post.url, target);
	}
}
```

## Pattern: Delete A Post

Serve `410 Gone` from the post's URL first, then notify every past target, so each receiver's
verification sees the deletion and removes its mention.

```typescript
import { plan, send } from "@sdxc/webmention/sender";

let { targets } = plan([], await sent.targetsOf(post.url));
for (let target of targets) {
	await send({ source: new URL(post.url), target }, { userAgent: "Example/1.0" });
}
```

## Pattern: Retry Or Acknowledge A Send

A fetch error carries `retryable`; an endpoint's refusal carries its `status`.

```typescript
import { isFailure } from "@sdxc/result";
import { WebmentionFetchError } from "@sdxc/webmention";
import { send } from "@sdxc/webmention/sender";

let delivery = await send(pair, { userAgent: "Example/1.0" });
if (isFailure(delivery)) {
	let error = delivery.error;
	let retry =
		error instanceof WebmentionFetchError
			? error.retryable
			: error.status >= 500 || error.status === 429;
	return retry ? message.retry() : message.ack();
}
```

## Pattern: Check A Source You Already Parsed

When you fetch and parse the source yourself, `linksTo` and `summarize` give the same answer
`verify` would.

```typescript
import { parseDocument } from "@sdxc/html/document";
import { fromDocument } from "@sdxc/microformats";
import { isFailure } from "@sdxc/result";
import { linksTo, summarize } from "@sdxc/webmention/receiver";

let source = new URL("https://example.org/reply");
let target = new URL("https://example.com/post");

let document = parseDocument(html);
if (isFailure(document)) return null;
if (!linksTo(document.data, source.href, target)) return null;

let title = document.data.querySelector("title")?.textContent ?? null;
let mention = summarize(fromDocument(document.data, source), source, target, title);
```

## Pattern: Discover Without Sending

`discover` answers whether a page takes Webmentions; `endpointOf` reads a response you fetched
through your own client.

```typescript
import { isFailure } from "@sdxc/result";
import { discover, endpointOf } from "@sdxc/webmention/discover";

let found = await discover("https://example.org/post", { userAgent: "Example/1.0" });
let acceptsMentions = !isFailure(found) && found.data !== null;

let response = await fetch("https://example.org/post");
let endpoint = await endpointOf(response, response.url);
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
