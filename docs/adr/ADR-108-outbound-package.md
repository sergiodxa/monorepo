# ADR-108: Outbound Package

## Status

**Accepted** - 2026-10-05

## Background

Several packages and apps fetch a URL that a stranger chose: a feed someone subscribed to, an
article someone saved, the source of a Webmention, an image a post embeds, a site a visitor wants
probed. Each of them has to answer the same questions before and during that request: is the URL
somewhere this Worker should go, does every redirect still point somewhere it should go, how long
may the whole thing take, and how many bytes may the body be.

The answers live in four redirect loops and three body readers, written separately. Two of the
loops are near copies of each other; one checks every hop and one checks none; one has no
deadline. A package that wants the careful version imports it from `@sdxc/distill`, an article
extractor, because that is where it happens to be exported.

## Context

### Current implementations

| Location                                                                                 | Redirect loop                    | Checks each hop                         | Deadline                  | Body cap                                                |
| ---------------------------------------------------------------------------------------- | -------------------------------- | --------------------------------------- | ------------------------- | ------------------------------------------------------- |
| `packages/distill/src/lib/limits.ts` (`follow`, `retrieve`, `readWithin`, `addressable`) | Yes                              | Yes (`isAddressableHost`)               | `AbortSignal.timeout`, 8s | Counted off the stream, 2 MB                            |
| `packages/feed/src/lib/limits.ts` (`retrieve`, `readWithin`)                             | Yes, copied from the same shape  | No                                      | The caller's signal only  | Counted off the stream, 10 MB                           |
| `packages/webmention/src/lib/fetch.ts`                                                   | Through `@sdxc/distill/retrieve` | Yes                                     | 5s                        | 1 MB                                                    |
| `packages/websub/src/lib/read-bytes.ts`                                                  | No                               | No                                      | 10s on `send`             | Counted off the stream, for a `Request` or a `Response` |
| `apps/reader/app/lib/media.ts` `retrieveImage`                                           | Yes, its own                     | Yes (`isRetrievable`)                   | None                      | None                                                    |
| `apps/uptime/app/services/trial-guard.ts` `checkTarget`                                  | No (checks before a probe)       | DNS answers checked through `@sdxc/doh` | n/a                       | n/a                                                     |

`feed` and `distill` share `redirectTarget`, `declaredLength`, `release` and the
`REDIRECT_STATUSES` set line for line.

### Issues identified

| Issue                                                       | Impact                                                                                 |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `feed` follows redirects without checking where they go     | A feed URL a caller checked can redirect to an address no caller would accept          |
| `reader`'s image retrieval has no deadline and no byte cap  | A slow or endless image holds the request open for as long as the origin likes         |
| `webmention` depends on `@sdxc/distill` for its fetch rules | A Webmention package pulls in the article extractor's dependency tree                  |
| Host policies disagree                                      | See ADR-107: the address ranges are inconsistent, and only `uptime` checks DNS answers |
| Four redirect loops                                         | A fix to one, such as releasing redirect bodies, reaches none of the others            |

### The shape those implementations share

Every implementation already uses the same pattern, which the rest of `packages/*` uses too:
plain functions that call the global `fetch` and answer a `Result`.

```typescript
let followed = await follow(url, options); // Result<{ response, url }, …>
let read = await readWithin(followed.data, cap); // Result<{ text, bytes }, …>
```

## Decision

Add `@sdxc/outbound`: the URL check, the redirect walk and the bounded body reads, extracted from
`distill` and `feed` in the shape both already have, with address classification from
`@sdxc/ip` (ADR-107) and optional DNS checks through `@sdxc/doh`.

The package splits along one line. **Checking and following** a URL only matters for the public
internet, so those functions call the global `fetch` themselves. **Reading a body within a cap**
matters for any message, so those functions take a `Request` or `Response` from anywhere: the
global `fetch`, a Durable Object stub, a service binding, `router.fetch`, or a request a handler
received.

### Checking a URL

