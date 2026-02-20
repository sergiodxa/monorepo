# @pkg/http

HTTP utilities for building Request and Response objects with proper Content-Type headers and status codes.

## Overview

This package provides type-safe helpers for working with the Fetch API's Request and Response objects. It eliminates boilerplate around Content-Type headers, status codes, and content negotiation.

The package is organized into modules that can be imported independently:

- `@pkg/http/content-type` - Content-Type string constants
- `@pkg/http/status-code` - HTTP status code constants
- `@pkg/http/request` - Request factory functions
- `@pkg/http/response` - Response factory functions
- `@pkg/http/response/json` - JSON responses with status codes
- `@pkg/http/response/html` - HTML responses with status codes
- `@pkg/http/negotiate` - Content negotiation utilities

## Usage

### JSON API Responses

```typescript
import { ok, badRequest, notFound } from "@pkg/http/response/json";

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
import { ok, notFound } from "@pkg/http/response/html";

export async function handler(request: Request): Promise<Response> {
	let page = await getPage(request.url);
	if (!page) return notFound("<h1>Page Not Found</h1>");
	return ok(renderPage(page));
}
```

### Content Negotiation

```typescript
import { respond } from "@pkg/http/negotiate";
import { json, html } from "@pkg/http/response";

export async function handler(request: Request): Promise<Response> {
	let data = await getData();

	return respond(request, {
		json: () => json(data),
		html: () => html(renderPage(data)),
		default: () => json(data),
	});
}
```

### Creating Requests

```typescript
import { json, formURLEncoded } from "@pkg/http/request";

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

### `@pkg/http/content-type`

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
import { JSON, HTML } from "@pkg/http/content-type";

let headers = new Headers();
headers.set("Content-Type", JSON);
```

### `@pkg/http/status-code`

HTTP status code constants with `status` and `statusText` properties.

#### `Ok`

HTTP 200 OK status.

```typescript
import { Ok } from "@pkg/http/status-code";

return Response.json(data, Ok); // { status: 200, statusText: "OK" }
```

#### `NotFound`

HTTP 404 Not Found status.

```typescript
import { NotFound } from "@pkg/http/status-code";

return Response.json({ error: "Not found" }, NotFound);
```

#### Other Status Codes

**2xx:** `Ok`, `Created`, `Accepted`, `NoContent`, `ResetContent`, `PartialContent`

**3xx:** `MovedPermanently`, `Found`, `SeeOther`, `NotModified`, `TemporaryRedirect`, `PermanentRedirect`

**4xx:** `BadRequest`, `Unauthorized`, `PaymentRequired`, `Forbidden`, `NotFound`, `MethodNotAllowed`, `Conflict`, `Gone`, `UnprocessableEntity`, `TooManyRequests`

**5xx:** `InternalServerError`, `NotImplemented`, `BadGateway`, `ServiceUnavailable`, `GatewayTimeout`

### `@pkg/http/request`

Request factory functions that set Content-Type headers automatically.

#### `json(url, body, init?): Request`

Creates a Request with JSON body. Defaults to POST method.

```typescript
import { json } from "@pkg/http/request";

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
import { formData } from "@pkg/http/request";

let req = formData("https://api.example.com/upload", { name: "photo", file: imageBlob });
```

#### `formURLEncoded(url, body, init?): Request`

Creates a Request with URL-encoded form body. Accepts `URLSearchParams` or `Record<string, string>`.

```typescript
import { formURLEncoded } from "@pkg/http/request";

let req = formURLEncoded("https://api.example.com/login", {
	username: "john",
	password: "secret",
});
```

### `@pkg/http/response`

Base response factory functions.

#### `json(body, init?): Response`

Creates a JSON response using `Response.json()`.

```typescript
import { json } from "@pkg/http/response";

return json({ message: "Hello" });
return json({ error: "Not found" }, { status: 404 });
```

#### `text(body, init?): Response`

Creates a plain text response.

```typescript
import { text } from "@pkg/http/response";

return text("Hello, World!");
```

#### `html(body, init?): Response`

Creates an HTML response.

```typescript
import { html } from "@pkg/http/response";

return html("<h1>Hello World</h1>");
```

#### `css(body, init?): Response`

Creates a CSS response.

```typescript
import { css } from "@pkg/http/response";

return css("body { color: red; }");
```

#### `javascript(body, init?): Response`

Creates a JavaScript response.

