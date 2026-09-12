# @sdxc/http

Response builders, content negotiation, and HTTP caching for the Fetch API.

Named status codes and content types, response helpers that carry both, `Accept`
negotiation, and the `Cache-Control` and `ETag` bookkeeping a conditional response needs.
Each concern is its own subpath export, so importing the status codes leaves the caching
layer out of the bundle.

## Installation

```bash
npm add @sdxc/http
```

`etag` and `precondition` report their outcome as a `Result` from
[`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result), which is where `isFailure` and
`isSuccess` come from. Cache ages are written as
[`@sdxc/duration`](https://www.npmjs.com/package/@sdxc/duration) values, digests come from
[`@sdxc/crypto`](https://www.npmjs.com/package/@sdxc/crypto), redirect targets are parsed by
[`@sdxc/location`](https://www.npmjs.com/package/@sdxc/location), and the cache and middleware
subpaths build on the typed headers and router of
[`remix`](https://www.npmjs.com/package/remix). All install alongside this package.

## Usage

Each entry point is imported on its own, so a handler carries only the surface it uses:

- `@sdxc/http/content-type` — MIME type constants for
  [`Content-Type`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Type)
  values.
- `@sdxc/http/status-code` — status and status text pairs, shaped as a `ResponseInit`.
- `@sdxc/http/response` — one builder per content kind.
- `@sdxc/http/response/json` — a JSON body with a named status.
- `@sdxc/http/response/html` — an HTML body with a named status.
- `@sdxc/http/negotiate` — [`Accept`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Accept)
  header parsing and dispatch.
- `@sdxc/http/cache` — `Cache-Control` policies, validators, and conditional requests.
- `@sdxc/http/middleware/head-requests` — router middleware that answers `HEAD` from `GET`.

### Answer With JSON

```typescript
import { badRequest, notFound, ok } from "@sdxc/http/response/json";

export async function handler(request: Request): Promise<Response> {
	let id = new URL(request.url).searchParams.get("id");
	if (!id) return badRequest({ error: "Missing id" });

	let user = await findUser(id);
	if (!user) return notFound({ error: "User not found" });

	return ok({ user });
}
```

Each function writes the status, the status text, and `Content-Type: application/json` for
you, so the name of the function is the whole declaration.

### Serve The Format A Client Asked For

```typescript
import { respond } from "@sdxc/http/negotiate";
import { csv, html, json } from "@sdxc/http/response";

export async function handler(request: Request): Promise<Response> {
	let report = await buildReport();

	return respond(request, {
		json: () => json(report),
		html: () => html(renderReport(report)),
		csv: () => csv(toCsv(report)),
		default: () => json(report),
	});
}
```

Handlers are tried in the order the client's `Accept` header prefers, and one URL serves a
browser, a spreadsheet, and a script. Without a `default`, a request that matches nothing is
answered with a `406 Not Acceptable`. A negotiated response wants `vary(headers, ["Accept"])`
alongside it, so a shared cache keeps the variants apart.

### Cache A Page And Answer Its Revalidations

```typescript
import { conditional, etag, Policies, vary } from "@sdxc/http/cache";
import { html } from "@sdxc/http/response";
import { isSuccess } from "@sdxc/result";

export async function handler(request: Request): Promise<Response> {
	let body = await renderPage();

	let headers = new Headers({ "Cache-Control": Policies.revalidate().toString() });
	vary(headers, ["Accept-Language"]);

	let tag = await etag(body, { weak: true });
	if (isSuccess(tag)) headers.set("ETag", tag.data);

	return await conditional(request, html(body, { headers }));
}
```

The client stores the page and checks back before every reuse; `conditional` answers that
check with a `304` whenever the validator still holds, so the body crosses the network only
when it changed.

### Answer `HEAD` Like `GET`

```typescript
import { headRequests } from "@sdxc/http/middleware/head-requests";
import { html } from "@sdxc/http/response";
import { createRouter } from "remix/router";

let router = createRouter({ middleware: [headRequests()] });

router.get("/page", () => html(renderPage()));
```

A `HEAD` to `/page` now reports the status and headers of the `GET` with no body, and runs
through the same middleware chain, so a guard that refuses one refuses the other.

## API

### `@sdxc/http/content-type`

MIME type constants, each the bare type with no `charset` parameter, so one value both
compares against a parsed header and writes into a new one.

```typescript
import { HTML, Json } from "@sdxc/http/content-type";

headers.set("Content-Type", Json); // "application/json"
```

**Text:** `Text`, `HTML`, `CSS`, `JavaScript`, `CSV`, `XML`, `Markdown`.

**Application:** `Json`, `JSONLines`, `ApplicationXML`, `PDF`, `ZIP`, `GZip`,
`FormURLEncoded`, `OctetStream`, `FormData`.

**Image:** `PNG`, `JPEG`, `GIF`, `WebP`, `SVG`, `ICO`, `AVIF`.

**Audio and video:** `MP3`, `WAV`, `OGG`, `WebMAudio`, `MP4`, `WebMVideo`.

**Font:** `WOFF`, `WOFF2`, `TTF`, `OTF`.

**Streaming:** `EventStream`, `NDJson`.

`Json` is spelled that way rather than `JSON` so it does not shadow the global `JSON`.

### `@sdxc/http/status-code`

Each constant is a `{ status, statusText }` object, which is exactly the shape a
`ResponseInit` wants, so it drops straight into a response.

```typescript
import { NotFound } from "@sdxc/http/status-code";

return Response.json({ error: "Not found" }, NotFound); // 404 Not Found
```

**1xx:** `Continue`, `SwitchingProtocols`.

**2xx:** `Ok`, `Created`, `Accepted`, `NoContent`, `ResetContent`, `PartialContent`.

**3xx:** `MultipleChoices`, `MovedPermanently`, `Found`, `SeeOther`, `NotModified`,
`TemporaryRedirect`, `PermanentRedirect`.

**4xx:** `BadRequest`, `Unauthorized`, `PaymentRequired`, `Forbidden`, `NotFound`,
`MethodNotAllowed`, `NotAcceptable`, `ProxyAuthRequired`, `RequestTimeout`, `Conflict`,
`Gone`, `LengthRequired`, `PreconditionFailed`, `PayloadTooLarge`, `URITooLong`,
`UnsupportedMediaType`, `RangeNotSatisfiable`, `ExpectationFailed`, `ImATeapot`,
`UnprocessableEntity`, `TooEarly`, `UpgradeRequired`, `PreconditionRequired`,
`TooManyRequests`, `RequestHeaderFieldsTooLarge`, `UnavailableForLegalReasons`.

**5xx:** `InternalServerError`, `NotImplemented`, `BadGateway`, `ServiceUnavailable`,
`GatewayTimeout`, `HTTPVersionNotSupported`.

#### `StatusCode`

The type every constant satisfies: `{ readonly status: number; readonly statusText: string }`.

### `@sdxc/http/response`

Each builder takes a body plus an optional `ResponseInit`, sets the matching `Content-Type`,
and returns a plain
[`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response).

