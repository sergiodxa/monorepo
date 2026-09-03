# @sdxc/http

HTTP utilities for building Request and Response objects with proper Content-Type headers and status codes.

## Overview

This package provides type-safe helpers for working with the Fetch API's Request and Response objects. It eliminates boilerplate around Content-Type headers, status codes, and content negotiation.

The package is organized into modules that can be imported independently:

- `@sdxc/http/content-type` - Content-Type string constants
- `@sdxc/http/status-code` - HTTP status code constants
- `@sdxc/http/request` - Request factory functions
- `@sdxc/http/response` - Response factory functions
- `@sdxc/http/response/json` - JSON responses with status codes
- `@sdxc/http/response/html` - HTML responses with status codes
- `@sdxc/http/negotiate` - Content negotiation utilities
- `@sdxc/http/cache` - Cache policies, validators, and conditional responses

## Usage

### JSON API Responses

```typescript
import { ok, badRequest, notFound } from "@sdxc/http/response/json";

export async function handler(request: Request): Promise<Response> {
	let userId = new URL(request.url).searchParams.get("id");
	if (!userId) return badRequest({ error: "Missing user ID" });

	let user = await getUser(userId);
	if (!user) return notFound({ error: "User not found" });

	return ok({ user });
}
```

### HTML Responses

```typescript
import { ok, notFound } from "@sdxc/http/response/html";

export async function handler(request: Request): Promise<Response> {
	let page = await getPage(request.url);
	if (!page) return notFound("<h1>Page Not Found</h1>");
	return ok(renderPage(page));
}
```

### Content Negotiation

```typescript
import { respond } from "@sdxc/http/negotiate";
import { json, html } from "@sdxc/http/response";

export async function handler(request: Request): Promise<Response> {
	let data = await getData();

	return respond(request, {
		json: () => json(data),
		html: () => html(renderPage(data)),
		default: () => json(data),
	});
}
```

### Cache Policies and Conditional Responses

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

### Creating Requests

```typescript
import { json, formURLEncoded } from "@sdxc/http/request";

// JSON POST request
let req = json("https://api.example.com/users", { name: "John" });

// JSON PUT request
let req = json("https://api.example.com/users/1", { name: "Jane" }, { method: "PUT" });

// Form submission
let req = formURLEncoded("https://api.example.com/login", {
	username: "john",
	password: "secret",
});
```

## API

### `@sdxc/http/content-type`

Content-Type string constants for common MIME types.

#### Text Types

- `Text` - `"text/plain; charset=utf-8"`
- `HTML` - `"text/html; charset=utf-8"`
- `CSS` - `"text/css; charset=utf-8"`
- `JavaScript` - `"text/javascript; charset=utf-8"`
- `CSV` - `"text/csv; charset=utf-8"`
- `XML` - `"text/xml; charset=utf-8"`
- `Markdown` - `"text/markdown; charset=utf-8"`

#### Application Types

- `JSON` - `"application/json; charset=utf-8"`
- `PDF` - `"application/pdf"`
- `ZIP` - `"application/zip"`
- `FormURLEncoded` - `"application/x-www-form-urlencoded"`
- `OctetStream` - `"application/octet-stream"`

#### Image Types

- `PNG`, `JPEG`, `GIF`, `WebP`, `SVG`, `ICO`, `AVIF`

#### Audio/Video Types

- `MP3`, `WAV`, `OGG`, `MP4`, `WebMVideo`, `WebMAudio`

#### Font Types

- `WOFF`, `WOFF2`, `TTF`, `OTF`

#### Streaming Types

- `EventStream` - `"text/event-stream"`
- `NDJson` - `"application/x-ndjson"`

**Example:**

```typescript
import { Json, HTML } from "@sdxc/http/content-type";

let headers = new Headers();
headers.set("Content-Type", Json);
```

### `@sdxc/http/status-code`

HTTP status code constants with `status` and `statusText` properties.

#### `Ok`

HTTP 200 OK status.

```typescript
import { Ok } from "@sdxc/http/status-code";

return Response.json(data, Ok); // { status: 200, statusText: "OK" }
```

#### `NotFound`

HTTP 404 Not Found status.

```typescript
import { NotFound } from "@sdxc/http/status-code";

return Response.json({ error: "Not found" }, NotFound);
```

#### Other Status Codes

