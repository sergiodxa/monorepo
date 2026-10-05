# @sdxc/outbound

Check, follow and read URLs a stranger chose: public hosts on every redirect, one deadline, bounded bodies.

A Worker that fetches a feed someone subscribed to, a page someone saved or an image a post embeds has to decide where it is willing to go, re-decide on every redirect, stop waiting at some point, and stop reading at some size. This package answers those four questions with plain functions that call the global `fetch` and answer a `Result`. Checking and following matter only for the public internet; reading within a cap works on any `Request` or `Response`, including one from a Durable Object stub, a service binding or an incoming request.

## Installation

```bash
npm add @sdxc/outbound
```

Every function answers a `Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result), installed with this package.

## Usage

### Checking A URL

```typescript
import { checkUrl } from "@sdxc/outbound";

checkUrl("https://example.com/feed.xml"); // success: URL
checkUrl("http://169.254.169.254/latest"); // failure: OutboundError { code: "refused-address" }
checkUrl("https://printer.local/"); // failure: OutboundError { code: "refused-host" }
checkUrl("https://user:pass@example.com/"); // failure: OutboundError { code: "refused-credentials" }
```

### Following A URL And Reading The Body

```typescript
import { follow, readText } from "@sdxc/outbound";
import { isFailure } from "@sdxc/result";

let followed = await follow(url, {
	headers: { accept: "application/atom+xml", "user-agent": "ExampleReader/1.0" },
	timeout: "8 seconds",
	maxRedirects: 5,
});
if (isFailure(followed)) return followed;

let body = await readText(followed.data.response, { maxBytes: 2 * 1024 * 1024 });
if (isFailure(body)) return body; // too-large, timeout or network
```

The `timeout` covers the whole chain **and** the body read afterwards.

### Capping A Body That Did Not Come From `fetch`

```typescript
import { readBytes } from "@sdxc/outbound";

let body = await readBytes(request, { maxBytes: 1024 * 1024 });
if (isFailure(body)) return new Response(null, { status: 413 });
verifySignature(body.data.data);
```

### Streaming A Capped Body Through

```typescript
import { follow, limitBody } from "@sdxc/outbound";

let followed = await follow(imageUrl, { timeout: "10 seconds", ports: "default" });
if (isFailure(followed)) return new Response(null, { status: 404 });

return limitBody(followed.data.response, { maxBytes: 5 * 1024 * 1024 });
```

## API

### `checkUrl(input, options?): Result<URL, OutboundError>`

Parses a URL and refuses it unless every rule passes. No request or lookup is made.

- Only `http:` and `https:` pass, and a URL carrying a username or password is refused.
- An address literal passes when it is on the public internet, judged by [`@sdxc/ip`](https://www.npmjs.com/package/@sdxc/ip). IPv4-mapped and NAT64 addresses are judged by the IPv4 inside.
- A name passes when it has a dot and does not end in a reserved suffix: `localhost`, `local`, `internal`, `intranet`, `lan`, `corp`, `private`, `home.arpa`, `test`, `invalid` or `example`.

Options:

- `hosts` — `"public"` (default) applies the host rules; `"any"` keeps only the scheme and credential rules, for a caller that reaches its own network on purpose.
- `literals` — `"public"` (default) allows a public address literal; `"refuse"` refuses every literal.
- `ports` — `"any"` (default), `"default"` for only the scheme's own port, or a list such as `[80, 443]`, where an omitted port counts as the scheme's own.

### `follow(input, options?): Promise<Result<Followed, OutboundError>>`

Requests a URL with `redirect: "manual"` and `credentials: "omit"`, and walks the redirect chain itself. Every hop passes `checkUrl` with the same options, so a redirect cannot reach somewhere the first URL could not, and the same headers are sent on every hop. A redirect's body is released before the next hop. The final response is answered whatever its status: mapping a status to an error is the caller's.

Options, beside every `checkUrl` option:

- `method` — `"GET"` (default) or `"HEAD"`. A request with a body is a single `fetch` to a URL `checkUrl` passed.
- `headers` — sent on every hop.
- `timeout` — a number of milliseconds or a duration string such as `"8 seconds"`.
- `signal` — the caller's own abort, combined with `timeout` through `AbortSignal.any`.
- `maxRedirects` — default `5`.
- `resolve` — resolves every hop's name over DNS-over-HTTPS (Cloudflare's resolver, through [`@sdxc/doh`](https://www.npmjs.com/package/@sdxc/doh)) and refuses it when any address is not public. Default `false`.

`Followed` is `{ response, url, redirects }`, where `url` is where the chain ended. The response's body carries the deadline, so reading it after the deadline fails with `timeout`.

### `resolveHost(url, options?): Promise<Result<string[], OutboundError>>`

Resolves the `A` and `AAAA` records of a URL's host and answers every address when all are public. An address literal answers itself. `refused-host` for a name that does not exist or has no address, `refused-address` for any address that is not public or cannot be read, and `network` when the resolver fails. `options.signal` aborts both lookups.

### `readText(message, { maxBytes }): Promise<Result<{ text, bytes }, OutboundError>>`

Reads a `Request` or `Response` body as UTF-8 text. A `Content-Length` over the cap fails before any of the body is read; the count over the stream is what enforces the cap, so a body that lies about its length fails at the same byte and the stream is cancelled.

### `readBytes(message, { maxBytes }): Promise<Result<{ data, bytes }, OutboundError>>`

The same read, keeping the bytes exactly as they arrived in a `Uint8Array`.

### `limitBody(response, { maxBytes }): Response`

The same status and headers, with a body that errors with a `too-large` `OutboundError` at the first chunk past the cap. For a body passed through rather than read.

### `release(body)`

Cancels an unread body, or a reader of one, without waiting on the origin. `null` is ignored.

### `OutboundError`

Carries `code`, the `url` it concerns, and `retryable`.

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

## Pattern: Mapping To Your Own Errors

Keep your package's or app's error type and translate at the boundary.

```typescript
import { follow } from "@sdxc/outbound";
import { failure, isFailure, success } from "@sdxc/result";

class FetchFeedError extends Error {
	constructor(
		message: string,
		readonly retryable: boolean,
	) {
		super(message);
	}
}

async function fetchFeed(url: string) {
	let followed = await follow(url, { timeout: "10 seconds" });
	if (isFailure(followed)) {
		return failure(new FetchFeedError(followed.error.message, followed.error.retryable));
	}
	if (followed.data.response.status === 304) return success(null);
	return success(followed.data.response);
}
```

## Pattern: DNS Rebinding

`resolve: true` and `resolveHost` catch a public name whose records point inside a network. A Worker cannot pin its connection to the addresses that were checked, so a name that answers with a public address to the check and a private one to the connection still gets through. This narrows DNS rebinding and leaves it open. What holds regardless is architectural: a Worker that reaches its own storage through bindings rather than URLs has nothing private for an escaped request to reach.

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
