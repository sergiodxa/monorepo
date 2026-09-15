---
name: sdxc-response
description: "@sdxc/response builds `Response` objects through status-named helpers — `ok`, `created`, `accepted`, `noContent`, `badRequest`, `unauthorized`, `notFound`, `conflict`, `unprocessableEntity`, `tooManyRequests`, `internalServerError` and the rest — each merging an `ok: true` / `ok: false` discriminant into the JSON body, plus `redirect()` with `redirect.Status`. Use when a handler answers JSON, or for post-redirect-get with 303/307/308."
---

# @sdxc/response

Each helper is a named wrapper over `Response.json()` with the status baked in, so a handler says
what it means — `notFound({ error })` rather than `Response.json(body, { status: 404 })` at every
call site. Success helpers merge `ok: true` into the body and error helpers merge `ok: false`,
giving a client one field to branch on regardless of which status the endpoint chose. `redirect`
takes a `URL`, a path string, or a `Location`, and `redirect.Status` names the three redirect
statuses worth using. The return value is a plain `Response`, so it works on any fetch runtime and
a test reads it like any other HTTP response.

Full API, options and examples: [packages/response/README.md](packages/response/README.md)

## When to reach for it

- A JSON handler is littered with `Response.json(body, { status: N })` and the status no longer reads as intent
- A client should discriminate success from failure on one body field instead of keeping a list of which statuses are failures
- A form submission needs post-redirect-get and the default `307` would replay the `POST`
- A `204` is the right answer and the body must actually be `null`

## Using it

Declare the workspace dependency, then import:

```json
{ "dependencies": { "@sdxc/response": "workspace:*" } }
```

```ts
import { notFound, ok } from "@sdxc/response";

let article = await findArticle(slug);
if (!article) return notFound({ error: "Article not found" });

return ok({ article });
```

## Suggestions

- `init` is `Omit<ResponseInit, "status" | "statusText">`: the helper owns the status, and a different status means a different helper. Use `init` for the headers that pair with a status — `Location` on `created`, `WWW-Authenticate` on `unauthorized`, `Allow` on `methodNotAllowed`, `Retry-After` on `tooManyRequests` and `serviceUnavailable`.
- Redirect after a successful `POST` with `{ status: redirect.Status.SeeOther }`. The default `307` preserves the method, so a reload resubmits the form.
- `noContent` is the one helper that skips `Response.json()` — a `204` forbids a body, so there is no `ok` field to merge and the status alone carries the outcome.
- Reach for `unprocessableEntity` (`422`) over `badRequest` (`400`) for field-level errors: `400` says the request was unreadable, `422` says it was read and rejected.
- `redirect` throws `Invalid redirect target` on anything `Location.canParse` rejects, so a target assembled from user input is worth checking before it reaches the call.

## Related

- `@sdxc/location` — supplies the `Location` value `redirect` accepts for origin-less paths; skill `sdxc-location`