**2xx:** `Ok`, `Created`, `Accepted`, `NoContent`, `ResetContent`, `PartialContent`

**3xx:** `MovedPermanently`, `Found`, `SeeOther`, `NotModified`, `TemporaryRedirect`, `PermanentRedirect`

**4xx:** `BadRequest`, `Unauthorized`, `PaymentRequired`, `Forbidden`, `NotFound`, `MethodNotAllowed`, `Conflict`, `Gone`, `UnprocessableEntity`, `TooManyRequests`

**5xx:** `InternalServerError`, `NotImplemented`, `BadGateway`, `ServiceUnavailable`, `GatewayTimeout`

### `@sdxc/http/request`

Request factory functions that set Content-Type headers automatically.

#### `json(url, body, init?): Request`

Creates a Request with JSON body. Defaults to POST method.

```typescript
import { json } from "@sdxc/http/request";

let req = json("https://api.example.com/users", { name: "John" });
let req = json("https://api.example.com/users/1", data, { method: "PUT" });
```

#### `text(url, body, init?): Request`

Creates a Request with plain text body.

#### `xml(url, body, init?): Request`

Creates a Request with XML body.

#### `formData(url, body, init?): Request`

Creates a Request with FormData body. Does not set Content-Type (browser sets it with boundary). Accepts `FormData` or `Record<string, string | Blob>`.

```typescript
import { formData } from "@sdxc/http/request";

let req = formData("https://api.example.com/upload", { name: "photo", file: imageBlob });
```

#### `formURLEncoded(url, body, init?): Request`

Creates a Request with URL-encoded form body. Accepts `URLSearchParams` or `Record<string, string>`.

```typescript
import { formURLEncoded } from "@sdxc/http/request";

let req = formURLEncoded("https://api.example.com/login", {
	username: "john",
	password: "secret",
});
```

### `@sdxc/http/response`

Base response factory functions.

#### `json(body, init?): Response`

Creates a JSON response using `Response.json()`.

```typescript
import { json } from "@sdxc/http/response";

return json({ message: "Hello" });
return json({ error: "Not found" }, { status: 404 });
```

#### `text(body, init?): Response`

Creates a plain text response.

```typescript
import { text } from "@sdxc/http/response";

return text("Hello, World!");
```

#### `html(body, init?): Response`

Creates an HTML response.

```typescript
import { html } from "@sdxc/http/response";

return html("<h1>Hello World</h1>");
```

#### `css(body, init?): Response`

Creates a CSS response.

```typescript
import { css } from "@sdxc/http/response";

return css("body { color: red; }");
```

#### `javascript(body, init?): Response`

Creates a JavaScript response.

```typescript
import { javascript } from "@sdxc/http/response";

return javascript("console.log('Hello');");
```

#### `xml(body, init?): Response`

Creates an XML response.

```typescript
import { xml } from "@sdxc/http/response";

return xml("<root><item>Hello</item></root>");
```

#### `csv(body, init?): Response`

Creates a CSV response.

```typescript
import { csv } from "@sdxc/http/response";

return csv("name,age\nJohn,30\nJane,25");
```

#### `markdown(body, init?): Response`

Creates a Markdown response.

```typescript
import { markdown } from "@sdxc/http/response";

return markdown("# Hello World\n\nThis is **bold** text.");
```

#### `pdf(body, init?): Response`

Creates a PDF response. Body can be `Blob`, `ArrayBuffer`, or `ReadableStream`.

```typescript
import { pdf } from "@sdxc/http/response";

return pdf(pdfBlob);
```

#### `file(body, filename, init?): Response`

Creates a file download response with `Content-Disposition: attachment`.

```typescript
import { file } from "@sdxc/http/response";

return file(zipBuffer, "archive.zip");
```

#### `stream(body, init?): Response`

Creates a Server-Sent Events stream response with appropriate headers.

```typescript
import { stream } from "@sdxc/http/response";

return stream(eventStream);
```

#### `noContent(init?): Response`

Creates a 204 No Content response.

```typescript
import { noContent } from "@sdxc/http/response";

return noContent();
```

#### `redirect(target, init?): Response`

Creates a redirect response. Defaults to 307 Temporary Redirect.

```typescript
import { redirect } from "@sdxc/http/response";

return redirect("/login");
return redirect("/dashboard", { status: redirect.Status.Permanent });
```

**Redirect Status Codes:**

