# @sdxc/response

Semantic helpers that build real `Response` objects for JSON APIs and redirects.

## Overview

Every helper in this package is a thin, named wrapper over `Response.json()` with the
status code baked in, so a handler says what it means (`notFound({ ... })`) instead of
repeating `Response.json(body, { status: 404 })` at every call site.

The one thing the helpers add on top of the platform is a discriminant: success helpers
merge `ok: true` into the body, error helpers merge `ok: false`. A client that parses the
JSON can branch on a single field it can always count on, without inspecting the status
code first, and TypeScript narrows the parsed body from that same field.

The return value is a plain `Response`. It can be returned straight out of a
`remix/router` controller, handed to any fetch handler, or asserted on in a test
with `response.status` and `await response.json()`. Nothing here is tied to a framework;
the package's only dependency is [`@sdxc/location`](/packages/location), which `redirect`
uses to accept path-only targets.

## Usage

### In a controller

```tsx
import { conflict, created } from "@sdxc/response";
import { getServiceContainer } from "@sdxc/service-container";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { createAction } from "remix/router";

import Monitor from "~/app/data/monitor";
import routes from "~/routes/web";

const Body = s.object({ url: s.string(), name: s.string() });

/** POST /api/v1/monitors — registers a monitor for the team. */
export default createAction(routes.api.v1.monitors.create, async (ctx) => {
	let input = s.parse(Body, await ctx.request.json());
	let db = getServiceContainer().get(Database);

	let existing = await Monitor.findByUrl(db, input.url);
	if (existing) return conflict({ error: "That URL is already monitored" });

	let monitor = await Monitor.create(db, input);
	return created({ monitor });
});
```

`created({ monitor })` is a `201` whose body is `{ monitor: {...}, ok: true }`, with
`Content-Type: application/json;charset=utf-8`.

### From the caller's side

Because the helpers return responses, a test or a fetch client reads them the same way it
reads any other HTTP response:

```typescript
let response = created({ monitor: { id: "mon_1" } });

response.status; // 201
response.headers.get("Content-Type"); // "application/json;charset=utf-8"
await response.json(); // { monitor: { id: "mon_1" }, ok: true }
```

### Discriminating success from failure

```typescript
let response = await fetch("/api/v1/monitors", { method: "POST", body });
let result = await response.json();

if (result.ok) console.log(result.monitor);
else console.error(result.error);
```

## API

Every JSON helper has the same shape:

```typescript
function helper<T>(input: T, init?: Init): Response;

type Init = Omit<ResponseInit, "status" | "statusText">;
```

`input` is spread into the response body alongside the `ok` discriminant, and `init` is
forwarded to the `Response` for headers and other options. `status` and `statusText` are
omitted from `Init` on purpose: the helper owns the status, and a caller that wants a
different one should reach for a different helper.

### Success responses (2xx)

Success helpers merge `ok: true` into the body.

#### `ok<T>(input: T, init?: Init): Response`

A `200` response. The default answer for a read, or for a write whose result the client
wants back.

```typescript
return ok({ monitors: await Monitor.listForTeam(db, teamId) });
// 200 { monitors: [...], ok: true }
```

#### `created<T>(input: T, init?: Init): Response`

A `201` response, for when the request created a resource. Pair it with a `Location`
header pointing at the new resource when there is a URL for it.

```typescript
let apiKey = await ApiKey.create(db, input);
return created({ apiKey }, { headers: { Location: `/api/v1/api-keys/${apiKey.id}` } });
// 201 { apiKey: {...}, ok: true }
```

#### `accepted<T>(input: T, init?: Init): Response`

A `202` response, for work that was queued rather than finished. Return whatever the
client needs to follow up, such as a job id.

```typescript
let job = await queue.enqueue("backfill-daily-stats", { monitorId });
return accepted({ jobId: job.id });
// 202 { jobId: "job_1", ok: true }
```

#### `noContent(init?: Init): Response`

A `204` response with a `null` body.

This is the one helper that does not go through `Response.json()`. A `204` means "no
representation", and the platform forbids a body on one — constructing it with
`Response.json()` would attach a JSON payload and throw. So there is no `ok` field to
merge into either: the status alone carries the outcome.

```typescript
await ApiKey.deleteById(db, apiKeyId);
return noContent();
// 204, response.body === null
```

`init` still applies, so headers pass through:

```typescript
return noContent({ headers: { "Clear-Site-Data": '"*"' } });
```

### Redirects (3xx)

#### `redirect(target: URL | Location | string, init?: redirect.Init): Response`

A redirect response with the `Location` header set to `target` and a `null` body.

**Parameters:**

- `target`: a `URL`, a [`Location`](/packages/location), or a string path. Anything
  `Location.canParse` rejects throws `Invalid redirect target`.
- `init`: headers and other response options, plus an optional `status` restricted to
  `redirect.Status`.

**Returns:**

- A `3xx` `Response`. The status defaults to `redirect.Status.Temporary` (307).

