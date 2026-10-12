# @sdxc/outbound

Check, follow and read URLs a stranger chose: public hosts on every redirect, one deadline, bounded bodies.

A Worker fetching a feed someone subscribed to, a page someone saved or an image a post embeds has
to decide where it will go, re-decide on every redirect, stop waiting at some point and stop reading
at some size. These functions answer those four questions over the global `fetch`, and every one
answers a `Result` instead of throwing. The body readers work on any `Request` or `Response`.

## Installation

```sh
npm add @sdxc/outbound
```

Results come from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result), installed with this
package.

## Usage

### Check a URL

```typescript
import { checkUrl } from "@sdxc/outbound";

checkUrl("https://example.com/feed.xml"); // success: URL
checkUrl("http://169.254.169.254/latest"); // failure: refused-address
checkUrl("https://printer.local/"); // failure: refused-host
checkUrl("https://user:pass@example.com/"); // failure: refused-credentials
checkUrl("https://example.com:8080/", { ports: "default" }); // failure: refused-port
```

No request or lookup is made: the scheme, credentials, port and host are judged from the URL alone.

### Follow it and read the body

```typescript
import { follow, readText } from "@sdxc/outbound";
import { isFailure } from "@sdxc/result";

let followed = await follow("https://example.com/feed.xml", {
	headers: { accept: "application/atom+xml", "user-agent": "ExampleReader/1.0" },
	timeout: "8 seconds",
});
if (isFailure(followed)) return followed;

let { response, url, redirects } = followed.data;
let body = await readText(response, { maxBytes: 2 * 1024 * 1024 });
if (isFailure(body)) return body;

body.data.text; // the feed, at most 2 MB
```

Every redirect passes the same check as the first URL, and `timeout` covers the whole chain plus the
body read afterwards. The final response comes back whatever its status.

### Handle the failure

```typescript
import { follow } from "@sdxc/outbound";
import { isFailure } from "@sdxc/result";

let followed = await follow(input, { timeout: "8 seconds" });
if (isFailure(followed)) {
	let { code, url, retryable } = followed.error;
	if (retryable) return scheduleRetry(url); // timeout or network
	return rejectUrl(code); // refused-host, too-many-redirects, …
}
```

Every failure is one `OutboundError`; its `code` says why and `retryable` says whether a later
attempt can succeed.

## API

### `checkUrl(input: string | URL, options?: CheckOptions): Result<URL, OutboundError>`