- `redirect.Status.SeeOther` (303) - Use for POST-Redirect-GET pattern
- `redirect.Status.Temporary` (307) - Temporary redirect, preserves method
- `redirect.Status.Permanent` (308) - Permanent redirect, preserves method

### `@sdxc/http/response/json`

JSON response helpers with built-in status codes.

#### Success Responses

- `ok(body, init?)` - 200 OK
- `created(body, init?)` - 201 Created
- `accepted(body, init?)` - 202 Accepted

#### Client Error Responses

- `badRequest(body, init?)` - 400 Bad Request
- `unauthorized(body, init?)` - 401 Unauthorized
- `forbidden(body, init?)` - 403 Forbidden
- `notFound(body, init?)` - 404 Not Found
- `conflict(body, init?)` - 409 Conflict
- `unprocessableEntity(body, init?)` - 422 Unprocessable Entity
- `tooManyRequests(body, init?)` - 429 Too Many Requests

#### Server Error Responses

- `internalServerError(body, init?)` - 500 Internal Server Error
- `serviceUnavailable(body, init?)` - 503 Service Unavailable

**Example:**

```typescript
import { ok, badRequest, notFound } from "@sdxc/http/response/json";

return ok({ user: { id: "123", name: "John" } });
return badRequest({ error: "Invalid email format" });
return notFound({ error: "User not found", id: userId });
```

### `@sdxc/http/response/html`

HTML response helpers with built-in status codes. Same functions as `response/json` but for HTML content.

```typescript
import { ok, notFound } from "@sdxc/http/response/html";

return ok("<h1>Welcome</h1>");
return notFound("<h1>Page Not Found</h1>");
```

### `@sdxc/http/negotiate`

Content negotiation utilities based on the `Accept` header.

#### `accepts(request): AcceptList`

Parses the Accept header and returns an AcceptList for querying.

```typescript
import { accepts } from "@sdxc/http/negotiate";

let accept = accepts(request);

if (accept.includes("json")) {
	return json(data);
}

if (accept.includes("html")) {
	return html(renderPage(data));
}
```

#### `AcceptList`

Represents a parsed Accept header. Can be instantiated directly or via `accepts()`.

```typescript
import { AcceptList } from "@sdxc/http/negotiate";

let list = new AcceptList("application/json, text/html;q=0.9");
```

#### `AcceptList.includes(type): boolean`

Checks if a content type is accepted. Supports shorthands: `json`, `html`, `xml`, `text`, `markdown`, `css`, `javascript`, `csv`, `pdf`.

```typescript
let list = new AcceptList("application/json");
list.includes("json"); // true
list.includes("application/json"); // true
list.includes("html"); // false
```

#### `AcceptList.all(): string[]`

Returns all accepted types in preference order.

```typescript
let list = new AcceptList("text/html, application/json;q=0.9");
list.all(); // ["text/html", "application/json"]
```

#### `AcceptList.preferred(...types): string | null`

Returns the most preferred type from the given options.

```typescript
let list = new AcceptList("text/html, application/json;q=0.9");
list.preferred("application/json", "text/html"); // "text/html"
```

#### `AcceptList.toShortType(mimeType): string | null`

Converts a MIME type to its shorthand form.

```typescript
let list = new AcceptList("*/*");
list.toShortType("application/json"); // "json"
list.toShortType("text/html"); // "html"
list.toShortType("application/octet-stream"); // null
```

#### `respond(request, handlers): Response`

Rails-style content negotiation. Calls the appropriate handler based on Accept header preference.

```typescript
import { respond } from "@sdxc/http/negotiate";
import { json, html } from "@sdxc/http/response";

return respond(request, {
	json: () => json(data),
	html: () => html(renderPage(data)),
	default: () => json(data), // Optional fallback
});
```

Returns 406 Not Acceptable if no handler matches and no `default` is provided.

#### `respond.Handlers`

Type for the handlers object passed to `respond()`.

```typescript
import type { respond } from "@sdxc/http/negotiate";

let handlers: respond.Handlers = {
	json: () => json(data),
	html: () => html(renderPage(data)),
};
```

### `@sdxc/http/cache`

Standard HTTP caching: `Cache-Control` policies, validators, and conditional
requests. It composes the typed header classes the framework already ships
(`CacheControl`, `IfNoneMatch`, `IfMatch`, `Vary` from `remix/headers`) and adds
only the layer above them. Vendor cache extensions such as cache tags and purge
APIs are not part of this subpath.