```typescript
import { checkUrl } from "@sdxc/outbound";

checkUrl("https://example.com/feed.xml"); // success: URL
checkUrl("http://169.254.169.254/latest"); // failure: OutboundError { code: "refused-address" }
checkUrl("https://printer.local/"); // failure: OutboundError { code: "refused-host" }
checkUrl("https://user:pass@example.com/"); // failure: OutboundError { code: "refused-credentials" }
```

- Only `http:` and `https:` pass.
- A URL carrying a username or password is refused, since forwarding a credential someone else
  wrote into a URL is never what a fetcher means to do.
- An address literal passes when `IP.parse` from `@sdxc/ip` reads it and the result `isPublic`. `literals: "refuse"` refuses
  every literal, which is `distill`'s current policy.
- A hostname passes when it has a dot and does not end in a reserved suffix (`localhost`,
  `local`, `internal`, `home.arpa`, `test`, `invalid`, `example`, and the rest of `uptime`'s
  list).
- `ports: "default"` refuses any port but the scheme's own, and a list such as `[80, 443]`
  allows only those, an omitted port counting as the scheme's own; the default allows any port.
- `hosts: "any"` skips the host and address checks while keeping the scheme and credential
  rules, for a caller that fetches its own network on purpose. The default is `"public"`.

### Following a URL

```typescript
import { follow } from "@sdxc/outbound";

let followed = await follow(url, {
	headers: { accept: "application/atom+xml", "user-agent": USER_AGENT },
	timeout: "8 seconds",
	maxRedirects: 5,
	resolve: true,
	signal,
});
// Result<{ response: Response; url: URL; redirects: number }, OutboundError>
```

- Requests use `redirect: "manual"` and `credentials: "omit"`, and the walk sends the same
  headers on every hop.
- `follow` takes every `checkUrl` option, and every hop passes `checkUrl` with that policy, so a
  redirect cannot reach somewhere the first URL could not.
- `timeout` is a `DurationInput` from `@sdxc/duration`, so `"8 seconds"` and `8_000` both work.
- A redirect's body is released before the next hop.
- `timeout` and the caller's `signal` combine through `AbortSignal.any`. The combined signal
  is the one the requests carry, so one deadline covers the chain **and** the body that is read
  afterwards.
- `resolve: true` resolves every hop's hostname through `@sdxc/doh` and refuses it when any
  answer is not public. A Worker cannot pin the connection to the addresses it checked, so this
  narrows DNS rebinding without closing it; the README states the same limit `uptime` documents
  today.
- `follow` is for `GET` and `HEAD`. A request with a body sends it once to a checked URL with
  `redirect: "manual"`, which is what the Webmention sender already does.
- The final response is answered whatever its status. Mapping a status to an error is the
  caller's, since `distill` treats `403` as a refusal and `feed` treats `304` as a success.

### Reading a body

```typescript
import { limitBody, readBytes, readText, release } from "@sdxc/outbound";

await readText(message, { maxBytes: 2 * 1024 * 1024 });
// Result<{ text: string; bytes: number }, OutboundError { code: "too-large" | "timeout" | "network" }>

await readBytes(message, { maxBytes: 64 * 1024 });
// Result<{ data: Uint8Array; bytes: number }, OutboundError>

limitBody(response, { maxBytes: 5 * 1024 * 1024 });
// Response: same status and headers, a body that errors past the cap

release(response.body); // cancels an unread body without waiting on the origin
```

- `message` is a `Request` or a `Response`.
- A `Content-Length` over the cap fails before any of the body is read. The count over the stream
  is what enforces the cap, so a body that lies about its length fails at the same byte.
- `limitBody` is for a body passed through rather than read, such as an image proxy streaming
  an origin's bytes to the client.

### Errors

`OutboundError` carries a `code`, the `url` it concerns, and `retryable`:

| `code`                | `retryable` | When                                             |
| --------------------- | ----------- | ------------------------------------------------ |
| `invalid-url`         | No          | The input does not parse as a URL                |
| `refused-scheme`      | No          | Not HTTP(S)                                      |
| `refused-credentials` | No          | The URL carries a username or password           |
| `refused-port`        | No          | A non-default port under `ports: "default"`      |
| `refused-host`        | No          | A reserved hostname suffix, or no dot            |
| `refused-address`     | No          | A non-public literal, or a non-public DNS answer |
| `too-many-redirects`  | No          | The chain ran past `maxRedirects`                |
| `too-large`           | No          | The body passed `maxBytes`                       |
| `timeout`             | Yes         | The deadline passed                              |
| `network`             | Yes         | `fetch` rejected, or the body stream failed      |

Packages keep their own public error types (`DistillLimitError`, `FeedFetchError`,
`WebmentionFetchError`) and map from `OutboundError` at their boundary, so no package's API
changes because its internals moved.

## Usage Examples

### `distill`

`limits.ts` keeps its policy and drops the mechanism:

```typescript
export async function retrieve(input: URL, options: RetrieveOptions) {
	let followed = await follow(input, {
		headers: { accept: "text/html,application/xhtml+xml", "user-agent": options.userAgent },
		timeout: options.timeoutMs ?? TIMEOUT_MS,
		maxRedirects: options.maxRedirects ?? MAX_REDIRECTS,
		literals: "refuse",
		signal: options.signal,
	});
	if (isFailure(followed)) return failure(toDistillError(followed.error));

	let { response, url } = followed.data;
	if (REFUSING_STATUSES.has(response.status)) {
		release(response.body);
		return failure(new DistillRefusedError(`Refused ${url}: the site answered ${response.status}`));
	}

	return success(followed.data);
}
```

`follow`, `readWithin`, `redirectTarget`, `declaredLength`, `release` and `isAddressableHost`
leave the file, and the `./retrieve` export is removed.

### `feed`

```typescript
let followed = await follow(input, {
	headers: buildConditionalHeaders(options),
	maxRedirects: options.maxRedirects,
	signal: options.signal,
});
if (isFailure(followed)) return failure(toFeedError(followed.error));

let body = await readText(followed.data.response, { maxBytes: options.maxBytes ?? MAX_BYTES });
```

`feed` gains the hop checks it lacks today. A caller fetching from its own network on purpose
passes `hosts: "any"`.

### `webmention`

```typescript
let followed = await follow(source, { headers, timeout: bounds.timeoutMs ?? TIMEOUT_MS });
let read = isSuccess(followed)
	? await readText(followed.data.response, { maxBytes: bounds.maxBytes ?? MAX_BYTES })
	: followed;
```

The dependency on `@sdxc/distill` is replaced by `@sdxc/outbound`.

### Reading a body that did not come from `fetch`

A Durable Object stub, a service binding and `router.fetch` all answer a `Response`, so the caps
apply to them unchanged:

```typescript
let response = await env.FEEDS.get(id).fetch("https://feed/entries");
let entries = await readText(response, { maxBytes: 512 * 1024 });
```

An inbound webhook capped before its signature is verified, which is `websub`'s case today:

```typescript
let body = await readBytes(ctx.request, { maxBytes: 1024 * 1024 });
if (isFailure(body)) return new Response(null, { status: 413 });
```

### `reader`'s image proxy

`retrieveImage` drops its loop and gains the deadline and cap it lacks:

```typescript
export async function retrieveImage(url: string): Promise<Response | null> {
	let followed = await follow(url, {
		headers: { accept: "image/*", "user-agent": MEDIA_USER_AGENT },
		timeout: "10 seconds",
		ports: "default",
	});
	if (isFailure(followed)) return null;

	return limitBody(followed.data.response, { maxBytes: MAX_IMAGE_BYTES });
}
```

### `uptime`'s trial guard

```typescript
let checked = checkUrl(url, { ports: [80, 443] });
if (isFailure(checked)) return failure(new TrialRefusal("blocked-target", checked.error.code));

let resolved = await resolveHost(checked.data);
// Result<string[], OutboundError>, the addresses kept as the grant's record
```

The guard keeps what is specific to an anonymous probe: reading a scheme-less input as
`https://`, the captcha and both budgets.