```typescript
import { csv, markdown, xml } from "@sdxc/http/response";

xml("<root><item>Hello</item></root>"); // text/xml
csv("name,age\nAda,36"); // text/csv
markdown("# Hello"); // text/markdown
```

`json(body, init?)` serializes any value through `Response.json`. `text`, `html`, `css`,
`javascript`, `xml`, `csv` and `markdown` each take a string and write their own type.
`pdf(body, init?)` writes `application/pdf` and takes a `Blob`, `ArrayBuffer` or
`ReadableStream`.

#### `file(body: Blob | ArrayBuffer | ReadableStream, filename: string, init?: ResponseInit): Response`

A download: `application/octet-stream` plus
`Content-Disposition: attachment; filename="…"`.

#### `stream(body: ReadableStream, init?: ResponseInit): Response`

A Server-Sent Events stream: `text/event-stream`, `Cache-Control: no-cache`, and
`Connection: keep-alive`.

#### `noContent(init?): Response`

A `204 No Content` with no body. The status is fixed, so `init` carries headers only.

#### `redirect(target: URL | Location | string, init?: redirect.Init): Response`

Writes `Location` and defaults to `307`. The target is validated first, so an unparsable one
throws at the call site rather than reaching a client as a broken redirect.

`redirect.Status` names the three worth choosing between: `SeeOther` (303) turns a `POST`
into a `GET`, while `Temporary` (307) and `Permanent` (308) keep the method.