**Example:**

```typescript
return redirect("/login");
// 307, Location: /login

return redirect(new URL("/dashboard", ctx.request.url));

let location = new Location({ pathname: "/monitors", search: "status=down&page=1" });
return redirect(location);
// 307, Location: /monitors?status=down&page=1

return redirect("/logout", {
	status: redirect.Status.SeeOther,
	headers: { "Set-Cookie": "session=; Max-Age=0" },
});
```

#### `redirect.Status`

An enum of the three redirect statuses worth using:

| Member      | Status | Behaviour                                        |
| ----------- | ------ | ------------------------------------------------ |
| `SeeOther`  | `303`  | Always turns the follow-up request into a `GET`  |
| `Temporary` | `307`  | Preserves the method — a `POST` stays a `POST`   |
| `Permanent` | `308`  | Preserves the method, and is cached as permanent |

Redirect after a successful `POST` with `303`. The default `307` replays the same method
at the new location, so a browser that re-follows the redirect submits the form again;
`303` forces the `GET` that the POST-Redirect-GET pattern depends on.

Numeric literals work too — `{ status: 303 }` is the same as
`{ status: redirect.Status.SeeOther }` — but the enum reads better at the call site.

### Client error responses (4xx)

Error helpers merge `ok: false` into the body. Their signature is identical to the success
helpers; only the status differs.

#### `badRequest<T>(input: T, init?: Init): Response`

`400`. The request itself is malformed — unparseable body, wrong shape, missing required
field.

```typescript
if (!ctx.request.headers.get("Content-Type")?.includes("application/json")) {
	return badRequest({ error: "Request body must be JSON" });
}
// 400 { error: "Request body must be JSON", ok: false }
```

#### `unauthorized<T>(input: T, init?: Init): Response`

`401`. The caller is not authenticated. Send the `WWW-Authenticate` challenge alongside it
when the endpoint takes a bearer token.

```typescript
return unauthorized(
	{ error: "invalid_token" },
	{ headers: { "WWW-Authenticate": `Bearer realm="${ISSUER}"` } },
);
```

#### `paymentRequired<T>(input: T, init?: Init): Response`

`402`. The account needs to pay or upgrade before it can do this.

#### `forbidden<T>(input: T, init?: Init): Response`

`403`. The caller is authenticated but not allowed. Use this when they are known and
denied; use `unauthorized` when they are unknown.

#### `notFound<T>(input: T, init?: Init): Response`

`404`. No such resource. Also the right answer when a resource exists but the caller has
no business knowing it does.

```typescript
let monitor = await Monitor.findByIdForTeam(db, ctx.apiTeam.id, monitorId);
if (!monitor) return notFound({ error: "Monitor not found" });
```

#### `methodNotAllowed<T>(input: T, init?: Init): Response`

`405`. The path exists but not for this HTTP method. Pair it with an `Allow` header.

#### `notAcceptable<T>(input: T, init?: Init): Response`

`406`. Nothing the endpoint can produce satisfies the request's `Accept` header.

#### `conflict<T>(input: T, init?: Init): Response`

`409`. The request contradicts the current state — a duplicate record, a concurrent edit.

#### `gone<T>(input: T, init?: Init): Response`

`410`. The resource existed and was deliberately removed. Prefer it over `404` when the
removal is known and permanent, such as a retired endpoint.

#### `preconditionFailed<T>(input: T, init?: Init): Response`

`412`. A conditional header (`If-Match`, `If-Unmodified-Since`) did not hold — the usual
answer for a failed optimistic-concurrency check.

#### `requestEntityTooLarge<T>(input: T, init?: Init): Response`

`413`. The body or upload is over the size limit.

#### `unsupportedMediaType<T>(input: T, init?: Init): Response`

`415`. The request's `Content-Type` is not one the endpoint accepts.

#### `unprocessableEntity<T>(input: T, init?: Init): Response`

`422`. The request parsed fine but failed validation or a business rule. Prefer it over
`400` for field-level errors, and return them keyed by field so the client can attach each
message to its input.

```typescript
let result = await validate(ctx.request, CreateMonitorSchema);
if (isFailure(result)) {
	return unprocessableEntity({ issues: result.error.issues.map((issue) => issue.message) });
}
// 422 { issues: ["Invalid URL"], ok: false }
```

#### `tooManyRequests<T>(input: T, init?: Init): Response`

`429`. The caller is rate limited. Send `Retry-After` so they know when to come back.

```typescript
return tooManyRequests({ error: "Rate limit exceeded" }, { headers: { "Retry-After": "60" } });
```

### Server error responses (5xx)

These also merge `ok: false`.

#### `internalServerError<T>(input: T, init?: Init): Response`

`500`. Something broke that is not the caller's fault. Log the detail; return a message
that gives an attacker nothing.

#### `notImplemented<T>(input: T, init?: Init): Response`

`501`. The endpoint exists but the functionality is not built.