Every age is a `@sdxc/duration` value, so `"1 hour"` reads as an hour at the call
site and is converted to whole seconds internally.

#### `policy(options?): CacheControl`

Builds a `Cache-Control` value from a description of intent. Returns the
framework's `CacheControl`, so the result composes with anything that accepts
that type.

```typescript
import { policy } from "@sdxc/http/cache";

let headers = new Headers({
	"Cache-Control": policy({
		visibility: "public",
		maxAge: "1 hour",
		sMaxAge: "1 day",
		staleWhileRevalidate: "1 week",
		staleIfError: "1 week",
	}),
});
// "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800, stale-if-error=604800"
```

**Options:** `visibility` (`"public" | "private"`), `maxAge`, `sMaxAge`,
`staleWhileRevalidate`, `staleIfError`, `noCache`, `noStore`, `noTransform`,
`mustRevalidate`, `proxyRevalidate`, `immutable`.

`visibility` has no default. Where an edge cache sits in front of the origin,
`public` is what allows one client's body to be served to another, so it is
always written out rather than inferred.

#### `Policies`

The recurring policies, named after the outcome they produce.

```typescript
import { Policies } from "@sdxc/http/cache";

Policies.noStore(); // "no-store"
Policies.private({ maxAge: "5 minutes" }); // "private, max-age=300"
Policies.immutable(); // "public, max-age=31536000, immutable"
Policies.revalidate(); // "private, no-cache"
```

- `noStore()` - nothing stores the response; for one-time payloads.
- `private({ maxAge })` - only the requesting client stores it. The age is
  required, because without one a browser applies its own heuristic freshness.
- `immutable()` - correct only for URLs whose bytes cannot change, meaning
  fingerprinted asset file names.
- `revalidate()` - stored by its own client and revalidated with the origin
  before every reuse. This is the policy for authenticated HTML, which is why it
  includes `private`: a shared cache is bypassed neither by a session cookie nor
  by `no-cache` alone.

#### `etag(body, options?): Promise<Result<string, CryptoError>>`

Derives a validator from the bytes of a payload: SHA-256 through `@sdxc/crypto`,
base64url, quoted. Pass `{ weak: true }` for content that varies in
insignificant ways between renders, such as server-rendered HTML.

```typescript
import { etag } from "@sdxc/http/cache";
import { isSuccess } from "@sdxc/result";

let tag = await etag(body); // '"uU0nuZNNPgilLlLX2n2r-sSE7-N6U4DukIj3rOLvzek"'
let weak = await etag(body, { weak: true }); // 'W/"uU0nuZNNPgilLlLX2n2r-…"'

if (isSuccess(tag)) headers.set("ETag", tag.data);
```

Hashing costs CPU proportional to the payload, so this suits HTML and JSON
responses rather than large bodies that are never revalidated.

#### `lastModified(date): string`

Formats a `Date` or epoch milliseconds as the HTTP-date a `Last-Modified`
validator carries. HTTP dates hold whole seconds, so two writes in the same
second share a validator; a content-derived `ETag` is the stronger choice when
one is available.

```typescript
lastModified(new Date("2015-10-21T07:28:00Z")); // "Wed, 21 Oct 2015 07:28:00 GMT"
```

#### `ifModifiedSince(headers): Date | null`

Reads the `If-Modified-Since` date from a request. Returns `null` when the header
is absent or is not a valid HTTP-date, so callers send the full body rather than
assert freshness they cannot prove. `remix/headers` does not cover this header,
which is why it lives here.

#### `isModifiedSince(modifiedAt, since): boolean`

Whether a resource changed after the copy a client holds. Both times are compared
as whole seconds, and a change in the same second as the client's copy counts as
unmodified.

#### `conditional(request, response): Promise<Response>`

Downgrades a response to a `304` when the request's validators still describe it.
`If-None-Match` is evaluated with weak comparison and decides on its own whenever
present; `If-Modified-Since` is consulted only in its absence.

```typescript
import { conditional } from "@sdxc/http/cache";

let response = await conditional(request, html(body, { headers }));
```

