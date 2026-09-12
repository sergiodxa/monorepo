# @sdxc/response

Semantic helpers that build [`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response)
objects for JSON APIs and redirects.

Each helper is a named wrapper over
[`Response.json()`](https://developer.mozilla.org/en-US/docs/Web/API/Response/json_static)
with the [status code](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status)
baked in, so a handler says what it means — `notFound({ error })` rather than
`Response.json(body, { status: 404 })` at every call site. Success helpers merge `ok: true`
into the body and error helpers merge `ok: false`, giving a client one field to branch on.

## Installation

```bash
npm add @sdxc/response
```

`redirect` accepts path-only targets through
[`@sdxc/location`](https://www.npmjs.com/package/@sdxc/location), which installs alongside
this package.

## Usage

### Answer With JSON

```typescript
import { notFound, ok } from "@sdxc/response";

let article = await findArticle(slug);
if (!article) return notFound({ error: "Article not found" });

return ok({ article });
```

`ok({ article })` is the response `Response.json({ article, ok: true }, { status: 200 })`
builds, and `notFound({ error })` the one with `status: 404` and `ok: false`.

### Read One Back

The return value is a plain `Response`, so a test or a fetch client reads it the way it
reads any other HTTP response:

```typescript
import { created } from "@sdxc/response";

let response = created({ article: { id: "art_1" } });

response.status; // 201
response.headers.get("Content-Type"); // the JSON type Response.json() sets
await response.json(); // { article: { id: "art_1" }, ok: true }
```

### Redirect

```typescript
import { redirect } from "@sdxc/response";

return redirect("/login");
// 307, Location: /login, null body

return redirect("/articles", { status: redirect.Status.SeeOther });
// 303, Location: /articles
```

### Discriminate Success From Failure

```typescript
let response = await fetch("/api/articles", { method: "POST", body });
let result = await response.json();

if (result.ok) console.log(result.article);
else console.error(result.error);
```

## API

### The Shared Shape

Every JSON helper takes the same two arguments:

```typescript
function helper<T>(input: T, init?: Omit<ResponseInit, "status" | "statusText">): Response;
```

`input` is spread into the body alongside the `ok` discriminant, and `init` is forwarded to
the `Response` for headers and other options. `status` and `statusText` are omitted from
`init` because the helper owns the status — a different status means a different helper.
`ok` is merged after `input`, so the discriminant is always the one the helper stands for.

### Success Responses

Success helpers merge `ok: true` into the body.

#### `ok<T>(input: T, init?): Response`

A `200`. The default answer for a read, or for a write whose result the client wants back.

```typescript
return ok({ articles }, { headers: { "Cache-Control": "public, max-age=60" } });
// 200 { articles: [...], ok: true }
```

#### `created<T>(input: T, init?): Response`

A `201`, for a request that created a resource. Pair it with a `Location` header when the
new resource has a URL.

```typescript
return created({ article }, { headers: { Location: `/articles/${article.id}` } });
// 201 { article: {...}, ok: true }
```

#### `accepted<T>(input: T, init?): Response`

A `202`, for work that was queued rather than finished. Return whatever the client needs to
follow up, such as a job id.

```typescript
return accepted({ jobId: job.id });
// 202 { jobId: "job_1", ok: true }
```

#### `noContent(init?): Response`

A `204` — `new Response(null, { status: 204 })`, with `init` merged in for headers.

This is the one helper that skips `Response.json()`. A `204` means "no representation" and
the platform forbids a body on one, so there is no `ok` field to merge either: the status
alone carries the outcome.

```typescript
await deleteArticle(id);
return noContent();
// 204, response.body === null
```

### Redirects

#### `redirect(target: URL | Location | string, init?: redirect.Init): Response`

A redirect whose `Location` header is `target` and whose body is `null` — the longhand is
`new Response(null, { status, headers: { Location } })`. The status defaults to
`redirect.Status.Temporary` (`307`).

`target` is a `URL`, a string path, or a
[`Location`](https://www.npmjs.com/package/@sdxc/location); anything `Location.canParse`
rejects throws `Invalid redirect target`.

```typescript
import { Location } from "@sdxc/location";
import { redirect } from "@sdxc/response";

redirect(new URL("/dashboard", request.url));

redirect(new Location({ pathname: "/articles", search: "status=draft&page=1" }));
// 307, Location: /articles?status=draft&page=1

redirect("/logout", {
	status: redirect.Status.SeeOther,
	headers: { "Set-Cookie": "session=; Max-Age=0" },
});
```

#### `redirect.Status`

An enum of the three redirect statuses worth using.

| Member      | Status                                                                          | Behavior                                         |
| ----------- | ------------------------------------------------------------------------------- | ------------------------------------------------ |
| `SeeOther`  | [`303`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/303) | Turns the follow-up request into a `GET`         |
| `Temporary` | [`307`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/307) | Preserves the method — a `POST` stays a `POST`   |
| `Permanent` | [`308`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Status/308) | Preserves the method, and is cached as permanent |

Redirect after a successful `POST` with `303`: the default `307` replays the same method at
the new location, and `303` forces the `GET` that post-redirect-get depends on. Numeric
literals work too — `{ status: 303 }` is `{ status: redirect.Status.SeeOther }` — and the
enum reads better at the call site.

#### `redirect.Init`

```typescript
type Init = Omit<ResponseInit, "status" | "statusText"> & {
	status?: redirect.Status;
};
```

### Client Error Responses

Error helpers merge `ok: false` into the body and share the signature of the success
helpers; only the status differs. So `conflict({ error })` is
`Response.json({ error, ok: false }, { status: 409 })`.

| Helper                  | Status | Use it when                                                                      |
| ----------------------- | ------ | -------------------------------------------------------------------------------- |
| `badRequest`            | `400`  | The request itself is malformed — unparseable body, wrong shape, missing field   |
| `unauthorized`          | `401`  | The caller is unknown; send a `WWW-Authenticate` challenge alongside it          |
| `paymentRequired`       | `402`  | The account needs to pay or upgrade before it can do this                        |
| `forbidden`             | `403`  | The caller is known and denied                                                   |
| `notFound`              | `404`  | No such resource, or the caller has no business knowing one exists               |
| `methodNotAllowed`      | `405`  | The path exists but not for this method; pair it with an `Allow` header          |
| `notAcceptable`         | `406`  | Nothing the endpoint produces satisfies the request's `Accept` header            |
| `conflict`              | `409`  | The request contradicts current state — a duplicate record, a concurrent edit    |
| `preconditionFailed`    | `412`  | A conditional header did not hold, such as a failed optimistic-concurrency check |
| `gone`                  | `410`  | The resource was deliberately and permanently removed                            |
| `requestEntityTooLarge` | `413`  | The body or upload is over the size limit                                        |
| `unsupportedMediaType`  | `415`  | The request's `Content-Type` is not one the endpoint accepts                     |
| `unprocessableEntity`   | `422`  | The request parsed fine and failed validation or a business rule                 |
| `tooManyRequests`       | `429`  | The caller is rate limited; send `Retry-After` so they know when to come back    |

```typescript
return unauthorized(
	{ error: "invalid_token" },
	{ headers: { "WWW-Authenticate": `Bearer realm="${issuer}"` } },
);

return unprocessableEntity({ issues: issues.map((issue) => issue.message) });
// 422 { issues: ["Invalid URL"], ok: false }

return tooManyRequests({ error: "Rate limit exceeded" }, { headers: { "Retry-After": "60" } });
```

Reach for `422` over `400` for field-level errors, and key them by field so the client can
attach each message to its input: `400` says the request was unreadable, `422` says it was
read and rejected.

### Server Error Responses

These also merge `ok: false`.

| Helper                | Status | Use it when                                                              |
| --------------------- | ------ | ------------------------------------------------------------------------ |
| `internalServerError` | `500`  | Something broke that is not the caller's fault                           |
| `notImplemented`      | `501`  | The endpoint exists and the functionality is not built                   |
| `badGateway`          | `502`  | An upstream service answered with something unusable                     |
| `serviceUnavailable`  | `503`  | Temporarily down — maintenance, an overloaded dependency, a tripped fuse |
| `gatewayTimeout`      | `504`  | An upstream service took too long                                        |

Log the detail behind a `500` and return a message that gives an attacker nothing. Send
`Retry-After` with a `503` when there is a credible estimate.

## Pattern: Narrowing The Parsed Body

The `ok` field is typed as a literal — `true` on the success helpers, `false` on the error
ones — so a union of the bodies an endpoint can return narrows on a single check:

```typescript
type CreateArticle = { article: Article; ok: true } | { error: string; ok: false };

let result: CreateArticle = await response.json();

if (result.ok) return result.article;
throw new Error(result.error);
```

That check holds regardless of which status the endpoint chose, which is what makes the
field worth merging: the client keeps no list of which statuses are failures.

## Pattern: Asserting On Responses In Tests

Helpers return responses, so a test reads the status and the body directly:

```typescript
import { expect, test } from "vitest";

test("rejects a duplicate slug", async () => {
	let response = await app.fetch(new Request(url, { method: "POST", body }));

	expect(response.status).toBe(409);
	expect(await response.json()).toEqual({ error: "That slug is taken", ok: false });
});
```

## Pattern: Post-Redirect-Get After A Form Submission

A browser that reloads after a `307` resubmits the form, because `307` preserves the
method. Answer a successful submission with `303` so the follow-up is a `GET`:

```typescript
import { redirect } from "@sdxc/response";

await createArticle(input);
return redirect(`/articles/${input.slug}`, { status: redirect.Status.SeeOther });
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
		"@sdxc/response": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