### `@sdxc/http/response/json`

One function per status, each taking a value plus optional headers and writing the JSON body,
the status, and the status text together.

`ok`, `created`, `accepted`, `badRequest`, `unauthorized`, `paymentRequired`, `forbidden`,
`notFound`, `methodNotAllowed`, `notAcceptable`, `conflict`, `gone`, `preconditionFailed`,
`payloadTooLarge`, `unsupportedMediaType`, `unprocessableEntity`, `tooManyRequests`,
`internalServerError`, `notImplemented`, `badGateway`, `serviceUnavailable`,
`gatewayTimeout`.

```typescript
import { created } from "@sdxc/http/response/json";

return created({ id: user.id }); // 201 Created, application/json
```

### `@sdxc/http/response/html`

The same names, taking an HTML string and writing `text/html`.

```typescript
import { notFound } from "@sdxc/http/response/html";

return notFound("<h1>Page Not Found</h1>"); // 404 Not Found, text/html
```

### `@sdxc/http/negotiate`

#### `accepts(request: Request): AcceptList`

Reads the request's `Accept` header, treating an absent one as `*/*`.

#### `new AcceptList(header: string)`

A parsed `Accept` header, sorted by quality, so preference is queried without re-parsing.

#### `list.includes(type: string): boolean`

Whether a type is accepted. Takes a full MIME type or a shorthand — `json`, `html`, `xml`,
`text`, `markdown`, `css`, `javascript`, `csv`, `pdf` — and a wildcard header matches
everything.

#### `list.all(): string[]`

The accepted types, highest quality first.

#### `list.preferred(...types: string[]): string | null`

The first of your candidates the client asks for, walking its preferences in order. A
wildcard header picks the first candidate, making your own order the tiebreaker.

#### `list.toShortType(mimeType: string): string | null`

The shorthand for a MIME type, or `null` when it has none.

```typescript
let list = new AcceptList("text/html, application/json;q=0.9");

list.includes("json"); // true
list.all(); // ["text/html", "application/json"]
list.preferred("application/json", "text/html"); // "text/html"
list.toShortType("application/json"); // "json"
```

#### `respond(request: Request, handlers: respond.Handlers): Response`

Calls the handler for the client's most preferred type, falling back to `default` and
otherwise answering `406 Not Acceptable`.

#### `respond.Handlers`

The handlers object: an optional `() => Response` under each shorthand, plus `default`.

### `@sdxc/http/cache`

`Cache-Control` policies, validators, and conditional requests, built on the typed
`CacheControl`, `IfNoneMatch`, `IfMatch`, and `Vary` classes from `remix/headers`. Every age
is a duration, so `"1 hour"` reads as an hour at the call site and converts to whole seconds
internally.

#### `policy(options?: PolicyOptions): CacheControl`

Builds a
[`Cache-Control`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control)
value from a description of intent, returning the header class itself so the result composes
with anything that accepts one.

```typescript
import { policy } from "@sdxc/http/cache";

policy({ visibility: "public", maxAge: "1 hour", sMaxAge: "1 day" }).toString();
// "public, max-age=3600, s-maxage=86400"
```

