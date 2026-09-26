# @sdxc/openapi

Build, serve and check OpenAPI 3.1 documents from typed operations.

## Installation

```bash
npm add @sdxc/openapi
```

Schemas come from [`@sdxc/json-schema`](https://www.npmjs.com/package/@sdxc/json-schema), problem
types from an [`@sdxc/problem`](https://www.npmjs.com/package/@sdxc/problem) catalog, and routes
from a [`remix`](https://www.npmjs.com/package/remix) route map; results are
[`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result) values. All four install alongside
this package.

An operation binds one route to the schemas of its params, query and body, its responses, its
problem types and its security. The handler parses its input through the operation, and the
[OpenAPI 3.1](https://spec.openapis.org/oas/v3.1.1.html) document describes the same
declaration, so the published contract and the code that enforces it are one value. The
package also reads and writes documents as JSON or YAML, serves one from a router, and checks
responses in tests against it.

## Usage

### Declare An Operation

```typescript
import * as s from "@sdxc/json-schema";
import * as checks from "@sdxc/json-schema/checks";
import { defineOperation } from "@sdxc/openapi";
import { get, patch, route } from "remix/routes";

export const ROUTES = route("/api/v1", {
	openapi: get("/openapi.json"),
	books: { show: get("/books/:bookId"), update: patch("/books/:bookId") },
});

export const BOOK = s
	.object({
		id: s.string().pipe(checks.pattern(/^book_[0-9a-z]{26}$/)),
		title: s.string(),
		createdAt: s.integer().meta({ description: "Epoch milliseconds" }),
	})
	.meta({ id: "Book" });

export const BOOK_SHOW = defineOperation("bookShow", ROUTES.books.show, {
	summary: "Show a book",
	responses: { 200: { description: "The book", body: s.object({ data: BOOK }) } },
	problems: ["notFound"],
});

export const BOOK_UPDATE = defineOperation("bookUpdate", ROUTES.books.update, {
	summary: "Update a book",
	tags: ["Books"],
	params: s.object({ bookId: s.string() }),
	body: s.object({ title: s.optional(s.string().pipe(checks.minLength(1))) }),
	responses: {
		200: { description: "The updated book", body: s.object({ data: BOOK }) },
	},
	problems: ["validationError", "notFound"],
	security: [{ apiKey: ["books:write"] }],
});
```

`params` must name exactly the route pattern's variables: a missing or extra key fails to
compile, and fails the build if it slips past the compiler.

### Parse A Request Through It

```typescript
import { issuesFrom, validationProblem } from "@sdxc/problem";
import { isFailure } from "@sdxc/result";

router.patch(ROUTES.books.update, async ({ request, params }) => {
	let input = await BOOK_UPDATE.parse(request, params);
	if (isFailure(input)) return validationProblem(issuesFrom(input.error));

	input.data.params.bookId; // string
	input.data.body.title; // string | undefined
	// ...
});
```

### Build And Serve The Document

```typescript
import * as s from "@sdxc/json-schema";
import { createDocument } from "@sdxc/openapi";
import { openapiHandler } from "@sdxc/openapi/router";
import { bearer } from "@sdxc/openapi/security";
import { defineProblems, ISSUES_SCHEMA } from "@sdxc/problem";

const PROBLEMS = defineProblems("https://docs.example.com/errors/", {
	validationError: {
		slug: "validation-error",
		status: 422,
		title: "The request failed validation",
		extensions: s.object({ errors: ISSUES_SCHEMA }),
	},
	notFound: { slug: "not-found", status: 404, title: "The resource does not exist" },
});

export function buildApiDocument() {
	return createDocument({
		info: { title: "Books API", version: "1" },
		servers: [{ url: "https://api.example.com" }],
		securitySchemes: { apiKey: bearer({ description: "An API key, sent as a bearer token" }) },
		problems: PROBLEMS,
	}).add(BOOK_SHOW, BOOK_UPDATE);
}

router.get(
	ROUTES.openapi,
	openapiHandler(() => buildApiDocument().build()),
);
```

## API

### `@sdxc/openapi`

#### `defineOperation(name, route, spec)`

Binds a spec to one route, keyed by the name it has in its route map, which becomes the
`operationId`. `spec` (an `OperationSpec`) takes:

- `summary`, `description`, `tags`, `deprecated`: copied to the operation.
- `params`: an object schema whose keys equal the pattern's variables. Without one, each
  variable documents as a string and `parse` yields the router's params.
- `query`: an object schema; each key becomes a query parameter, required unless `optional`.
- `body`: a schema (`application/json`) or a record of media types to schemas.
- `responses`: status to a `ResponseSpec`, `{ description, body?, headers? }`; a header is
  `{ schema, description?, required? }`.
- `problems`: entry names from the document's catalog; `add` refuses unknown names at compile
  time.
- `security`: scheme name to scopes; `[]` marks an unauthenticated operation.

The returned `Operation` carries `route`, `operationId` and `spec`, and
`operation.parse(request, params)`, which parses params, query and body in that order and
resolves to a `Result`. A repeated query key arrives as an array. The body is read by its
`Content-Type`: JSON media types are parsed, forms become objects, anything else is text. A
request without a body validates `undefined`, so an `optional` body accepts it.
`PathParams<Route>` is the params type a route's pattern implies.

#### `OperationInputError`

What `parse` fails with: `location` (`"params"`, `"query"` or `"body"`) and the schema's
`issues`, ready for `issuesFrom` from `@sdxc/problem`.

#### `createDocument(options)`

Starts a `DocumentBuilder`; nothing is assembled until `build()`. `DocumentOptions` takes:

- `info`, `servers` (absolute URLs), `tags`: copied to the document.
- `securitySchemes`: the schemes operations may name.
- `security`: applied to every operation that declares none of its own.
- `problems`: an `@sdxc/problem` catalog from `defineProblems`.

`builder.add(...operations)` collects operations. `builder.build()` returns
`Result<OpenAPI.Document, OpenAPIBuildError>`. `builder.scopes()` lists every scope any
operation requires, per scheme. `builder.operations()` and `builder.problems()` expose what the
builder holds, for tooling.

How the parts land in the document:

- `:name` and `*name` become `{name}`, each a required path parameter.
- Schemas describe their input side. Schemas named with `meta({ id })` hoist into
  `components.schemas`, and every `$ref` points there.
- The catalog becomes a `Problem` schema for the RFC 9457 members, a `<Name>Problem` schema per
  entry pinning its `type`, `title` and `status` with its extension schema, and a
  `components.responses.<Name>` per entry.
- An operation's problem is a `$ref` to its response; problems sharing a status merge into one
  response with `oneOf`.

#### `OpenAPIBuildError`

`build()` fails on a duplicate `operationId`, a route OpenAPI cannot express (an optional
segment, an unnamed wildcard, a hostname variable or a method-agnostic route), params that
disagree with the pattern, an unknown scheme, a status declared both as a response and a
problem, or a schema without a JSON Schema form. `operationId` names the operation (`null` for
a document-level failure) and `pointer` is a JSON Pointer into the document.

#### `parse(text)` and `stringify(document, options?)`

`parse` reads JSON (text starting with `{`) or YAML, and checks `openapi: 3.1.x`, `info.title`,
`info.version` and the shape of `paths`, `components`, `servers`, `security` and `tags`; it
fails with an `OpenAPIParseError`. `stringify` writes JSON by default or YAML with
`{ format: "yaml" }`, `indent` spaces per level (2 by default), ending with a newline; it fails
with an `OpenAPIStringifyError`. `StringifyOptions` types its options.

#### Constants

`MEDIA_TYPE_JSON` (`application/json`), `MEDIA_TYPE_YAML` (`application/yaml`, RFC 9512),
`OPENAPI_VERSION` (`3.1.1`) and `JSON_SCHEMA_DIALECT`
(`https://spec.openapis.org/oas/3.1/dialect/base`), which a built document declares.

#### `OpenAPI` (types)

A namespace of the OpenAPI 3.1 object model: `OpenAPI.Document`, `OpenAPI.Operation`,
`OpenAPI.Info`, `OpenAPI.Server`, `OpenAPI.Tag`, `OpenAPI.SecurityScheme` and the rest.

### `@sdxc/openapi/security`

`bearer({ description?, bearerFormat? })`, `apiKey({ in, name, description? })`,
`oauth2({ description?, flows })` and `openIdConnect({ openIdConnectUrl, description? })`
return the scheme objects `securitySchemes` lists. `oauth2` takes `clientCredentials` and
`authorizationCode` flows. OpenAPI 3.1 has no field for an OAuth 2.0 authorization server's
metadata, so link `/.well-known/oauth-protected-resource` from the `oauth2` description.

### `@sdxc/openapi/router`

#### `openapiHandler(build, options?)`

A request handler that serves the document: JSON by default, YAML for `?format=yaml` or an
`Accept` preferring `application/yaml`. `build` runs on the first request and its outcome is
reused, which keeps document assembly out of a Worker's global scope. Each representation
carries a strong `ETag` (the SHA-256 of its bytes), `Vary: Accept` and `Cache-Control`, and a
matching `If-None-Match` answers `304`. A build failure answers `500` with a problem document.
`ServeOptions` types the options: `cacheControl` defaults to `public, max-age=300`.

### `@sdxc/openapi/testing`

#### `checkResponse(document, request, response)`

Checks one exchange against the builder's operations and resolves to
`Result<void, ConformanceError>`. The body is read from a clone and validated with the declared
schema's own `~standard.validate`.

#### `ConformanceError` and `Violation`

`violations` lists every departure found, each a `Violation` with `operationId` (`null` when
the request matched no operation), `kind`, `message`, and `pointer` into the body for a body
mismatch. The kinds:

- `undocumented-operation`: the method and path match no operation
- `undocumented-status`: neither a response nor a listed problem has this status
- `undocumented-media-type`: the `Content-Type` is not one the response declares
- `undocumented-problem-type`: a problem whose `type` is not an entry listed for this status
- `missing-header`: a header declared `required` is absent
- `body-mismatch`: the body fails its schema

#### `createConformanceRecorder(document)`

Returns `{ middleware, violations(), uncovered() }`. Install `middleware` first on a test router
to record every exchange; `uncovered()` lists the declared `operationId` and status pairs no
recorded exchange produced.

## Pattern: A Drift Test

Commit the serialized document, so every contract change is a reviewable diff:

```typescript
import { stringify } from "@sdxc/openapi";
import { unwrap } from "@sdxc/result";
import { expect, test } from "vitest";

test("the document builds and matches the committed snapshot", async () => {
	let document = unwrap(buildApiDocument().build());
	await expect(unwrap(stringify(document))).toMatchFileSnapshot("./openapi.snapshot.json");
});
```

## Pattern: Conformance Across A Test Suite

```typescript
import { createConformanceRecorder } from "@sdxc/openapi/testing";
import { createRouter } from "remix/router";
import { afterAll, expect } from "vitest";

let recorder = createConformanceRecorder(buildApiDocument());
let router = createRouter({ middleware: [recorder.middleware] });
// ...map the handlers and run the requests...

afterAll(() => {
	expect(recorder.violations()).toEqual([]);
	expect(recorder.uncovered()).toEqual([]);
});
```

## Pattern: Protected Resource Scopes

`scopes()` gives OAuth protected-resource metadata the same scope list operations require:

```typescript
let { oauth } = buildApiDocument().scopes();
return Response.json({ resource: origin, scopes_supported: oauth ?? [] });
```

Keep operations in a module of their own, beside the route map: it holds only schemas, so the
document imports every operation without importing every handler.

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
		"@sdxc/openapi": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
