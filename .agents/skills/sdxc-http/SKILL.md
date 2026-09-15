---
name: sdxc-http
description: "@sdxc/http is response builders, content negotiation and HTTP caching for the Fetch API, in subpath-only exports: status-named JSON/HTML helpers, MIME and status constants, `Accept` parsing with `respond`, and a cache layer of `policy`/`Policies`, `etag`, `conditional`, `precondition` and `vary`. Use when a handler returns `Response`, serving several formats from one URL, setting `Cache-Control`, answering `304` or `If-Match`, or answering `HEAD` like `GET`."
---

# @sdxc/http

Named status codes and content types, response helpers that carry both, `Accept` negotiation, and the `Cache-Control` and `ETag` bookkeeping a conditional response needs. Each concern is its own subpath export, so importing the status codes leaves the caching layer out of the bundle. Everything returns or takes a plain `Response`/`Request`, so it works on any fetch runtime; the `cache` and `middleware` subpaths build on the typed headers and router of `remix`.

Full API, options and examples: [packages/http/README.md](packages/http/README.md)

## When to reach for it

- Writing a handler where each outcome should read as the status it answers with: `badRequest(...)`, `notFound(...)`, `created(...)`.
- Serving JSON, HTML and CSV from one URL according to what the client's `Accept` header prefers.
- Deciding a `Cache-Control` value from intent rather than from memorized directives, and getting `private, no-cache` right for authenticated HTML.
- Answering revalidation with a `304` instead of resending a body, or comparing `If-Match` before a write so a client cannot overwrite a change it never saw.
- Building a download or a Server-Sent Events response without hand-writing `Content-Disposition` or the streaming headers.
- Making `HEAD` report a route's real status and headers, through the same middleware chain as `GET`.

## Using it

Declare the workspace dependency, then import from a subpath:

```json
{ "dependencies": { "@sdxc/http": "workspace:*" } }
```

```ts
import { badRequest, notFound, ok } from "@sdxc/http/response/json";

export async function handler(request: Request): Promise<Response> {
	let id = new URL(request.url).searchParams.get("id");
	if (!id) return badRequest({ error: "Missing id" });

	let user = await findUser(id);
	if (!user) return notFound({ error: "User not found" });

	return ok({ user });
}
```

### Entry points

There is no root export — every import names a subpath.

- `@sdxc/http/content-type` — MIME type constants, each the bare type with no `charset` parameter.
- `@sdxc/http/status-code` — status and status text pairs, shaped as a `ResponseInit`.
- `@sdxc/http/response` — one builder per content kind: `json`, `text`, `html`, `css`, `javascript`, `xml`, `csv`, `markdown`, `pdf`, plus `file`, `stream`, `noContent` and `redirect`.
- `@sdxc/http/response/json` — one function per status, writing a JSON body.
- `@sdxc/http/response/html` — the same names, writing `text/html`.
- `@sdxc/http/negotiate` — `accepts`, `AcceptList` and `respond` for `Accept` parsing and dispatch.
- `@sdxc/http/cache` — `policy`, `Policies`, `etag`, `lastModified`, `ifModifiedSince`, `isModifiedSince`, `conditional`, `precondition` and `vary`.
- `@sdxc/http/middleware/head-requests` — `headRequests()`, router middleware answering `HEAD` from `GET`.

## Suggestions

- Pair a negotiated response with `vary(headers, ["Accept"])`, or a shared cache serves one client's variant to another. Without a `default` handler, `respond` answers `406 Not Acceptable`.
- `visibility` has no default on `policy`: where an edge cache sits in front of the origin, `public` is what allows one client's body to be served to another, so write it out deliberately. `Policies.revalidate()` is the ready-made answer for authenticated HTML, and `Policies.immutable()` is only correct for fingerprinted URLs.
- `conditional` is safe at the end of any handler — only a `GET` or `HEAD` answered with `200` is eligible and everything else passes through untouched. `If-None-Match` decides on its own whenever present; `If-Modified-Since` is consulted in its absence.
- `precondition` returns its failure rather than throwing, which keeps answering with a `412` your decision. An absent `If-Match` passes, `*` passes, and every other value is compared strongly, so a weak tag fails.
- `etag` costs CPU proportional to the payload, which suits HTML and JSON rather than large bodies nobody revalidates. Use `{ weak: true }` for content that varies in insignificant ways between renders.
- Each name in a `Vary` list multiplies the variants a shared cache stores, so the list is a cost rather than documentation. Varying on `Cookie` turns shared caching off for any request carrying one — a response that genuinely differs per user wants `Policies.private()` instead.
- Place `headRequests()` first in the global chain so `HEAD` runs through the same auth and rate limiting as `GET`.
- `Json` is spelled that way rather than `JSON` so it does not shadow the global.

## Related

- `@sdxc/result` — `etag` and `precondition` report their outcome as a `Result`; skill `sdxc-result`
- `@sdxc/duration` — cache ages are written as duration values such as `"1 hour"`; skill `sdxc-duration`
- `@sdxc/validate` — reads a request body by its `Content-Type`, pairing with the status-named JSON helpers for a whole endpoint in one straight line; skill `sdxc-validate`