`PolicyOptions` carries `visibility` (`"public" | "private"`), the ages `maxAge`, `sMaxAge`,
`staleWhileRevalidate` and `staleIfError`, and the flags `noCache`, `noStore`, `noTransform`,
`mustRevalidate`, `proxyRevalidate` and `immutable`. Only what you pass is emitted.
`visibility` has no default: where an edge cache sits in front of the origin, `public` is
what allows one client's body to be served to another, so it is always written out.

#### `Policies`

The recurring policies, named after the outcome each produces, so the safe answer is also the
short one to write.

```typescript
import { Policies } from "@sdxc/http/cache";

Policies.noStore(); // "no-store"
Policies.private({ maxAge: "5 minutes" }); // "private, max-age=300"
Policies.immutable(); // "public, max-age=31536000, immutable"
Policies.revalidate(); // "private, no-cache"
```

`noStore()` suits one-time payloads and anything a stored copy would turn into a security
problem. `private({ maxAge })` requires its age, because a browser given none applies its own
heuristic freshness. `immutable()` fits URLs whose bytes never change, meaning fingerprinted
asset names. `revalidate()` is the policy for authenticated HTML, and pairs `private` with
`no-cache` because that first directive is what keeps a shared cache out.

#### `etag(body: BinaryLike, options?: EtagOptions): Promise<Result<string, CryptoError>>`

Derives a validator from the bytes of a payload: SHA-256, base64url, quoted. Pass
`{ weak: true }` for content that varies in insignificant ways between renders, such as
server-rendered HTML carrying a timestamp.

```typescript
await etag(body); // '"uU0nuZNNPgilLlLX2n2r-sSE7-N6U4DukIj3rOLvzek"'
await etag(body, { weak: true }); // 'W/"uU0nuZNNPgilLlLX2n2r-…"'
```

Hashing costs CPU proportional to the payload, which suits HTML and JSON responses rather
than large bodies that are never revalidated.

#### `lastModified(date: Date | number): string`

Formats a `Date` or epoch milliseconds as the HTTP-date a `Last-Modified` validator carries.
HTTP dates hold whole seconds, so two writes in the same second share a validator; a
content-derived `ETag` is the stronger choice where one is available.

```typescript
lastModified(new Date("2015-10-21T07:28:00Z")); // "Wed, 21 Oct 2015 07:28:00 GMT"
```

#### `ifModifiedSince(headers: Headers): Date | null`

Reads the `If-Modified-Since` date from a request. An absent or unparsable value reads as
`null`, so callers send the full body rather than assert freshness they cannot prove.

#### `isModifiedSince(modifiedAt: Date | number, since: Date | number): boolean`

Whether a resource changed after the copy a client holds. Both times are compared as whole
seconds, so a change in the same second as the client's copy counts as unmodified.

#### `conditional(request: Request, response: Response): Promise<Response>`

Downgrades a response to a `304` when the request's validators still describe it.
`If-None-Match` is evaluated with weak comparison and decides on its own whenever present;
`If-Modified-Since` is consulted in its absence.

Only a `GET` or `HEAD` answered with `200` is eligible, and every other method and status
passes through untouched, so this is safe at the end of any handler. The `304` keeps only
`Cache-Control`, `Content-Location`, `Date`, `ETag`, `Expires`, and `Vary`. Repeating `Vary`
matters: a shared cache without it can no longer tell which negotiated variant was validated.

#### `precondition(request: Request, options: PreconditionOptions): Result<string, PreconditionFailedError>`

Checks a write request's `If-Match` against the resource's current validator, so a client
cannot overwrite a change it never saw. An absent `If-Match` passes, `*` passes, and every
other value is compared strongly, so a weak tag fails. The failure is returned rather than
thrown, which keeps answering with a `412` your decision.

```typescript
import { precondition } from "@sdxc/http/cache";
import { preconditionFailed } from "@sdxc/http/response/html";
import { isFailure } from "@sdxc/result";

let checked = precondition(request, { etag: current });
if (isFailure(checked)) return preconditionFailed("<h1>Precondition Failed</h1>");
```

