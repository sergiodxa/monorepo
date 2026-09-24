# @sdxc/openapi

Build, serve and check OpenAPI 3.1 documents from typed operations.

## Overview

An operation binds a route from a `remix/fetch-router` route map to the schemas of its params,
query and body, its responses, its problem types and its security. The handler parses its input
through the operation, and the document describes the same declaration, so the published
contract and the code that enforces it are one value.

Schemas come from [`@sdxc/json-schema`](/packages/json-schema): they validate like
`remix/data-schema` and describe themselves as JSON Schema 2020-12, the schema dialect of
[OpenAPI 3.1](https://spec.openapis.org/oas/v3.1.1.html). Problem types come from an
[`@sdxc/problem`](/packages/problem) catalog, whose entries become reusable responses.

The package also reads and writes documents as JSON or YAML, serves one from a fetch-router
action, and checks responses in tests against it: a response the document does not describe is
a violation, and a declared status no test produced is reported as uncovered.

## Usage

### Declare An Operation

```typescript
import * as s from "@sdxc/json-schema";
import * as checks from "@sdxc/json-schema/checks";
import { defineOperation } from "@sdxc/openapi";

import routes from "~/routes/web";

export const MonitorSchema = s
	.object({
		id: s.string().pipe(checks.pattern(/^mon_[0-9a-z]{26}$/)),
		name: s.string(),
		createdAt: s.integer().meta({ description: "Epoch milliseconds" }),
	})
	.meta({ id: "Monitor" });

export const monitorUpdate = defineOperation("monitorUpdate", routes.api.monitors.update, {
	summary: "Update a monitor",
	tags: ["Monitors"],
	params: s.object({ monitorId: s.string() }),
	body: s.object({ name: s.optional(s.string().pipe(checks.minLength(1))) }),
	responses: {
		200: { description: "The updated monitor", body: s.object({ data: MonitorSchema }) },
	},
	problems: ["validationError", "notFound"],
	security: [{ apiKey: ["monitors:write"] }],
});
```

`params` must name exactly the route pattern's variables: a missing or extra key fails to
compile, and fails the build if it slips past the compiler.

### Parse A Request Through It

```typescript
import { isFailure } from "@sdxc/result";
import { issuesFrom, validationProblem } from "@sdxc/problem";

let input = await monitorUpdate.parse(ctx.request, ctx.params);
if (isFailure(input)) return validationProblem(issuesFrom(input.error));

input.data.params.monitorId; // string
input.data.body.name; // string | undefined
```

### Build And Serve The Document

```typescript
import { createDocument } from "@sdxc/openapi";
import { openapiHandler } from "@sdxc/openapi/router";
import { bearer } from "@sdxc/openapi/security";

export function buildApiDocument() {
	return createDocument({
		info: { title: "Monitors API", version: "1" },
		servers: [{ url: "https://api.example.com" }],
		securitySchemes: { apiKey: bearer({ description: "An API key, sent as a bearer token" }) },
		problems,
	}).add(monitorShow, monitorUpdate);
}

router.map(
	routes.openapi,
	openapiHandler(() => buildApiDocument().build()),
);
```

## API

### `defineOperation(name, route, spec): Operation`

Binds a spec to one route, keyed by the name it has in its route map, which becomes the
`operationId`.

- `summary`, `description`, `tags`, `deprecated`: copied to the operation.
- `params`: an object schema whose keys equal the pattern's variables. Without one, each
  variable documents as a string and `parse` yields the router's params.
- `query`: an object schema; each key becomes a query parameter, required unless `optional`.
- `body`: a schema (`application/json`) or a record of media types to schemas.
- `responses`: status to `{ description, body?, headers? }`; a header is
  `{ schema, description?, required? }`.
- `problems`: entry names from the document's catalog; `add` refuses unknown names at compile time.
- `security`: scheme name to scopes; `[]` marks an unauthenticated operation.

`operation.parse(request, params)` parses params, query and body in that order and returns a
`Result`. A repeated query key arrives as an array. The body is read by its `Content-Type`:
JSON media types are parsed, forms become objects, anything else is text. A request without a
body validates `undefined`, so an `optional` body accepts it. A failure is an
`OperationInputError` with `location` (`"params"`, `"query"` or `"body"`) and the schema's
`issues`.

### `createDocument(options): DocumentBuilder`

- `info`, `servers` (absolute URLs), `tags`: copied to the document.
- `securitySchemes`: the schemes operations may name.
- `security`: applied to every operation that declares none of its own.
- `problems`: an `@sdxc/problem` catalog.

`builder.add(...operations)` collects operations. `builder.build()` returns
`Result<OpenAPI.Document, OpenAPIBuildError>` and fails on a duplicate `operationId`, a route
OpenAPI cannot express (an optional segment, an unnamed wildcard, a hostname variable or a
method-agnostic route), params that disagree with the pattern, an unknown scheme, a status
declared both as a response and a problem, or a schema without a JSON Schema form. The error
names the `operationId` and a JSON Pointer into the document. `builder.scopes()` lists every
scope any operation requires, per scheme. `builder.operations()` and `builder.problems()`
expose what the builder holds, for tooling.

How the parts land in the document:

- `:name` and `*name` become `{name}`, each a required path parameter.
- Schemas describe their input side. Schemas named with `meta({ id })` hoist into
  `components.schemas`, and every `$ref` points there.
- The catalog becomes a `Problem` schema for the RFC 9457 members, a `<Name>Problem` schema per
  entry pinning its `type`, `title` and `status` with its extension schema, and a
  `components.responses.<Name>` per entry.
- An operation's problem is a `$ref` to its response; problems sharing a status merge into one
  response with `oneOf`.

### `parse(text)` / `stringify(document, options?)`

`parse` reads JSON (text starting with `{`) or YAML, and checks `openapi: 3.1.x`, `info.title`,
`info.version` and the shape of `paths`, `components`, `servers`, `security` and `tags`.
`stringify` writes JSON by default or YAML with `{ format: "yaml" }`, `indent` spaces per level
(2 by default), ending with a newline. Both return a `Result`.

### Constants

`MEDIA_TYPE_JSON` (`application/json`), `MEDIA_TYPE_YAML` (`application/yaml`, RFC 9512),
`OPENAPI_VERSION` (`3.1.1`) and `JSON_SCHEMA_DIALECT`.

### `@sdxc/openapi/security`

`bearer({ description?, bearerFormat? })`, `apiKey({ in, name, description? })`,
`oauth2({ description?, flows })` and `openIdConnect({ openIdConnectUrl, description? })`
return the scheme objects `securitySchemes` lists. OpenAPI 3.1 has no field for an OAuth 2.0
authorization server's metadata, so link `/.well-known/oauth-protected-resource` from the
`oauth2` description.

### `@sdxc/openapi/router`

`openapiHandler(build, { cacheControl? })` returns a request handler that serves the document:
JSON by default, YAML for `?format=yaml` or an `Accept` preferring `application/yaml`. `build`
runs on the first request and its outcome is reused, which keeps document assembly out of a
Worker's global scope. Each representation carries a strong `ETag` (the SHA-256 of its bytes),
`Vary: Accept` and `Cache-Control` (`public, max-age=300` by default), and a matching
`If-None-Match` answers `304`. A build failure answers `500` with a problem document.

### `@sdxc/openapi/testing`

`checkResponse(document, request, response)` checks one exchange and returns
`Result<void, ConformanceError>`, whose `violations` list every departure. The body is read
from a clone and validated with the declared schema's own `~standard.validate`. Violation kinds:

- `undocumented-operation`: the method and path match no operation
- `undocumented-status`: neither a response nor a listed problem has this status
- `undocumented-media-type`: the `Content-Type` is not one the response declares
- `undocumented-problem-type`: a problem whose `type` is not an entry listed for this status
- `missing-header`: a header declared `required` is absent
- `body-mismatch`: the body fails its schema, with `pointer` into the body

`createConformanceRecorder(document)` returns `{ middleware, violations(), uncovered() }`.
Install `middleware` on a test router to record every exchange; `uncovered()` lists the
declared `operationId` and status pairs no recorded exchange produced.

### Types

`OpenAPI` is a namespace of the OpenAPI 3.1 object model (`OpenAPI.Document`,
`OpenAPI.Operation`, `OpenAPI.SecurityScheme`, …). Also exported: `Operation`, `OperationSpec`,
`ResponseSpec`, `PathParams`, `DocumentBuilder`, `DocumentOptions` and `StringifyOptions`.

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

let recorder = createConformanceRecorder(buildApiDocument());
let router = createRouter({ middleware: [recorder.middleware] });
// ...map the controllers and run the requests...

expect(recorder.violations()).toEqual([]);
```

## Pattern: Protected Resource Scopes

`scopes()` gives OAuth protected-resource metadata the same scope list operations require:

```typescript
let { oauth } = buildApiDocument().scopes();
return Response.json({ resource: origin, scopes_supported: oauth ?? [] });
```

## Related Packages

- [`@sdxc/json-schema`](/packages/json-schema) - The schemas operations declare
- [`@sdxc/problem`](/packages/problem) - The catalog whose entries become responses
- [`@sdxc/yaml`](/packages/yaml) - The YAML reader and writer behind `parse` and `stringify`

## Tips

1. **Keep operations beside the route map** - a module of operations holds only schemas, so the document can import every one without importing every controller.
2. **Build lazily** - pass `() => buildApiDocument().build()` to `openapiHandler`; never build at module scope in a Worker.
3. **Name shared shapes** - `meta({ id })` keeps one `components.schemas` entry per resource.
4. **Describe extension schemas with `@sdxc/json-schema`** - a catalog entry whose extensions cannot describe themselves fails the build.