#### `badGateway<T>(input: T, init?: Init): Response`

`502`. An upstream service answered with something unusable.

#### `serviceUnavailable<T>(input: T, init?: Init): Response`

`503`. Temporarily down — maintenance, an overloaded dependency, a tripped circuit
breaker. Send `Retry-After` when there is a credible estimate.

#### `gatewayTimeout<T>(input: T, init?: Init): Response`

`504`. An upstream service took too long.

### Types

#### `Init`

```typescript
type Init = Omit<ResponseInit, "status" | "statusText">;
```

#### `redirect.Init`

```typescript
namespace redirect {
	type Init = Omit<ResponseInit, "status" | "statusText"> & {
		status?: redirect.Status;
	};
}
```

## Patterns

### Narrowing the parsed body

The `ok` field is typed as a literal (`true` on success helpers, `false` on error ones),
so a union of the bodies an endpoint can return narrows on a single check:

```typescript
type CreateMonitor = { monitor: Monitor; ok: true } | { error: string; ok: false };

let result: CreateMonitor = await response.json();

if (result.ok) return result.monitor;
throw new Error(result.error);
```

That check works regardless of which status the endpoint chose, which is what makes it
worth merging the field at all — the client does not have to keep a list of which statuses
are failures.

### Asserting on responses in tests

Helpers return responses, so tests read the status and body directly instead of reaching
into a framework-specific wrapper:

```typescript
test("rejects a duplicate URL", async () => {
	let response = await app.fetch(new Request(url, { method: "POST", body }));

	expect(response.status).toBe(409);
	expect(await response.json()).toEqual({ error: "That URL is already monitored", ok: false });
});
```

### Caching a read

`init` reaches the underlying `Response`, so cache headers ride along with the body:

```typescript
return ok({ status }, { headers: { "Cache-Control": "public, max-age=60" } });
```

### Post-redirect-get after a form submission

```typescript
await Monitor.create(db, input);
return redirect(routes.monitors.index.href(), { status: redirect.Status.SeeOther });
```

## Related Packages

- [`@sdxc/location`](/packages/location) - path-only URL builder accepted by `redirect`
- [`@sdxc/result`](/packages/result) - Result type for the error handling that precedes an
  error response
- [`@sdxc/validate`](/packages/validate) - validation failures that map onto
  `unprocessableEntity`

## Tips

1. **Pick the status, not the wrapper** - the helper name is the documentation; reserve
   `internalServerError` for genuine bugs rather than using it as a catch-all.
2. **`422` over `400` for validation** - `400` says the request was unreadable, `422` says
   it was read and rejected.
3. **`303` after a `POST`** - the default `307` preserves the method and can resubmit the
   form; `303` is what makes post-redirect-get work.
4. **Don't hand-merge `ok`** - the helpers add it; passing `ok` in `input` only fights the
   spread that follows it.
5. **`204` carries no body** - if there is anything to say, use `ok()` instead.

## Status Code Reference

| Helper                  | Status | Body                      |
| ----------------------- | ------ | ------------------------- |
| `ok`                    | `200`  | `{ ...input, ok: true }`  |
| `created`               | `201`  | `{ ...input, ok: true }`  |
| `accepted`              | `202`  | `{ ...input, ok: true }`  |
| `noContent`             | `204`  | `null`                    |
| `redirect`              | `307`  | `null`, `Location` header |
| `badRequest`            | `400`  | `{ ...input, ok: false }` |
| `unauthorized`          | `401`  | `{ ...input, ok: false }` |
| `paymentRequired`       | `402`  | `{ ...input, ok: false }` |
| `forbidden`             | `403`  | `{ ...input, ok: false }` |
| `notFound`              | `404`  | `{ ...input, ok: false }` |
| `methodNotAllowed`      | `405`  | `{ ...input, ok: false }` |
| `notAcceptable`         | `406`  | `{ ...input, ok: false }` |
| `conflict`              | `409`  | `{ ...input, ok: false }` |
| `gone`                  | `410`  | `{ ...input, ok: false }` |
| `preconditionFailed`    | `412`  | `{ ...input, ok: false }` |
| `requestEntityTooLarge` | `413`  | `{ ...input, ok: false }` |
| `unsupportedMediaType`  | `415`  | `{ ...input, ok: false }` |
| `unprocessableEntity`   | `422`  | `{ ...input, ok: false }` |
| `tooManyRequests`       | `429`  | `{ ...input, ok: false }` |
| `internalServerError`   | `500`  | `{ ...input, ok: false }` |
| `notImplemented`        | `501`  | `{ ...input, ok: false }` |
| `badGateway`            | `502`  | `{ ...input, ok: false }` |
| `serviceUnavailable`    | `503`  | `{ ...input, ok: false }` |
| `gatewayTimeout`        | `504`  | `{ ...input, ok: false }` |

`redirect` also accepts `303` (`redirect.Status.SeeOther`) and `308`
(`redirect.Status.Permanent`); `307` is the default.