#### `PreconditionFailedError`

The failed precondition, carrying the `etag` the resource is actually at for logs and
diagnostics.

#### `vary(headers: Headers, names: string | string[]): Headers`

Adds request header names to a response's
[`Vary`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Vary), merging
into whatever is already there. The `Headers` object is mutated in place and returned, and
names are normalized to lowercase.

```typescript
let headers = new Headers({ Vary: "Accept-Encoding" });
vary(headers, ["Accept-Language", "Cookie"]);
headers.get("Vary"); // "accept-encoding, accept-language, cookie"
```

Each listed header multiplies the variants a shared cache stores for the URL, so the list is
a cost rather than documentation. Varying on `Cookie` leaves shared caching off for any
request that carries one; a response that genuinely differs per user wants
`Policies.private()`.

#### Types

`CacheVisibility`, `PolicyOptions`, `PrivatePolicyOptions`, `EtagOptions`, and
`PreconditionOptions` are exported from this subpath.

### `@sdxc/http/middleware/head-requests`

#### `headRequests(): Middleware`

Router middleware that dispatches a `HEAD` as a `GET`, then strips the body while keeping the
status and headers, as RFC 9110 requires. Place it first in the global chain so `HEAD` runs
through the same auth and rate limiting as `GET`.

## Pattern: A Validated API Endpoint

A `Result` from [`@sdxc/validate`](https://www.npmjs.com/package/@sdxc/validate) and the
status-named JSON helpers put the whole endpoint in one straight line, with each outcome
spelled as the status it answers with:

```typescript
import { badRequest, created } from "@sdxc/http/response/json";
import { isFailure } from "@sdxc/result";
import { validate } from "@sdxc/validate";
import * as s from "remix/data-schema";
import { email, minLength } from "remix/data-schema/checks";

let Signup = s.object({
	email: s.string().pipe(email()),
	name: s.string().pipe(minLength(1)),
});

export async function handler(request: Request): Promise<Response> {
	let result = await validate(request, Signup);
	if (isFailure(result)) return badRequest({ errors: result.error.issues });

	let user = await createUser(result.data);
	return created({ user });
}
```

`validate` reads the
[`Request`](https://developer.mozilla.org/en-US/docs/Web/API/Request) body according to its
`Content-Type`, so the same endpoint accepts JSON and a form submission.

## Pattern: A Conditional Write

Read and write can share one validator: the read hands the client an `ETag`, and the write
requires that same tag back, which is what turns a blind overwrite into a detected conflict:

```typescript
import { etag, precondition } from "@sdxc/http/cache";
import { conflict, ok, preconditionFailed } from "@sdxc/http/response/json";
import { isFailure, unwrap } from "@sdxc/result";

export async function show(id: string): Promise<Response> {
	let doc = await readDocument(id);
	let tag = unwrap(await etag(JSON.stringify(doc)));

	return ok(doc, { headers: { ETag: tag } });
}

export async function update(request: Request, id: string): Promise<Response> {
	let doc = await readDocument(id);
	let current = unwrap(await etag(JSON.stringify(doc)));

	let checked = precondition(request, { etag: current });
	if (isFailure(checked)) return preconditionFailed({ etag: checked.error.etag });

	let saved = await writeDocument(id, await request.json());
	if (!saved) return conflict({ error: "Document changed" });

	return ok(saved);
}
```

## Pattern: A Cached Asset Route

Fingerprinted asset URLs are the one case where a response can be cached for a year without
revalidation, since a new build produces a new URL rather than new bytes at the old one:

```typescript
import { Policies } from "@sdxc/http/cache";
import { css, javascript } from "@sdxc/http/response";

export async function handler(request: Request): Promise<Response> {
	let asset = await readAsset(new URL(request.url).pathname);
	let headers = { "Cache-Control": Policies.immutable().toString() };

	if (asset.type === "css") return css(asset.source, { headers });
	return javascript(asset.source, { headers });
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
		"@sdxc/http": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