```typescript
import { javascript } from "@pkg/http/response";

return javascript("console.log('Hello');");
```

#### `xml(body, init?): Response`

Creates an XML response.

```typescript
import { xml } from "@pkg/http/response";

return xml("<root><item>Hello</item></root>");
```

#### `csv(body, init?): Response`

Creates a CSV response.

```typescript
import { csv } from "@pkg/http/response";

return csv("name,age\nJohn,30\nJane,25");
```

#### `markdown(body, init?): Response`

Creates a Markdown response.

```typescript
import { markdown } from "@pkg/http/response";

return markdown("# Hello World\n\nThis is **bold** text.");
```

#### `pdf(body, init?): Response`

Creates a PDF response. Body can be `Blob`, `ArrayBuffer`, or `ReadableStream`.

```typescript
import { pdf } from "@pkg/http/response";

return pdf(pdfBlob);
```

#### `file(body, filename, init?): Response`

Creates a file download response with `Content-Disposition: attachment`.

```typescript
import { file } from "@pkg/http/response";

return file(zipBuffer, "archive.zip");
```

#### `stream(body, init?): Response`

Creates a Server-Sent Events stream response with appropriate headers.

```typescript
import { stream } from "@pkg/http/response";

return stream(eventStream);
```

#### `noContent(init?): Response`

Creates a 204 No Content response.

```typescript
import { noContent } from "@pkg/http/response";

return noContent();
```

#### `redirect(target, init?): Response`

Creates a redirect response. Defaults to 307 Temporary Redirect.

```typescript
import { redirect } from "@pkg/http/response";

return redirect("/login");
return redirect("/dashboard", { status: redirect.Status.Permanent });
```

**Redirect Status Codes:**

- `redirect.Status.SeeOther` (303) - Use for POST-Redirect-GET pattern
- `redirect.Status.Temporary` (307) - Temporary redirect, preserves method
- `redirect.Status.Permanent` (308) - Permanent redirect, preserves method

### `@pkg/http/response/json`

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
import { ok, badRequest, notFound } from "@pkg/http/response/json";

return ok({ user: { id: "123", name: "John" } });
return badRequest({ error: "Invalid email format" });
return notFound({ error: "User not found", id: userId });
```

### `@pkg/http/response/html`

HTML response helpers with built-in status codes. Same functions as `response/json` but for HTML content.

```typescript
import { ok, notFound } from "@pkg/http/response/html";

return ok("<h1>Welcome</h1>");
return notFound("<h1>Page Not Found</h1>");
```

### `@pkg/http/negotiate`

Content negotiation utilities based on the `Accept` header.

#### `accepts(request): AcceptList`

Parses the Accept header and returns an AcceptList for querying.

```typescript
import { accepts } from "@pkg/http/negotiate";

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
import { AcceptList } from "@pkg/http/negotiate";

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
import { respond } from "@pkg/http/negotiate";
import { json, html } from "@pkg/http/response";

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
import type { respond } from "@pkg/http/negotiate";

let handlers: respond.Handlers = {
	json: () => json(data),
	html: () => html(renderPage(data)),
};
```

## Pattern: API Endpoint with Validation

```typescript
import { ok, badRequest, notFound } from "@pkg/http/response/json";
import { validate } from "@pkg/validate";
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
import { accepts, respond } from "@pkg/http/negotiate";
import { json, html, csv } from "@pkg/http/response";

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
import { file } from "@pkg/http/response";

export async function handler(request: Request): Promise<Response> {
	let reportData = await generateReport();
	let pdfBlob = await renderToPdf(reportData);

	return file(pdfBlob, "monthly-report.pdf");
}
```

## Related Packages

- [`@pkg/response`](/packages/response) - React Router response helpers using `data()`
- [`@pkg/validate`](/packages/validate) - Request validation with Zod schemas
- [`@pkg/result`](/packages/result) - Result type for error handling

## Tips

1. **Use `@pkg/http/response/json` for API endpoints** - The status code helpers like `ok()`, `badRequest()`, `notFound()` make your intent clear.
2. **Use `@pkg/http/response` for custom responses** - When you need a specific Content-Type or want to set the status manually.
3. **Use `respond()` for content negotiation** - It handles Accept header parsing and 406 responses automatically.
4. **Request factories default to POST** - Override with `{ method: "PUT" }` for other methods.
5. **Redirect defaults to 307** - Use `redirect.Status.SeeOther` (303) for POST-Redirect-GET pattern.