Parses a URL and answers it when every rule passes. Only `http:` and `https:` pass, and a URL with a
username or password is refused. An address literal passes when it is public, as judged by
[`@sdxc/ip`](https://www.npmjs.com/package/@sdxc/ip); a name passes when it has a dot and ends in
none of `localhost`, `local`, `internal`, `intranet`, `lan`, `corp`, `private`, `home.arpa`,
`test`, `invalid` or `example`. The rules run on the parsed URL, so hex, octal and trailing-dot
spellings are judged by what they normalize to.

- `hosts`: `"public"` (default) applies the host rules; `"any"` keeps only the scheme and
  credential rules, for a caller reaching its own network on purpose.
- `literals`: `"public"` (default) allows a public address literal; `"refuse"` refuses every one.
- `ports`: `"any"` (default), `"default"` for only the scheme's own port, or a list such as
  `[80, 443]`, where an omitted port counts as the scheme's own.

### `follow(input: string | URL, options?: FollowOptions): Promise<Result<Followed, OutboundError>>`

Requests a URL anonymously (`credentials: "omit"`, only the headers given) and walks redirects
itself, checking every hop with the same `checkUrl` options and releasing each redirect's body.
Answers the final response whatever its status. Beside every `checkUrl` option:

- `method`: `"GET"` (default) or `"HEAD"`.
- `headers`: sent on every hop.
- `timeout`: milliseconds or a duration string such as `"8 seconds"`, covering the chain and the
  body read after it.
- `signal`: the caller's own abort, combined with `timeout`.
- `maxRedirects`: default `5`.
- `resolve`: when `true`, resolves every hop's name with `resolveHost` and refuses it unless every
  address is public. Default `false`; skipped with `hosts: "any"`.

### `resolveHost(url: URL, options?: { signal?: AbortSignal }): Promise<Result<string[], OutboundError>>`

Resolves the host's `A` and `AAAA` records over DNS-over-HTTPS (through
[`@sdxc/doh`](https://www.npmjs.com/package/@sdxc/doh)) and answers every address when all are
public; an address literal answers itself. Fails `refused-host` for a name that does not exist or
has no address, `refused-address` for any non-public or unreadable address, and `network` when the
resolver fails.

### `readText(message: Request | Response, options: { maxBytes: number }): Promise<Result<ReadText, OutboundError>>`

Reads a body as UTF-8 text within a cap. A `Content-Length` over the cap fails before reading;
otherwise the byte count over the stream enforces it and cancels the stream at the first byte past.
Fails `too-large`, `timeout` (past a `follow` deadline) or `network`.

### `readBytes(message: Request | Response, options: { maxBytes: number }): Promise<Result<ReadBytes, OutboundError>>`

The same read, answering the exact bytes in a `Uint8Array`.

### `limitBody(response: Response, options: { maxBytes: number }): Response`

Answers a response with the same status and headers whose body errors with a `too-large`
`OutboundError` at the first chunk past the cap, or immediately when `Content-Length` is over it.
For a body passed through rather than read.

### `release(body: { cancel(): Promise<void> } | null): void`

Cancels an unread body, or a reader of one, without waiting on the origin. `null` is ignored.

### `OutboundError`

The error inside every `Failure`: `code`, the `url` it concerns (the hop that failed, the input text
for `invalid-url`, or `""` for a body with no URL), and `retryable`.

| `code`                | `retryable` | When                                              |
| --------------------- | ----------- | ------------------------------------------------- |
| `invalid-url`         | No          | The input does not parse as a URL                 |
| `refused-scheme`      | No          | Not HTTP(S)                                       |
| `refused-credentials` | No          | The URL carries a username or password            |
| `refused-port`        | No          | A port the `ports` option does not allow          |
| `refused-host`        | No          | A reserved name, a single label, or no address    |
| `refused-address`     | No          | A non-public literal, or a non-public DNS answer  |
| `too-many-redirects`  | No          | The chain ran past `maxRedirects`                 |
| `too-large`           | No          | The body passed `maxBytes`                        |
| `timeout`             | Yes         | The deadline passed                               |
| `network`             | Yes         | `fetch` rejected, a body broke off, or DNS failed |

### Types

`CheckOptions`, `FollowOptions`, `ReadOptions` and `ResolveHostOptions` are the options above.
`Followed` is `{ response, url, redirects }`, where `url` is where the chain ended and the
response's body carries the deadline. `ReadText` is `{ text, bytes }` and `ReadBytes` is
`{ data, bytes }`, `bytes` counting what came off the wire. `OutboundErrorCode` is the union of codes.

## Pattern: Fetching A Subscribed Feed

Map statuses and codes to your own error, and resolve relative links against where the chain ended.

```typescript
import { follow, readText, release } from "@sdxc/outbound";
import { failure, isFailure, success } from "@sdxc/result";

class FeedError extends Error {
	constructor(
		message: string,
		readonly retryable: boolean,
	) {
		super(message);
	}
}

async function fetchFeed(input: string, etag: string | null) {
	let followed = await follow(input, {
		headers: { accept: "application/atom+xml", ...(etag ? { "if-none-match": etag } : {}) },
		timeout: "10 seconds",
	});
	if (isFailure(followed)) {
		return failure(new FeedError(followed.error.message, followed.error.retryable));
	}

	let { response, url } = followed.data;
	if (response.status === 304) {
		release(response.body);
		return success(null);
	}
	if (!response.ok) {
		release(response.body);
		return failure(new FeedError(`Feed answered ${response.status}`, response.status >= 500));
	}

	let body = await readText(response, { maxBytes: 2 * 1024 * 1024 });
	if (isFailure(body)) return failure(new FeedError(body.error.message, body.error.retryable));

	return success({ xml: body.data.text, base: url, etag: response.headers.get("etag") });
}
```

## Pattern: Proxying An Embedded Image

Stream a stranger's image through without buffering it, on standard ports only, with a size cap.

```typescript
import { follow, limitBody, release } from "@sdxc/outbound";
import { isFailure } from "@sdxc/result";

async function proxyImage(src: string) {
	let followed = await follow(src, {
		ports: "default",
		timeout: "10 seconds",
		headers: { accept: "image/*" },
	});
	if (isFailure(followed)) return new Response(null, { status: 404 });

	let { response } = followed.data;
	if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) {
		release(response.body);
		return new Response(null, { status: 404 });
	}

	return limitBody(response, { maxBytes: 5 * 1024 * 1024 });
}
```

## Pattern: Capping An Incoming Body

The readers take any `Request` or `Response`, so a webhook handler reads its own request within a
cap and verifies a signature over the exact bytes.

```typescript
import { readBytes } from "@sdxc/outbound";
import { isFailure } from "@sdxc/result";

async function handleWebhook(request: Request) {
	let body = await readBytes(request, { maxBytes: 1024 * 1024 });
	if (isFailure(body)) {
		return new Response(null, { status: body.error.code === "too-large" ? 413 : 400 });
	}

	if (!(await verifySignature(request.headers, body.data.data))) {
		return new Response(null, { status: 401 });
	}
	return processEvent(new TextDecoder().decode(body.data.data));
}
```

## Pattern: Posting To A URL A Stranger Chose

`follow` sends `GET` or `HEAD`. For a request with a body, such as a webhook delivery, check the URL
yourself, send one `fetch` with `redirect: "manual"`, and treat a redirect as a failure.

```typescript
import { checkUrl, readText, resolveHost } from "@sdxc/outbound";
import { isFailure } from "@sdxc/result";

async function deliver(endpoint: string, payload: unknown) {
	let checked = checkUrl(endpoint, { ports: "default" });
	if (isFailure(checked)) return checked;

	let resolved = await resolveHost(checked.data);
	if (isFailure(resolved)) return resolved;

	let response = await fetch(checked.data, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(payload),
		redirect: "manual",
		credentials: "omit",
		signal: AbortSignal.timeout(5_000),
	});

	let reply = await readText(response, { maxBytes: 64 * 1024 });
	return { status: response.status, reply };
}
```

## Pattern: Checking DNS Answers

`resolve: true` refuses a public name whose records point inside a network, on every hop.

```typescript
import { follow } from "@sdxc/outbound";

let followed = await follow(input, { resolve: true, literals: "refuse", timeout: "8 seconds" });
```

A Worker cannot pin its connection to the addresses that were checked, so a name answering one
address to the check and another to the connection still gets through: this narrows DNS rebinding
without closing it. What holds regardless is reaching your own storage through bindings rather than
URLs, so an escaped request has nothing private to reach.

## Pattern: Reaching Your Own Network On Purpose

`hosts: "any"` keeps the scheme and credential rules, the redirect limit, the deadline and the caps,
for an internal URL an operator configured.

```typescript
import { follow, readText } from "@sdxc/outbound";
import { isFailure } from "@sdxc/result";

let followed = await follow("http://metrics.internal/health", {
	hosts: "any",
	maxRedirects: 0,
	timeout: 2_000,
});
if (isFailure(followed)) return followed;

let body = await readText(followed.data.response, { maxBytes: 16 * 1024 });
```

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published, written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/outbound": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