## Consequences

### Positive

- **One redirect walk:** a fix reaches every caller.
- **Consistent policy:** every outbound fetch checks every hop against the same address table,
  and DNS checks are one option away.
- **Caps for any message:** `readText`, `readBytes` and `limitBody` work on a binding's response
  or an inbound request as well as on the internet's.
- **Familiar shape:** the functions are the ones `distill` and `feed` already call, answering a
  `Result`, so the call sites change by an import more than by a pattern.
- **Smaller dependency trees:** `webmention` stops depending on the article extractor.

### Negative

- **`feed` becomes stricter:** a caller relying on following a redirect into a private address
  needs `hosts: "any"`.
- **`reader`'s images gain a deadline and a size limit:** an image that took longer or was larger
  than the new bounds stops loading.
- **A breaking change to `distill`:** the `./retrieve` export is removed, and `webmention` is its
  only importer.

### Neutral

- **The global `fetch` stays the transport for `follow`.** Bindings never redirect to a stranger,
  so they need the body caps and not the walk, and tests keep mocking outbound HTTP with MSW.

## Implementation Plan

### Phase 1: The package

**Priority:** High
**Estimated Effort:** 4 hours

1. Create `packages/outbound`, public, with `checkUrl`, `resolveHost`, `follow`, `readText`,
   `readBytes`, `limitBody`, `release` and `OutboundError`.
2. Move `distill`'s and `feed`'s limit tests in, and add tests for hop checks, the combined
   deadline covering a slow body, `Content-Length` lies and `limitBody` erroring mid-stream.
3. Write the README, including the DNS rebinding limit.

Depends on ADR-107 Phase 1.

### Phase 2: Packages

**Priority:** High
**Estimated Effort:** 3 hours

1. `distill`, then `webmention`, then `feed`, then `websub`, one commit each.

### Phase 3: Apps

**Priority:** Medium
**Estimated Effort:** 2 hours

1. `apps/reader`: `retrieveImage` and `isRetrievable`.
2. `apps/uptime`: `checkTarget` and `checkResolvedAddresses`.

## Alternatives Considered

### 1. Fetch layers composed over any fetch

A layer would take a fetch-shaped function and return one, composed as
`compose(fetch, [deadline(…), followRedirects(…), refusePrivate(…), maxBytes(…)])`, so the same
rules wrap a Durable Object stub or `router.fetch`.

**Rejected because**: nothing else in `packages/*` is written as composed function wrappers, so
it is a pattern every reader learns for this package alone. Layers must reject rather than answer
a `Result`, since that is fetch's contract; their order changes their behavior; and a capped body
needs a `Response` subclass to keep `url`. The split between checking (public internet only) and
reading (any message) gives bindings the caps that apply to them without any of that.

### 2. A fetch replacement

`outboundFetch(url, init)` would take `fetch`'s arguments plus options.

**Rejected because**: it replaces `fetch` at every call site and cannot apply to a response from
a binding.

### 3. A transport option on `follow`

`follow(url, { through: stub.fetch })` would walk redirects over any fetcher.

**Rejected because**: the repo calls the global `fetch` directly and never takes a fetch
parameter, and no binding a Worker calls redirects to a stranger, which is the only reason to
walk the chain.

### 4. Keep `@sdxc/distill/retrieve` as the shared fetch

**Rejected because**: `feed` and `reader` would depend on an article extractor to fetch an XML
document or an image, and the module's errors are `distill`'s.

## References

- [ADR-107: IP Package](./ADR-107-ip-package.md)
- [OWASP Server-Side Request Forgery Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)

## Current Progress

- [x] Phase 1: The package
- [x] Phase 2: Packages
- [x] Phase 3: Apps

## Notes

- `@sdxc/feed`, `@sdxc/distill` and `@sdxc/webmention` are public, so `@sdxc/outbound` and
  `@sdxc/ip` are public from their first commits.
- This design was chosen over composed fetch layers for familiarity (see Alternatives). If a
  second consumer needs the redirect walk over a binding, that alternative is the one to revisit.