Only a `GET` or `HEAD` answered with `200` is eligible; every other method and
status passes through untouched. The `304` drops the body and keeps only
`Cache-Control`, `Content-Location`, `Date`, `ETag`, `Expires`, and `Vary`.
Repeating `Vary` matters: without it a shared cache can no longer tell which
negotiated variant was validated.

This stays worthwhile behind an edge cache. The cache decides whether the handler
runs; a validator decides whether a body crosses the network to the client.

#### `precondition(request, { etag }): Result<string, PreconditionFailedError>`

Checks a write request's `If-Match` against the resource's current validator, so
a client cannot overwrite a change it never saw. A request with no `If-Match`
passes, `*` passes, and everything else is compared strongly, so weak tags fail.

```typescript
import { precondition } from "@sdxc/http/cache";
import { preconditionFailed } from "@sdxc/http/response/html";
import { isFailure } from "@sdxc/result";

let checked = precondition(request, { etag: current });
if (isFailure(checked)) return preconditionFailed("<h1>Precondition Failed</h1>");
```

The failure is returned rather than thrown, so answering with a `412` stays the
caller's decision.

#### `vary(headers, names): Headers`

Adds request header names to a response's `Vary`, merging into whatever is
already there. The `Headers` object is mutated in place and returned, and names
are normalized to lowercase.

```typescript
import { vary } from "@sdxc/http/cache";

let headers = new Headers({ Vary: "Accept-Encoding" });
vary(headers, ["Accept-Language", "Cookie"]);
headers.get("Vary"); // "accept-encoding, accept-language, cookie"
```

Each listed header multiplies the number of variants a shared cache stores for
the URL, so the list is a cost rather than documentation. Varying on `Cookie`
effectively disables shared caching for any request that carries one; a response
that genuinely differs per user wants `Policies.private()` instead.

## Pattern: API Endpoint with Validation

```typescript
import { ok, badRequest, notFound } from "@sdxc/http/response/json";
import { validate } from "@sdxc/validate";
import { z } from "zod";

let schema = z.object({
	email: z.string().email(),
	name: z.string().min(1),
});

export async function handler(request: Request): Promise<Response> {
	let result = await validate(request, schema);

	if (isFailure(result)) {
		return badRequest({ errors: result.error });
	}

	let user = await createUser(result.data);
	return ok({ user });
}
```

## Pattern: Content Negotiation with Multiple Formats

```typescript
import { accepts, respond } from "@sdxc/http/negotiate";
import { json, html, csv } from "@sdxc/http/response";

export async function handler(request: Request): Promise<Response> {
	let data = await getReport();

	return respond(request, {
		json: () => json(data),
		html: () => html(renderReportPage(data)),
		csv: () => csv(formatAsCsv(data)),
		default: () => json(data),
	});
}
```

## Pattern: File Download

```typescript
import { file } from "@sdxc/http/response";

export async function handler(request: Request): Promise<Response> {
	let reportData = await generateReport();
	let pdfBlob = await renderToPdf(reportData);

	return file(pdfBlob, "monthly-report.pdf");
}
```

## Related Packages

- [`@sdxc/response`](/packages/response) - React Router response helpers using `data()`
- [`@sdxc/validate`](/packages/validate) - Request validation with Zod schemas
- [`@sdxc/result`](/packages/result) - Result type for error handling
- [`@sdxc/crypto`](/packages/crypto) - WebCrypto primitives, used for `ETag` digests
- [`@sdxc/duration`](/packages/duration) - Duration values, used for every cache age

## Tips

1. **Use `@sdxc/http/response/json` for API endpoints** - The status code helpers like `ok()`, `badRequest()`, `notFound()` make your intent clear.
2. **Use `@sdxc/http/response` for custom responses** - When you need a specific Content-Type or want to set the status manually.
3. **Use `respond()` for content negotiation** - It handles Accept header parsing and 406 responses automatically.
4. **Request factories default to POST** - Override with `{ method: "PUT" }` for other methods.
5. **Redirect defaults to 307** - Use `redirect.Status.SeeOther` (303) for POST-Redirect-GET pattern.
6. **Reach for a named policy first** - `Policies.revalidate()` and `Policies.private()` cover
   user-specific responses; write `policy({ visibility: "public", … })` only when a shared cache
   really may store the body, and review every one of those.
7. **Set a validator before calling `conditional()`** - it compares against the response's own
   `ETag` or `Last-Modified`, so without one there is nothing to answer a `304` from.
