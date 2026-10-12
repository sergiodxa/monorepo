# @sdxc/response

Semantic helpers that build `Response` objects for JSON APIs and redirects.

Each helper names its status code, so a handler says what it means — `notFound({ error })` in place
of `Response.json({ error, ok: false }, { status: 404 })`. Success helpers merge `ok: true` into the
body and error helpers merge `ok: false`, giving a client one field to branch on.

## Installation

```sh
npm add @sdxc/response
```

[`@sdxc/location`](https://www.npmjs.com/package/@sdxc/location) installs alongside it; `redirect`
accepts its `Location` values as targets.

## Usage

### Answer with JSON

```typescript
import { notFound, ok } from "@sdxc/response";

export async function showArticle(slug: string) {
	let article = await findArticle(slug);
	if (!article) return notFound({ error: "Article not found" });
	return ok({ article });
}
```

`ok({ article })` is `Response.json({ article, ok: true }, { status: 200 })`. The result is a plain
[`Response`](https://developer.mozilla.org/en-US/docs/Web/API/Response): `status`, `headers` and
`json()` read the way they do on any other.

### Add headers

The second argument is a `ResponseInit` without `status`, because the helper owns the status.

```typescript
import { created } from "@sdxc/response";

let response = created({ article: { id: "art_1" } }, { headers: { Location: "/articles/art_1" } });

response.status; // 201
await response.json(); // { article: { id: "art_1" }, ok: true }
```

### Answer without a body

```typescript
import { noContent } from "@sdxc/response";

await deleteArticle(id);
return noContent(); // 204, body null
```

### Redirect

```typescript
import { redirect } from "@sdxc/response";

redirect("/login"); // 307, Location: /login
redirect("/articles", { status: redirect.Status.SeeOther }); // 303
```

## API

Every JSON helper shares one signature, and differs only in status and the `ok` value:

```typescript
function helper<T>(input: T, init?: Omit<ResponseInit, "status" | "statusText">): Response;
```

`input` is spread into the body, then `ok` is set on top, so the body's `ok` always matches the
helper. `init` carries headers and any other option through to the `Response`.

### Success

These merge `ok: true` (typed as the literal `true`).

| Helper     | Status | Use it for                                                    |
| ---------- | ------ | ------------------------------------------------------------- |
| `ok`       | `200`  | A read, or a write whose result the client wants back         |
| `created`  | `201`  | A new resource; send its URL in a `Location` header           |
| `accepted` | `202`  | Work queued for later; return what the client follows up with |

### `noContent(init?): Response`

A `204` with a `null` body — `new Response(null, { ...init, status: 204 })`. It carries no `ok`
field; the status alone is the outcome.

### Client errors

These merge `ok: false` (typed as the literal `false`).

| Helper                  | Status | Use it when                                                 |
| ----------------------- | ------ | ----------------------------------------------------------- |
| `badRequest`            | `400`  | The request is unreadable — unparseable body, wrong shape   |
| `unauthorized`          | `401`  | The caller is unknown; send a `WWW-Authenticate` challenge  |
| `paymentRequired`       | `402`  | The account must pay or upgrade first                       |
| `forbidden`             | `403`  | The caller is known and denied                              |
| `notFound`              | `404`  | No such resource, or the caller may not know it exists      |
| `methodNotAllowed`      | `405`  | The path exists for other methods; send an `Allow` header   |
| `notAcceptable`         | `406`  | Nothing the endpoint produces matches the `Accept` header   |
| `conflict`              | `409`  | The request contradicts current state, such as a duplicate  |
| `gone`                  | `410`  | The resource was removed for good                           |
| `preconditionFailed`    | `412`  | A conditional header such as `If-Match` failed              |
| `requestEntityTooLarge` | `413`  | The body is over the size limit                             |
| `unsupportedMediaType`  | `415`  | The `Content-Type` is not one the endpoint accepts          |
| `unprocessableEntity`   | `422`  | The request parsed and failed validation or a business rule |
| `tooManyRequests`       | `429`  | The caller is rate limited; send `Retry-After`              |

### Server errors

These also merge `ok: false`.

| Helper                | Status | Use it when                                             |
| --------------------- | ------ | ------------------------------------------------------- |
| `internalServerError` | `500`  | Something broke that is not the caller's fault          |
| `notImplemented`      | `501`  | The endpoint exists and the feature does not yet        |
| `badGateway`          | `502`  | An upstream service answered with something unusable    |
| `serviceUnavailable`  | `503`  | Temporarily down; send `Retry-After` when you can guess |
| `gatewayTimeout`      | `504`  | An upstream service took too long                       |

### `redirect(target: URL | Location | string, init?: redirect.Init): Response`

A redirect with `target` in the `Location` header and a `null` body, at `307` unless
`init.status` says otherwise. It throws `Invalid redirect target` for a target
[`Location.canParse`](https://www.npmjs.com/package/@sdxc/location) rejects.

### `redirect.Status`

| Member      | Status | Follow-up request                              |
| ----------- | ------ | ---------------------------------------------- |
| `SeeOther`  | `303`  | Always a `GET`                                 |
| `Temporary` | `307`  | Same method — a `POST` stays a `POST`; default |
| `Permanent` | `308`  | Same method, and clients cache the redirect    |

### Types

#### `redirect.Init`

`Omit<ResponseInit, "status" | "statusText"> & { status?: redirect.Status }`.

## Pattern: Validating A Request Body

`400` says the request could not be read; `422` says it was read and rejected. Keying field errors
by name lets the client attach each message to its input.

```typescript
import { badRequest, created, unprocessableEntity } from "@sdxc/response";

export async function createArticle(request: Request) {
	let body: unknown = await request.json().catch(() => null);
	if (typeof body !== "object" || body === null) {
		return badRequest({ error: "Expected a JSON object" });
	}

	let { title } = body as { title?: unknown };
	if (typeof title !== "string" || title.trim() === "") {
		return unprocessableEntity({ errors: { title: "Title is required" } });
	}

	let article = await insertArticle({ title });
	return created({ article }, { headers: { Location: `/articles/${article.id}` } });
}
```

## Pattern: Narrowing The Body On The Client

Because `ok` is a literal type, a union of the bodies an endpoint returns narrows on one check, and
the client keeps no list of which statuses are failures.

```typescript
type CreateArticle =
	{ article: { id: string; title: string }; ok: true } | { error: string; ok: false };

let response = await fetch("/api/articles", {
	method: "POST",
	headers: { "Content-Type": "application/json" },
	body: JSON.stringify({ title: "Hello" }),
});
let result = (await response.json()) as CreateArticle;

if (result.ok) console.info(result.article.id);
else console.error(result.error);
```

## Pattern: Post-Redirect-Get After A Form

A browser reloading after a `307` resubmits the form, since `307` keeps the method. Answer a
successful submission with `303` so the follow-up is a `GET`, and set any cookie in the same
response.

```typescript
import { Location } from "@sdxc/location";
import { redirect } from "@sdxc/response";

export async function publishArticle(request: Request) {
	let form = await request.formData();
	let slug = String(form.get("slug"));
	await markPublished(slug);

	return redirect(new Location({ pathname: `/articles/${slug}`, search: "published=1" }), {
		status: redirect.Status.SeeOther,
		headers: { "Set-Cookie": "flash=published; Path=/; Max-Age=60" },
	});
}
```

## Pattern: Guarding An Endpoint

Auth, method and rate-limit checks each answer with the status and the header a client needs to
recover.

```typescript
import { methodNotAllowed, ok, tooManyRequests, unauthorized } from "@sdxc/response";

export async function handle(request: Request) {
	if (request.method !== "GET") {
		return methodNotAllowed({ error: "Use GET" }, { headers: { Allow: "GET" } });
	}

	let token = request.headers.get("Authorization");
	if (!token) {
		return unauthorized(
			{ error: "invalid_token" },
			{ headers: { "WWW-Authenticate": 'Bearer realm="api"' } },
		);
	}

	if (await isRateLimited(token)) {
		return tooManyRequests({ error: "Slow down" }, { headers: { "Retry-After": "60" } });
	}

	return ok({ items: await listItems(token) });
}
```

## Pattern: Asserting On Responses In Tests

Helpers return plain responses, so a test reads status and body directly.

```typescript
import { conflict } from "@sdxc/response";
import { expect, test } from "vitest";

test("a duplicate slug answers 409", async () => {
	let response = conflict({ error: "That slug is taken" });

	expect(response.status).toBe(409);
	expect(response.headers.get("Content-Type")).toContain("application/json");
	expect(await response.json()).toEqual({ error: "That slug is taken", ok: false });
});
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
