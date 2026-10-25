# @sdxc/openapi

Build, serve and check OpenAPI 3.1 documents from typed operations.

An operation binds one route to the schemas of its params, query, body and responses, its
problem types and its security. Handlers parse their input through it, and the
[OpenAPI 3.1](https://spec.openapis.org/oas/v3.1.1.html) document is built from the same
value, so the published contract and the code that enforces it never drift apart.

## Installation

```sh
npm add @sdxc/openapi
```

Schemas come from [`@sdxc/json-schema`](https://www.npmjs.com/package/@sdxc/json-schema),
problem types from an [`@sdxc/problem`](https://www.npmjs.com/package/@sdxc/problem) catalog and
routes from a [`remix`](https://www.npmjs.com/package/remix) route map; results are
[`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result) values. Install all four alongside.

## Usage

### Declare an operation

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
	.object({ id: s.string(), title: s.string(), createdAt: s.integer() })
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
	responses: { 200: { description: "The updated book", body: s.object({ data: BOOK }) } },
	problems: ["validationError", "notFound"],
});
```

The first argument becomes the `operationId`. `params`, when given, names exactly the route
pattern's variables, or the call fails to compile.

### Build and serve the document

```typescript
import * as s from "@sdxc/json-schema";
import { createDocument } from "@sdxc/openapi";
import { openapiHandler } from "@sdxc/openapi/router";
import { defineProblems, ISSUES_SCHEMA } from "@sdxc/problem";
import { createRouter } from "remix/router";

export const PROBLEMS = defineProblems("https://docs.example.com/errors/", {
	validationError: {
		slug: "validation-error",
		status: 422,
		title: "The request failed validation",
		extensions: s.object({ errors: ISSUES_SCHEMA }),
	},
	notFound: { slug: "not-found", status: 404, title: "The resource does not exist" },
});

let router = createRouter();

export function buildApiDocument() {
	return createDocument({
		info: { title: "Books API", version: "1" },
		servers: [{ url: "https://api.example.com" }],
		problems: PROBLEMS,
	}).add(BOOK_SHOW, BOOK_UPDATE);
}

router.get(
	ROUTES.openapi,
	openapiHandler(() => buildApiDocument().build()),
);
```

`/api/v1/openapi.json` answers `application/openapi+json; version=3.1.1`, or
`application/openapi+yaml` for `?format=yaml`, the media types of
[draft-ietf-httpapi-rest-api-mediatypes-09](https://datatracker.ietf.org/doc/draft-ietf-httpapi-rest-api-mediatypes/)
(a draft, so they may change). A client whose `Accept` prefers `application/json` or
`application/yaml` gets that type instead.

### Parse a request through the operation

```typescript
import { issuesFrom } from "@sdxc/problem";
import { isFailure } from "@sdxc/result";

router.patch(ROUTES.books.update, async ({ request, params }) => {
	let input = await BOOK_UPDATE.parse(request, params);
	if (isFailure(input)) {
		return PROBLEMS.validationError({ extensions: { errors: issuesFrom(input.error) } });
	}

	let { params: path, body } = input.data; // { bookId: string }, { title?: string }
	let book = await updateBook(path.bookId, body);
	if (book === null) return PROBLEMS.notFound({ detail: "No book has that id." });
	return Response.json({ data: book });
});
```

Answering with the catalog's builders sends exactly the problem `type` and extensions the
document declares for the operation.

## API

### `@sdxc/openapi`

#### `defineOperation(name, route, spec): Operation`

Binds a spec to one route; `name` becomes the `operationId`. `spec` takes:

- `summary` (required), `description`, `tags`: copied to the operation.
- `deprecated`: `true`, or a `DeprecationNotice` from `@sdxc/http/deprecation`
  (`{ deprecation?, sunset?, deprecationLink?, sunsetLink? }`) that also marks the operation
  deprecated and that `deprecationHeaders` writes onto its responses. A sunset earlier than
  the deprecation fails the build.
- `params`: an object schema whose keys equal the pattern's variables. Without one, each
  variable documents as a string and `parse` yields the router's params.
- `query`: an object schema; each key becomes a query parameter, required unless `optional`.
- `body`: a schema for `application/json`, or a record of media types to schemas.
- `responses`: status to `{ description, body?, headers? }`, where `body` takes the same two
  forms and a header is `{ schema, description?, required? }`.
- `problems`: entry names from the document's catalog.
- `security`: a list of scheme name to scopes; `[]` marks an unauthenticated operation.

#### `operation.parse(request, params): Promise<Result<{ params, query, body }, OperationInputError>>`

Validates params, query and body in that order and stops at the first failure. A repeated
query key arrives as an array. The body is read by its `Content-Type`: JSON media types are
parsed, forms become objects, anything else is text, and a request without a body validates
`undefined`. An operation also exposes `route`, `operationId` and `spec`.

#### `createDocument(options): DocumentBuilder`

Starts a document; nothing is assembled until `build()`. `options` takes:

- `info`, `tags`: copied to the document.
- `servers`: absolute URLs.
- `securitySchemes`: the schemes operations may name.
- `security`: applied to every operation that declares none of its own.
- `problems`: a catalog from `defineProblems`.

#### `DocumentBuilder`

- `add(...operations)`: collects operations; one listing a problem the catalog lacks fails to
  compile.
- `build(): Result<OpenAPI.Document, OpenAPIBuildError>`: assembles the document. Path
  variables become required `{name}` parameters, schemas named with `meta({ id })` land in
  `components.schemas`, and each catalog entry becomes a `<Name>Problem` schema and a
  `components.responses.<Name>`; problems sharing a status merge into one `oneOf` response.
- `scopes(): Record<string, string[]>`: every scope any operation requires, per scheme.
- `operations()` and `problems()`: what the builder holds, for tooling.

#### `parse(text): Result<OpenAPI.Document, OpenAPIParseError>`

Reads JSON (text starting with `{`) or YAML, and checks `openapi: 3.1.x`, `info.title`,
`info.version` and the top-level shape.

#### `stringify(document, options?): Result<string, OpenAPIStringifyError>`

Writes JSON, or YAML with `{ format: "yaml" }`, at `indent` spaces per level (2 by default),
ending with a newline.

#### `OpenAPIBuildError`

What `build()` fails with: a duplicate `operationId`, a route OpenAPI cannot express (an
optional segment, an unnamed wildcard, a hostname variable, a method-agnostic route), params
that disagree with the pattern, an unknown scheme or problem, a status declared both as a
response and a problem, or a schema without a JSON Schema form. `operationId` names the
operation (`null` at document level) and `pointer` is a JSON Pointer into the document.

#### `OperationInputError`

What `parse` fails with: `location` (`"params"`, `"query"` or `"body"`) and the schema's
`issues`, which `issuesFrom` from `@sdxc/problem` accepts directly.

#### `OpenAPIParseError` and `OpenAPIStringifyError`

What `parse` and `stringify` fail with.

#### Constants

`MEDIA_TYPE_JSON` (`application/json`), `MEDIA_TYPE_YAML` (`application/yaml`),
`MEDIA_TYPE_OPENAPI_JSON` (`application/openapi+json`), `MEDIA_TYPE_OPENAPI_YAML`
(`application/openapi+yaml`),
`OPENAPI_VERSION` (`3.1.1`) and `JSON_SCHEMA_DIALECT`
(`https://spec.openapis.org/oas/3.1/dialect/base`), the last two declared by every built
document.

### `@sdxc/openapi/security`

#### `bearer({ description?, bearerFormat? })`, `apiKey({ in, name, description? })`, `oauth2({ description?, flows })`, `openIdConnect({ openIdConnectUrl, description? })`

Return the scheme objects `securitySchemes` lists. `oauth2` takes `clientCredentials` and
`authorizationCode` flows, each with its URLs and `scopes`.

### `@sdxc/openapi/router`

#### `openapiHandler(build, options?): RequestHandler`

Serves the document as JSON or YAML. `build` runs on the first request and its outcome is
reused, so the handler is safe to create at module scope. Responses carry a strong `ETag`,
`Vary: Accept` and `Cache-Control` (`options.cacheControl`, `public, max-age=300` by default),
and a matching `If-None-Match` answers `304`. A build failure answers `500` with a problem
document.

#### `deprecationHeaders(operation): Middleware`

Writes the `Deprecation` and `Sunset` fields and their `deprecation` and `sunset` links from
the operation's `deprecated` notice onto every response its route answers.

```typescript
let LEGACY_SHOW = defineOperation("legacyShow", routes.api.legacy.show, {
	summary: "Show a legacy record",
	responses: { 200: { description: "The record" } },
	deprecated: {
		deprecation: new Date("2027-01-01T00:00:00Z"),
		sunset: new Date("2027-07-01T00:00:00Z"),
	},
});

router.map(routes.api.legacy.show, {
	middleware: [deprecationHeaders(LEGACY_SHOW)],
	handler: showLegacy,
});
```

### `@sdxc/openapi/testing`

#### `checkResponse(document, request, response): Promise<Result<void, ConformanceError>>`

Checks one exchange against the builder's operations: the status, media type, required headers
and body, validated with the declared schema. The response body is read from a clone.

#### `createConformanceRecorder(document)`

Returns `{ middleware, violations(), uncovered() }`. Installed first on a router, `middleware`
checks every exchange; `uncovered()` lists the declared `operationId` and status pairs no
exchange produced.

#### `ConformanceError`

Carries `violations`, every departure found.

### Types

#### `Operation`, `OperationSpec`, `ResponseSpec`

An operation, its spec and one declared response.

#### `PathParams<Route>`

The params type a route's pattern implies.

#### `DocumentOptions`, `StringifyOptions`, `ServeOptions`

The options of `createDocument`, `stringify` and `openapiHandler` (from `./router`).

#### `Violation`

One departure, from `./testing`: `operationId` (`null` when the request matched no operation),
`message`, `pointer` into the body for a body mismatch, and a `kind`: `undocumented-operation`,
`undocumented-status`, `undocumented-media-type`, `undocumented-problem-type`,
`missing-header` or `body-mismatch`.

#### `OpenAPI`

A namespace of the OpenAPI 3.1 object model: `OpenAPI.Document`, `OpenAPI.Operation`,
`OpenAPI.SecurityScheme` and the rest.

## Pattern: Query Strings, Forms And Response Headers

```typescript
import * as s from "@sdxc/json-schema";
import * as coerce from "@sdxc/json-schema/coerce";
import { defineOperation } from "@sdxc/openapi";
import { get, post } from "remix/routes";

let NOTE = s.object({ id: s.string(), text: s.string() }).meta({ id: "Note" });

let listNotes = defineOperation("noteList", get("/notes"), {
	summary: "List notes",
	query: s.object({ cursor: s.optional(s.string()), limit: s.optional(coerce.number()) }),
	responses: {
		200: {
			description: "One page of notes",
			body: s.object({ data: s.array(NOTE) }),
			headers: { Link: { schema: s.string(), description: "The next page", required: false } },
		},
	},
});

let createNote = defineOperation("noteCreate", post("/notes"), {
	summary: "Create a note",
	body: {
		"application/json": s.object({ text: s.string() }),
		"application/x-www-form-urlencoded": s.object({ text: s.string() }),
	},
	responses: {
		201: {
			description: "The created note",
			body: NOTE,
			headers: { Location: { schema: s.string(), required: true } },
		},
	},
});
```

`listNotes.parse` yields `query.limit` as a number. `createNote.parse` reads a JSON or a form
body by its `Content-Type` and validates it with that media type's schema; any other media type
fails with an `OperationInputError` at `"body"`.

## Pattern: Secured Operations And Their Scopes

Declare the schemes once, apply a default to every operation, and let `scopes()` feed OAuth
protected-resource metadata the same list the operations require.

```typescript
import * as s from "@sdxc/json-schema";
import { createDocument, defineOperation } from "@sdxc/openapi";
import { bearer, oauth2 } from "@sdxc/openapi/security";
import { get, post } from "remix/routes";

let health = defineOperation("health", get("/health"), {
	summary: "Check the service",
	responses: { 204: { description: "The service is up" } },
	security: [],
});

let createReport = defineOperation("reportCreate", post("/reports"), {
	summary: "Create a report",
	body: s.object({ title: s.string() }),
	responses: { 201: { description: "The created report" } },
	security: [{ oauth: ["reports:write"] }],
});

let listReports = defineOperation("reportList", get("/reports"), {
	summary: "List reports",
	responses: { 200: { description: "The reports" } },
});

let document = createDocument({
	info: { title: "Reports API", version: "1" },
	servers: [{ url: "https://api.example.com" }],
	securitySchemes: {
		apiKey: bearer({ description: "An API key, sent as a bearer token" }),
		oauth: oauth2({
			description: "Metadata at https://api.example.com/.well-known/oauth-protected-resource",
			flows: {
				clientCredentials: {
					tokenUrl: "https://auth.example.com/oauth/token",
					scopes: { "reports:read": "Read reports", "reports:write": "Create reports" },
				},
			},
		}),
	},
	security: [{ apiKey: [] }, { oauth: ["reports:read"] }],
}).add(health, createReport, listReports);

export function protectedResourceMetadata() {
	let { oauth } = document.scopes();
	return Response.json({
		resource: "https://api.example.com",
		authorization_servers: ["https://auth.example.com"],
		scopes_supported: oauth ?? [],
	});
}
```

`health` is unauthenticated, `createReport` requires its own scope, and `listReports` takes
either scheme from the document default. OpenAPI 3.1 has no field for an authorization server's
metadata, so the `oauth2` description links it.

## Pattern: A Drift Test

Commit the serialized document, so every contract change shows up as a reviewable diff.

```typescript
import { stringify } from "@sdxc/openapi";
import { unwrap } from "@sdxc/result";
import { expect, test } from "vitest";

import { buildApiDocument } from "./api-document.js";

test("the document matches the committed snapshot", async () => {
	let document = unwrap(buildApiDocument().build());
	await expect(unwrap(stringify(document, { format: "yaml" }))).toMatchFileSnapshot(
		"./openapi.snapshot.yaml",
	);
});
```

`build()` failing here also catches a duplicate `operationId`, a params schema out of step with
its route, or a problem missing from the catalog before deploy.

## Pattern: Conformance Across A Test Suite

Record every exchange a test router serves, then assert the suite stayed inside the document
and reached every declared status.

```typescript
import { createConformanceRecorder } from "@sdxc/openapi/testing";
import { createRouter } from "remix/router";
import { afterAll, expect, test } from "vitest";

import { buildApiDocument, mapApiRoutes } from "./api.js";

let recorder = createConformanceRecorder(buildApiDocument());
let router = createRouter({ middleware: [recorder.middleware] });
mapApiRoutes(router);

test("an unknown book is a 404", async () => {
	let response = await router.fetch("https://api.example.com/api/v1/books/missing");
	expect(response.status).toBe(404);
});

afterAll(() => {
	expect(recorder.violations()).toEqual([]);
	expect(recorder.uncovered()).toEqual([]);
});
```

For a single exchange, `checkResponse` answers the same verdict:

```typescript
import { checkResponse } from "@sdxc/openapi/testing";
import { isFailure } from "@sdxc/result";
import { expect } from "vitest";

let request = new Request("https://api.example.com/api/v1/books/missing");
let result = await checkResponse(buildApiDocument(), request, await router.fetch(request));
expect(isFailure(result) ? result.error.violations : []).toEqual([]);
```

## Pattern: Read A Published Document

```typescript
import { parse } from "@sdxc/openapi";
import { isFailure } from "@sdxc/result";

let response = await fetch("https://api.example.com/api/v1/openapi.json?format=yaml");
let document = parse(await response.text());
if (isFailure(document)) throw document.error;

let paths = Object.keys(document.data.paths ?? {}); // ["/api/v1/books/{bookId}", ...]
let update = document.data.paths?.["/api/v1/books/{bookId}"]?.patch?.operationId; // "bookUpdate"
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
