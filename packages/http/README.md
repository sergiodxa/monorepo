# @sdxc/http

Response builders, content negotiation, and HTTP caching for the Fetch API.

Each concern is its own entry point — status codes, content types, response builders,
`Accept` negotiation, `Cache-Control` and validators, deprecation notices, and `HEAD`
middleware — so a handler imports only the surface it uses.

## Installation

```sh
npm add @sdxc/http
```

It installs alongside [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result) (the
`Result` that `etag` and `precondition` answer),
[`@sdxc/duration`](https://www.npmjs.com/package/@sdxc/duration) (cache ages),
[`@sdxc/crypto`](https://www.npmjs.com/package/@sdxc/crypto),
[`@sdxc/structured-fields`](https://www.npmjs.com/package/@sdxc/structured-fields),
[`@sdxc/link-header`](https://www.npmjs.com/package/@sdxc/link-header) (deprecation notices),
[`@sdxc/location`](https://www.npmjs.com/package/@sdxc/location) and
[`remix`](https://www.npmjs.com/package/remix) (typed headers and the router).

## Usage

### Answer with JSON

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

Each function writes the status, the status text and `Content-Type: application/json`.
`@sdxc/http/response/html` exports the same names for HTML strings.

### Use named statuses and content types

```typescript
import { Json } from "@sdxc/http/content-type";
import { Accepted } from "@sdxc/http/status-code";

let headers = new Headers({ "Content-Type": Json }); // "application/json"
return new Response(JSON.stringify({ queued: true }), { ...Accepted, headers }); // 202 Accepted
```

A status constant is a `{ status, statusText }` pair, the shape `ResponseInit` takes.

### Serve the format the client asked for

```typescript
import { vary } from "@sdxc/http/cache";
import { respond } from "@sdxc/http/negotiate";
import { csv, html, json } from "@sdxc/http/response";

export async function handler(request: Request): Promise<Response> {
	let report = await buildReport();

	let response = respond(request, {
		json: () => json(report),
		html: () => html(renderReport(report)),
		csv: () => csv(toCsv(report)),
		default: () => json(report),
	});

	vary(response.headers, "Accept");
	return response;
}
```

Handlers are tried in the order the `Accept` header prefers; with no `default`, a request
matching none gets `406 Not Acceptable`.

### Cache a page and answer its revalidations

```typescript
import { conditional, etag, Policies } from "@sdxc/http/cache";
import { html } from "@sdxc/http/response";
import { isSuccess } from "@sdxc/result";

export async function handler(request: Request): Promise<Response> {
	let body = await renderPage();
	let headers = new Headers({ "Cache-Control": Policies.revalidate().toString() });

	let tag = await etag(body, { weak: true });
	if (isSuccess(tag)) headers.set("ETag", tag.data);

	return await conditional(request, html(body, { headers }));
}
```

The client checks back before every reuse, and `conditional` answers with a `304` while the
`ETag` still matches.

### Answer `HEAD` like `GET`

```typescript
import { headRequests } from "@sdxc/http/middleware/head-requests";
import { html } from "@sdxc/http/response";
import { createRouter } from "remix/router";

let router = createRouter({ middleware: [headRequests()] });

router.get("/page", () => html(renderPage()));
```

A `HEAD` to `/page` gets the `GET`'s status and headers with no body, through the same
middleware chain.

## API

### `@sdxc/http/content-type`

MIME type constants, each the bare type with no `charset`, so one value both compares
against a parsed header and writes a new one.

- **Text:** `Text`, `HTML`, `CSS`, `JavaScript`, `CSV`, `XML`, `Markdown`
- **Application:** `Json`, `JSONLines`, `ApplicationXML`, `PDF`, `ZIP`, `GZip`,
  `FormURLEncoded`, `OctetStream`, `FormData`
- **Image:** `PNG`, `JPEG`, `GIF`, `WebP`, `SVG`, `ICO`, `AVIF`
- **Audio and video:** `MP3`, `WAV`, `OGG`, `WebMAudio`, `MP4`, `WebMVideo`
- **Font:** `WOFF`, `WOFF2`, `TTF`, `OTF`
- **Streaming:** `EventStream`, `NDJson`

`Json` is spelled so it leaves the global `JSON` unshadowed.

### `@sdxc/http/status-code`

Each constant is a `{ status, statusText }` object that spreads into a `ResponseInit`.

- **1xx:** `Continue`, `SwitchingProtocols`
- **2xx:** `Ok`, `Created`, `Accepted`, `NoContent`, `ResetContent`, `PartialContent`
- **3xx:** `MultipleChoices`, `MovedPermanently`, `Found`, `SeeOther`, `NotModified`,
  `TemporaryRedirect`, `PermanentRedirect`
- **4xx:** `BadRequest`, `Unauthorized`, `PaymentRequired`, `Forbidden`, `NotFound`,
  `MethodNotAllowed`, `NotAcceptable`, `ProxyAuthRequired`, `RequestTimeout`, `Conflict`,
  `Gone`, `LengthRequired`, `PreconditionFailed`, `PayloadTooLarge`, `URITooLong`,
  `UnsupportedMediaType`, `RangeNotSatisfiable`, `ExpectationFailed`, `ImATeapot`,
  `UnprocessableEntity`, `TooEarly`, `UpgradeRequired`, `PreconditionRequired`,
  `TooManyRequests`, `RequestHeaderFieldsTooLarge`, `UnavailableForLegalReasons`
- **5xx:** `InternalServerError`, `NotImplemented`, `BadGateway`, `ServiceUnavailable`,
  `GatewayTimeout`, `HTTPVersionNotSupported`

`StatusCode` is the type every constant satisfies.

### `@sdxc/http/response`

Each builder takes a body plus an optional `ResponseInit`, sets the `Content-Type`, and
returns a plain [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response).

#### `json<T>(body: T, init?: ResponseInit): Response`

Serializes any value through `Response.json`.

#### `text`, `html`, `css`, `javascript`, `xml`, `markdown` `(body: string, init?: ResponseInit): Response`

Write their own type with `charset=utf-8`.

#### `csv(body: string | ReadableStream<Uint8Array>, init?: ResponseInit): Response`

Writes `text/csv; charset=utf-8`; a stream body sends each row as it is written.

#### `pdf(body: Blob | ArrayBuffer | ReadableStream, init?: ResponseInit): Response`

Writes `application/pdf`.

#### `file(body: Blob | ArrayBuffer | ReadableStream, filename: string, init?: ResponseInit): Response`

A download of opaque bytes: `application/octet-stream` plus `attachment(filename)`.

#### `attachment(filename: string): string`

A [`Content-Disposition`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Disposition)
value that saves the response as `filename`. A non-ASCII name gets an ASCII fallback plus an
exact UTF-8 `filename*`.

```typescript
attachment("Café report.csv");
// "attachment; filename=\"Caf_ report.csv\"; filename*=UTF-8''Caf%C3%A9%20report.csv"
```

#### `stream(body: ReadableStream, init?: ResponseInit): Response`

A Server-Sent Events response: `text/event-stream`, `Cache-Control: no-cache` and
`Connection: keep-alive`.

#### `noContent(init?: Omit<ResponseInit, "status" | "statusText">): Response`

A `204 No Content` with no body.

#### `redirect(target: URL | Location | string, init?: redirect.Init): Response`

Writes `Location` with status `307` by default, and throws on a target that does not parse.
`redirect.Status` names `SeeOther` (303, turns a `POST` into a `GET`), `Temporary` (307) and
`Permanent` (308); `redirect.Init` is a `ResponseInit` whose `status` is one of them.

### `@sdxc/http/response/json`

`ok`, `created`, `accepted`, `badRequest`, `unauthorized`, `paymentRequired`, `forbidden`,
`notFound`, `methodNotAllowed`, `notAcceptable`, `conflict`, `gone`, `preconditionFailed`,
`payloadTooLarge`, `unsupportedMediaType`, `unprocessableEntity`, `tooManyRequests`,
`internalServerError`, `notImplemented`, `badGateway`, `serviceUnavailable`,
`gatewayTimeout` — each `(body: T, init?)`, writing a JSON body with its status; `init`
carries headers.

### `@sdxc/http/response/html`

The same names, each taking an HTML string and writing `text/html`.

### `@sdxc/http/negotiate`

#### `accepts(request: Request): AcceptList`

Parses the request's `Accept` header, reading an absent one as `*/*`.

#### `AcceptList`

A parsed `Accept` header sorted by quality. Types are full MIME types or the shorthands
`json`, `html`, `xml`, `text`, `markdown`, `css`, `javascript`, `csv`, `pdf`.

- `new AcceptList(header: string)`
- `includes(type: string): boolean` — whether the type is accepted.
- `all(): string[]` — accepted types, highest quality first.
- `preferred(...types: string[]): string | null` — the candidate the client prefers most; a
  wildcard picks the first candidate.
- `toShortType(mimeType: string): string | null` — the shorthand for a MIME type.

```typescript
let list = new AcceptList("text/html, application/json;q=0.9");
list.preferred("application/json", "text/html"); // "text/html"
```

#### `respond(request: Request, handlers: respond.Handlers): Response`

Calls the handler for the most preferred type, then `default`, then answers
`406 Not Acceptable`. `respond.Handlers` holds an optional `() => Response` per shorthand
plus `default`.

### `@sdxc/http/deprecation`

#### `setDeprecation(headers: Headers, notice: DeprecationNotice): Result<void, DeprecationNoticeError>`

Writes the RFC 9745 `Deprecation` and RFC 8594 `Sunset` fields and their `deprecation` and
`sunset` links, keeping the response's other links. Fails for a sunset earlier than the
deprecation.

```typescript
setDeprecation(response.headers, {
	deprecation: new Date("2026-12-01T00:00:00Z"),
	sunset: new Date("2027-06-01T00:00:00Z"),
	deprecationLink: "https://example.com/changelog",
});
```

#### `getDeprecation(headers: Headers): DeprecationNotice | null`

Reads the notice back on the client, leaving out any field that does not parse.

### `@sdxc/http/cache`

Built on the typed `CacheControl` header from `remix/headers`. Every age is a duration
(`"1 hour"`, `"5 minutes"`), written as whole seconds.

#### `policy(options?: PolicyOptions): CacheControl`

Builds a
[`Cache-Control`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Cache-Control)
header emitting only the options passed: `visibility` (`"public" | "private"`), the ages
`maxAge`, `sMaxAge`, `staleWhileRevalidate` and `staleIfError`, and the flags `noCache`,
`noStore`, `noTransform`, `mustRevalidate`, `proxyRevalidate` and `immutable`.

```typescript
policy({ visibility: "public", maxAge: "1 hour", sMaxAge: "1 day" }).toString();
// "public, max-age=3600, s-maxage=86400"
```

#### `targetedPolicy(options?: PolicyOptions): string` and `parseTargetedPolicy(value: string | null): CacheControl | null`

Write and read [RFC 9213](https://www.rfc-editor.org/rfc/rfc9213) targeted fields such as
`CDN-Cache-Control`, as Structured Field Dictionaries, to give an edge its own lifetime
(`targetedPolicy({ maxAge: "1 day" })` is `"max-age=86400"`). The parser answers `null` for
a field a cache ignores: absent, empty or invalid.

#### `Policies`

The recurring policies, each returning a `CacheControl`:

- `Policies.noStore()` — `no-store`, for one-time and sensitive payloads.
- `Policies.private({ maxAge })` — `private, max-age=…`, a per-user copy fresh for `maxAge`.
- `Policies.immutable()` — `public, max-age=31536000, immutable`, for fingerprinted URLs.
- `Policies.revalidate()` — `private, no-cache`, for authenticated HTML.

#### `etag(body: BinaryLike, options?: EtagOptions): Promise<Result<string, CryptoError>>`

A quoted SHA-256 base64url validator of the bytes; `{ weak: true }` writes a `W/` tag for
content that varies insignificantly between renders.

#### `lastModified(date: Date | number): string`

Formats a date as the HTTP-date a `Last-Modified` header carries, to whole seconds.

#### `ifModifiedSince(headers: Headers): Date | null`

The request's `If-Modified-Since` date, or `null` when absent or unparsable.

#### `isModifiedSince(modifiedAt: Date | number, since: Date | number): boolean`

Whether the resource changed after `since`, compared to the second.

#### `conditional(request: Request, response: Response): Promise<Response>`

Turns a `200` answer to a `GET` or `HEAD` into a `304` when the request's `If-None-Match`
matches the response's `ETag` (or, absent that header, `If-Modified-Since` covers its
`Last-Modified`), keeping only `Cache-Control`,
`Content-Location`, `Date`, `ETag`, `Expires` and `Vary`. Any other response passes through.

#### `precondition(request: Request, options: PreconditionOptions): Result<string, PreconditionFailedError>`

Checks a write's `If-Match` against `options.etag`, the resource's current tag. An absent
`If-Match` or `*` passes; any other value is compared strongly.

#### `PreconditionFailedError`

The failure `precondition` returns, carrying the resource's current `etag`.

#### `vary(headers: Headers, names: string | string[]): Headers`

Merges lowercase names into the
[`Vary`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Vary) header,
mutating and returning `headers`. Each name multiplies the variants a shared cache stores.

#### Types

`CacheVisibility`, `PolicyOptions`, `PrivatePolicyOptions`, `EtagOptions` and
`PreconditionOptions`.

### `@sdxc/http/middleware/head-requests`

#### `headRequests(): Middleware`

Router middleware that dispatches a `HEAD` as a `GET` and drops the body, keeping status and
headers. Place it first in the global chain.

## Pattern: A Validated API Endpoint

Pair [`@sdxc/validate`](https://www.npmjs.com/package/@sdxc/validate) with the status-named
JSON helpers so each outcome reads as the status it answers with.

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

## Pattern: A Conditional Write

The read hands out an `ETag`; the write requires it back, so a client cannot overwrite a
change it never saw.

```typescript
import { etag, precondition } from "@sdxc/http/cache";
import { ok, preconditionFailed } from "@sdxc/http/response/json";
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
	return ok(saved);
}
```

## Pattern: Revalidate by Modification Time

When a record stores its update time, `Last-Modified` validates it, and checking
`If-Modified-Since` first skips loading the body for a client whose copy is current.

```typescript
import { ifModifiedSince, isModifiedSince, lastModified, Policies } from "@sdxc/http/cache";
import { json } from "@sdxc/http/response";
import { NotModified } from "@sdxc/http/status-code";

export async function handler(request: Request, id: string): Promise<Response> {
	let updatedAt = await readArticleUpdatedAt(id);
	let headers = new Headers({
		"Cache-Control": Policies.private({ maxAge: "1 minute" }).toString(),
		"Last-Modified": lastModified(updatedAt),
	});

	let since = ifModifiedSince(request.headers);
	if (since && !isModifiedSince(updatedAt, since)) {
		return new Response(null, { ...NotModified, headers });
	}

	return json(await readArticle(id), { headers });
}
```

`conditional` reaches the same `304` from the response's own `Last-Modified` when the body
is already built.

## Pattern: A Cached Asset Route

Fingerprinted asset URLs change with their bytes, so the response is cached for a year with
no revalidation.

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

## Pattern: A Streamed CSV Download

A streamed `csv` sends rows as they are read, and `attachment` makes the browser save it.

```typescript
import { Policies } from "@sdxc/http/cache";
import { attachment, csv } from "@sdxc/http/response";

export function handler(): Response {
	let encoder = new TextEncoder();
	let body = new ReadableStream<Uint8Array>({
		async start(controller) {
			controller.enqueue(encoder.encode("name,city\r\n"));
			for await (let row of readRows()) {
				controller.enqueue(encoder.encode(`${row.name},${row.city}\r\n`));
			}
			controller.close();
		},
	});

	return csv(body, {
		headers: {
			"Content-Disposition": attachment("Customers – 2026.csv"),
			"Cache-Control": Policies.noStore().toString(),
		},
	});
}
```

## Pattern: Post, Redirect, Get

A form handler answers each outcome with a builder: `303` sends the browser to the new
resource with a `GET`, and an invalid submission re-renders with `422`.

```typescript
import { redirect } from "@sdxc/http/response";
import { unprocessableEntity } from "@sdxc/http/response/html";

export async function handler(request: Request): Promise<Response> {
	let form = await request.formData();
	let title = form.get("title");
	if (typeof title !== "string" || title === "") {
		return unprocessableEntity(renderForm({ error: "Title is required" }));
	}

	let post = await createPost(title);
	return redirect(`/posts/${post.id}`, { status: redirect.Status.SeeOther });
}
```

## Pattern: Server-Sent Events

`stream` sets the event-stream headers; the body is any `ReadableStream` of encoded events.

```typescript
import { stream } from "@sdxc/http/response";

export function handler(request: Request): Response {
	let encoder = new TextEncoder();
	let body = new ReadableStream<Uint8Array>({
		start(controller) {
			let timer = setInterval(() => {
				controller.enqueue(encoder.encode(`data: ${new Date().toISOString()}\n\n`));
			}, 1000);
			request.signal.addEventListener("abort", () => {
				clearInterval(timer);
				controller.close();
			});
		},
	});

	return stream(body);
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
