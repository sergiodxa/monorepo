# ADR-080: OpenAPI Package

## Status

**Accepted** - 2026-09-24

## Background

Commit `2796c090` ("docs(uptime): make the API reference match what the API returns") rewrote
17 pages of the uptime API reference, 2,611 lines added and 1,681 removed, because the hand-written
reference and the handlers had drifted. The pages described `X-RateLimit-*` headers nothing sends
and per-plan limits nothing enforces. They showed bare resources where the API wraps every body in
`data.<resource>` plus `meta`, ISO timestamps where it returns epoch milliseconds, and `204` where
`DELETE` answers `200` with a body. Their error tables listed rows no handler produces and left out
the `400 validation-error` a malformed path id gets. Nothing tied the documentation to the code.
The fix was a person rereading every handler, and the next change to a handler starts the drift
again.

[OpenAPI 3.1](https://spec.openapis.org/oas/v3.1.1.html) is the standard machine-readable
description of an HTTP API, and its schema dialect is JSON Schema 2020-12. The apps already hold
most of what an OpenAPI document says: route patterns in `remix/fetch-router` route maps, request
schemas in `remix/data-schema`, bearer-key scopes in middleware, and problem types in an
`@sdxc/problem` catalog (ADR-077). They hold it as code that runs, and nothing reads it back out
to describe the API.

## Context

### What drifted, and where the truth lives

| Drifted in the reference                             | Where the truth is today                                           | Can a document derive it?        |
| ---------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------- |
| Paths and methods                                    | `apps/uptime/routes/web.ts`, `api.v1` (about 60 leaves)            | Yes, `Route.method`/`.pattern`   |
| Path parameter names and formats                     | `typedId(prefix)` schemas in each controller                       | Names yes; format needs metadata |
| Request body fields, limits, optionality             | `remix/data-schema` schemas in `app/http/controllers/api/*.ts`     | Only with JSON Schema output     |
| Response envelope and fields                         | `apiSuccess()` / `apiPage()` plus a `serialize*` function per type | Only once a schema declares it   |
| Status codes (`201` on create, `200` on delete)      | Handler bodies                                                     | Declared per operation, tested   |
| Problem types per endpoint                           | `apiProblems.*` calls in handler bodies                            | Declared per operation, tested   |
| Scopes per endpoint                                  | `requireApiKey(scope)` in each action's middleware                 | Declared per operation           |
| Rate-limit headers (`RateLimit`, `RateLimit-Policy`) | `@sdxc/rate-limit` middleware on two leaves                        | Declared per operation, tested   |

The uptime reference is 11,171 lines of Markdown in `apps/uptime/resources/docs/api/`, and it
carries 94 hand-written JSON Schema blocks ("Request Body Schema", "Response Schema") beside
field tables and error tables that restate the same facts in prose. Every one of those blocks is
a copy of a `remix/data-schema` schema or a `serialize*` function, kept in step by hand.

The auth-saas management API (`apps/auth-saas/routes/management.ts`, about 70 leaves) has no
reference at all. Its problem types are declared once, in the `managementProblems` catalog in
`@sdxc/auth`, and its callers authenticate with an OAuth 2.0 client-credentials token from
`POST /oauth/token` on the same origin. `docs/adr/auth-saas/features.md` lists a published
OpenAPI document as a feature every compared provider ships.

### Can a `remix/data-schema` schema be read back as JSON Schema?

It cannot, as of `@remix-run/data-schema@0.3.0` (what `remix@3.0.0-rc.2` resolves to):

- Every combinator returns `createSchema(validator)`: an object holding `~standard.validate`,
  `~run`, `pipe`, `refine` and `transform`, all closures. `s.object(shape)` keeps `shape` in the
  closure and exposes nothing about it, and the same holds for `s.optional`, `s.nullable`,
  `s.enum_` and the rest.
- A check (`checks.minLength(1)`) carries `code` and `values` for error messages, but `pipe`
  folds checks into a new closure, so they are unreachable afterwards.
- `~standard.vendor` is `"data-schema"` and there is no `~standard.jsonSchema`.
  `@standard-schema/spec@1.1.0`, already installed, defines `StandardJSONSchemaV1`: a
  `~standard.jsonSchema.input(options)` / `.output(options)` converter a schema library
  implements so tools can ask any schema for JSON Schema. data-schema does not implement it.
- `refine(predicate)` and `transform(fn)` are arbitrary functions. No library can turn them into
  JSON Schema, including Zod, Valibot and ArkType. `typedId(prefix)` is built from exactly these
  two.

So JSON Schema has to be produced beside the validator, not recovered from it.

### Prior art in the repo

`packages/mcp/src/schema.ts` goes the other way: a tool declares a JSON Schema literal, a
type-level mapper derives the handler's argument type from it, and `validate.ts` (193 lines)
checks arguments against it at runtime. That works for MCP because the subset is intentionally
small (objects of scalars, enums, arrays) and the wire format is JSON Schema. It would not carry
the uptime API. Every schema there is already written in `remix/data-schema`, and uses `refine`,
`transform`, variants and defaults that a hand-rolled 2020-12 validator would have to
re-implement.

### What OpenAPI 3.1 asks of an implementation

| Rule                                                                    | Consequence for the package                                                        |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Schema Objects are JSON Schema 2020-12 (`jsonSchemaDialect`)            | Schemas convert to 2020-12; `nullable` is `type: [T, "null"]`, never 3.0's keyword |
| Path templates use `{name}`, and every template variable is a parameter | `:name` becomes `{name}`; params schema keys must equal the pattern's variables    |
| Path parameters are always `required: true`                             | An optional pattern segment is refused at build time                               |
| `operationId` is unique across the document                             | Taken from the route map key (`monitorShow`), which is already unique per map      |
| Response keys are status codes or ranges; one entry per code            | Several problem types on one status merge into one response with `oneOf`           |
| `components` holds reusable schemas, responses and security schemes     | Named schemas hoist to `components.schemas` and are referenced with `$ref`         |
| `security` requirements list scopes; non-OAuth schemes may list roles   | Bearer API keys carry their scope names, as uptime's keys have scopes              |
| `servers[].url` may be relative                                         | The document takes the origin from configuration, never from the request           |

## Decision

Add two packages. `@sdxc/json-schema` gives `remix/data-schema` schemas a JSON Schema 2020-12
form. `@sdxc/openapi` builds an OpenAPI 3.1 document from route maps, those schemas, security
schemes and a problem catalog, serves it, and checks responses in tests against it.

### Package name

| Name                                      | Trade-off                                                                                                       |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **`@sdxc/openapi` + `@sdxc/json-schema`** | Two packages to publish; each is named for the standard it implements, and JSON Schema serves more than OpenAPI |
| `@sdxc/openapi` alone                     | One package; JSON Schema conversion hidden inside it, where MCP tools and problem extensions cannot reach it    |
| `@sdxc/api-spec`                          | Neutral name; says nothing about which standard, and invites a second, non-OpenAPI format under the same roof   |
| `@sdxc/openapi-document`                  | Precise about the document; the package also parses operations and checks conformance, so it undersells         |

The split wins because JSON Schema is a format capability with its own consumers, and the repo
gives each format capability its own package. `@sdxc/problem`'s `ISSUES_SCHEMA` needs a JSON
Schema form so a catalog's extensions can be documented. The uptime docs render request and
response schemas from it. `@sdxc/mcp` could later accept a data-schema schema for a tool whose
arguments outgrow its subset. `@sdxc/openapi` is the name a reader searches for, and matches
`@sdxc/problem`, `@sdxc/saml` and `@sdxc/opml`, which are also named for the standard.

### Scope

`@sdxc/json-schema` includes:

- Combinators with the names and signatures of `remix/data-schema` and
  `remix/data-schema/checks`/`coerce`, each returning a data-schema schema that also implements
  `StandardJSONSchemaV1`. Validation delegates to `remix/data-schema`, so behavior is identical.
- `toJSONSchema()`, which converts any `StandardJSONSchemaV1` schema, from this package or
  another library, into a 2020-12 document with named schemas collected under `$defs`
- `withJSONSchema()`, which pairs a schema built with `remix/data-schema` directly with a
  hand-written JSON Schema
- The JSON Schema 2020-12 vocabulary as TypeScript interfaces

`@sdxc/openapi` includes:

- `createDocument()` and `defineOperation()`: an operation is a route from a route map plus its
  params, query, headers, body, responses, problems and security, typed end to end
- `parse()` / `stringify()` for OpenAPI documents, in JSON and in YAML through `@sdxc/yaml`
- Security scheme builders for HTTP bearer, API key and OAuth 2.0
- A fetch-router action that serves the document as JSON or YAML
- A conformance checker for tests: a response the document does not describe is a violation,
  and a documented status no test produced is reported as uncovered

What stays out:

- Validating JSON against a JSON Schema document lives in the schema's own validator
  (`~standard.validate`); a 2020-12 validator for arbitrary documents is not part of either package
- An interactive reference UI lives in whatever renderer an app picks; the package serves the document
- Client generation lives in external tooling that reads the served document
- Problem types live in `@sdxc/problem`; the package reads a catalog and never defines one
- OAuth protected-resource metadata lives in the package ADR-084 adds; it can take its scope
  list from `document.scopes()`
- JSON Merge Patch media types and semantics live in the package ADR-092 adds; an operation names
  `application/merge-patch+json` as its body media type like any other

### Exports

#### `@sdxc/json-schema` — `"."`

```ts
import type { StandardJSONSchemaV1 } from "@standard-schema/spec";
import type { Result } from "@sdxc/result";
import type { Schema as DataSchema } from "remix/data-schema";

/** A JSON Schema 2020-12 document, as far as this package emits and reads it. */
export interface JSONSchema {
	$schema?: string;
	$id?: string;
	$ref?: string;
	$defs?: Record<string, JSONSchema>;
	type?: JSONSchema.TypeName | JSONSchema.TypeName[];
	enum?: readonly unknown[];
	const?: unknown;
	properties?: Record<string, JSONSchema>;
	required?: string[];
	additionalProperties?: boolean | JSONSchema;
	items?: JSONSchema;
	prefixItems?: JSONSchema[];
	anyOf?: JSONSchema[];
	oneOf?: JSONSchema[];
	allOf?: JSONSchema[];
	discriminator?: { propertyName: string; mapping?: Record<string, string> };
	minLength?: number;
	maxLength?: number;
	pattern?: string;
	format?: string;
	minimum?: number;
	maximum?: number;
	minItems?: number;
	maxItems?: number;
	default?: unknown;
	title?: string;
	description?: string;
	examples?: unknown[];
	deprecated?: boolean;
	readOnly?: boolean;
	writeOnly?: boolean;
}

export namespace JSONSchema {
	export type TypeName = "string" | "number" | "integer" | "boolean" | "object" | "array" | "null";
	/** Which side of a `transform` to describe: what a caller sends, or what the parser yields. */
	export type Direction = "input" | "output";
}

/** Keywords that describe a schema without changing what it accepts. */
export interface Annotations<Output> {
	/** Hoists the schema into `$defs` (and OpenAPI `components.schemas`) under this name. */
	id?: string;
	title?: string;
	description?: string;
	examples?: Output[];
	deprecated?: boolean;
	format?: string;
	pattern?: string;
}

/** A `remix/data-schema` schema that can also describe itself as JSON Schema. */
export interface Schema<Input, Output = Input> extends DataSchema<Input, Output> {
	readonly "~standard": DataSchema<Input, Output>["~standard"] &
		StandardJSONSchemaV1.Props<Input, Output>;
	pipe(...checks: Check<Output>[]): Schema<Input, Output>;
	/** The predicate validates; the JSON Schema is unchanged, so describe it with `meta`. */
	refine(predicate: (value: Output) => boolean, message?: string): Schema<Input, Output>;
	/** The input side keeps this schema; the output side is `output`, or `{}` without one. */
	transform<Next>(fn: (value: Output) => Next, output?: Schema<unknown, Next>): Schema<Input, Next>;
	meta(annotations: Annotations<Output>): Schema<Input, Output>;
}

/** A `remix/data-schema` check that also contributes JSON Schema keywords. */
export interface Check<Output> {
	check(value: Output): boolean;
	message?: string;
	code?: string;
	values?: Record<string, unknown>;
	readonly keywords: JSONSchema;
}

export function any(): Schema<unknown>;
export function array<Item extends Schema<any, any>>(item: Item): Schema</* inferred */>;
export function boolean(): Schema<boolean>;
export function defaulted<S extends Schema<any, any>>(schema: S, value: InferOutput<S>): S;
export function enum_<const Values extends readonly (string | number)[]>(values: Values): Schema<Values[number]>;
/** Emits `type: "integer"`; validation is `number()` plus `Number.isInteger`. */
export function integer(): Schema<number>;
export function lazy<S extends Schema<any, any>>(get: () => S, annotations: { id: string }): S;
export function literal<const Value extends string | number | boolean>(value: Value): Schema<Value>;
export function null_(): Schema<null>;
export function nullable<S extends Schema<any, any>>(schema: S): Schema</* S | null */>;
export function number(): Schema<number>;
export function object<Shape extends Record<string, Schema<any, any>>>(
	shape: Shape,
	options?: { unknownKeys?: "strip" | "passthrough" | "error" },
): Schema</* inferred from Shape */>;
export function optional<S extends Schema<any, any>>(schema: S): Schema</* S | undefined */>;
export function record<K extends Schema<string, string>, V extends Schema<any, any>>(key: K, value: V): Schema</* ... */>;
export function string(): Schema<string>;
export function tuple<const Items extends readonly Schema<any, any>[]>(items: Items): Schema</* ... */>;
export function union<const Members extends readonly Schema<any, any>[]>(members: Members): Schema</* ... */>;
export function variant<Key extends string, Variants extends Record<string, Schema<any, any>>>(
	discriminator: Key,
	variants: Variants,
): Schema</* ... */>;

export { parse, parseSafe } from "remix/data-schema";
export type { InferInput, InferOutput } from "remix/data-schema";

/** Pairs a schema built with `remix/data-schema` directly with the JSON Schema it accepts. */
export function withJSONSchema<Input, Output>(
	schema: DataSchema<Input, Output>,
	jsonSchema: JSONSchema | { input: JSONSchema; output: JSONSchema },
): Schema<Input, Output>;

export interface ToJSONSchemaOptions {
	/** @default "input" */
	direction?: JSONSchema.Direction;
	/** `"defs"` collects named schemas under `$defs` and references them. @default "defs" */
	refs?: "defs" | "inline";
}

/** Converts any Standard JSON Schema; a nested schema that cannot describe itself is a failure naming its path. */
export function toJSONSchema(
	schema: StandardJSONSchemaV1,
	options?: ToJSONSchemaOptions,
): Result<JSONSchema, JSONSchemaConversionError>;

export class JSONSchemaConversionError extends Error {
	readonly path: readonly (string | number)[];
}
```

Mapping from combinators to keywords:

| Combinator                                | JSON Schema 2020-12                                                         |
| ----------------------------------------- | --------------------------------------------------------------------------- |
| `object(shape)`                           | `type: "object"`, `properties`, `required` = keys not wrapped in `optional` |
| `object(shape, { unknownKeys: "error" })` | adds `additionalProperties: false`                                          |
| `optional(x)` / `defaulted(x, v)`         | removes the key from `required`; `defaulted` adds `default: v`              |
| `nullable(x)`                             | `type: [T, "null"]`, or `anyOf: [x, { type: "null" }]` for non-scalar `x`   |
| `enum_(values)` / `literal(v)`            | `enum` / `const`                                                            |
| `variant(key, variants)`                  | `oneOf` of each variant with `key` as `const`, plus OpenAPI `discriminator` |
| `union(members)` / `tuple(items)`         | `anyOf` / `prefixItems` with `items: false`                                 |
| `record(k, v)`                            | `type: "object"`, `additionalProperties: v`                                 |
| `lazy(get, { id })`                       | `$ref: "#/$defs/<id>"`, which is what makes recursion terminate             |
| `checks.minLength` … `checks.max`         | `minLength`, `maxLength`, `minimum`, `maximum`                              |
| `checks.email()` / `checks.url()`         | `format: "email"` / `format: "uri"`                                         |
| `checks.pattern(re)`                      | `pattern: re.source` (the regex is also the check, so the two agree)        |
| `coerce.number()` etc.                    | the input side is `string` or the target type; the output side the target   |

#### `@sdxc/json-schema` — `"./checks"` and `"./coerce"`

```ts
// "./checks": the six remix/data-schema checks, plus what the API reference already documents
export function minLength(length: number): Check<string | readonly unknown[]>;
export function maxLength(length: number): Check<string | readonly unknown[]>;
export function min(limit: number): Check<number>;
export function max(limit: number): Check<number>;
export function email(): Check<string>;
export function url(): Check<string>;
export function pattern(regex: RegExp): Check<string>;
export function minItems(count: number): Check<readonly unknown[]>;
export function maxItems(count: number): Check<readonly unknown[]>;

// "./coerce": the five remix/data-schema coercions, for query strings and path params
export function number(): Schema<unknown, number>;
export function boolean(): Schema<unknown, boolean>;
export function date(): Schema<unknown, Date>;
export function bigint(): Schema<unknown, bigint>;
export function string(): Schema<unknown, string>;
```

#### `@sdxc/openapi` — `"."`

```ts
import type { Result } from "@sdxc/result";
import type { JSONSchema, Schema } from "@sdxc/json-schema";
import type { ProblemCatalog, ProblemEntries } from "@sdxc/problem";
import type { Route } from "remix/fetch-router";
import type { MatchParams } from "remix/route-pattern/match";

/** The OpenAPI 3.1 object model; types only. Wire names are OpenAPI's own, already camelCase. */
export namespace OpenAPI {
	export interface Document {
		openapi: "3.1.1";
		jsonSchemaDialect: "https://spec.openapis.org/oas/3.1/dialect/base";
		info: Info;
		servers: Server[];
		paths: Record<string, PathItem>;
		components: Components;
		security?: SecurityRequirement[];
		tags?: Tag[];
	}
	export interface Info {
		title: string;
		version: string;
		summary?: string;
		description?: string;
	}
	export interface Server {
		url: string;
		description?: string;
	}
	export interface Tag {
		name: string;
		description?: string;
	}
	export type SecurityRequirement = Record<string, string[]>;
	export interface PathItem {
		/* get, put, post, delete, patch, head: Operation */
	}
	export interface Operation {
		/* operationId, summary, tags, parameters, requestBody, responses, security, deprecated */
	}
	export interface Components {
		schemas: Record<string, JSONSchema>;
		responses: Record<string, Response>;
		securitySchemes: Record<string, SecurityScheme>;
	}
	export interface Response {
		/* description, headers, content */
	}
	export type SecurityScheme = HttpScheme | ApiKeyScheme | OAuth2Scheme | OpenIdConnectScheme;
	/* ...the remaining 3.1 objects, each an interface */
}

/** One response an operation declares: a body schema per media type, and its headers. */
export interface ResponseSpec {
	description: string;
	body?: Schema<any, any> | Record<string, Schema<any, any>>;
	headers?: Record<string, { schema: Schema<any, any>; description?: string; required?: boolean }>;
}

export interface OperationSpec<
	R extends Route,
	Params extends Schema<any, any>,
	Query extends Schema<any, any>,
	Body extends Schema<any, any>,
	Problems extends string,
> {
	summary: string;
	description?: string;
	tags?: string[];
	/** Keys must equal the route pattern's variables; a missing or extra key fails to compile. */
	params?: Params & Schema<Record<keyof MatchParams<R["pattern"]["source"]>, string>, any>;
	query?: Query;
	/** A schema is `application/json`; a record names media types explicitly. */
	body?: Body | Record<string, Body>;
	responses: Record<number, ResponseSpec>;
	/** Entry names from the document's problem catalog; unknown names fail to compile. */
	problems?: readonly Problems[];
	/** Scheme name to scopes; `[]` marks an unauthenticated operation. */
	security?: readonly Record<string, readonly string[]>[];
	deprecated?: boolean;
}

/** An operation bound to its route, carrying the types its handler and its tests use. */
export interface Operation<R extends Route, Params, Query, Body> {
	readonly route: R;
	readonly operationId: string;
	/** Parses params, query and body in one pass; failures carry Standard Schema issues. */
	parse(
		request: Request,
		params: Record<string, string>,
	): Promise<Result<{ params: Params; query: Query; body: Body }, OperationInputError>>;
}

export class OperationInputError extends Error {
	readonly location: "params" | "query" | "body";
	readonly issues: readonly StandardSchemaV1.Issue[];
}

/** Binds an operation spec to one route of a route map, keyed by the name it has there. */
export function defineOperation<R extends Route /* , ... */>(
	name: string,
	route: R,
	spec: OperationSpec<R /* , ... */>,
): Operation<R /* , ... */>;

export interface DocumentOptions<Entries extends ProblemEntries> {
	info: OpenAPI.Info;
	/** Absolute origins; the document never reads them from a request. */
	servers: OpenAPI.Server[];
	securitySchemes?: Record<string, OpenAPI.SecurityScheme>;
	/** Applied to every operation that declares no `security` of its own. */
	security?: readonly Record<string, readonly string[]>[];
	problems?: ProblemCatalog<Entries>;
	tags?: OpenAPI.Tag[];
}

export interface DocumentBuilder {
	add(...operations: Operation<any, any, any, any>[]): DocumentBuilder;
	/** Assembles the document; a duplicate operation, an unknown scheme or an unconvertible schema fails. */
	build(): Result<OpenAPI.Document, OpenAPIBuildError>;
	/** Every scope any operation requires, per scheme, for OAuth protected-resource metadata. */
	scopes(): Record<string, string[]>;
}

export function createDocument<Entries extends ProblemEntries>(
	options: DocumentOptions<Entries>,
): DocumentBuilder;

export class OpenAPIBuildError extends Error {
	readonly operationId: string | null;
	readonly pointer: string; // JSON Pointer into the document being built
}

/** Reads a JSON or YAML OpenAPI 3.1 document; checks the version and the top-level shape. */
export function parse(text: string): Result<OpenAPI.Document, OpenAPIParseError>;
export function stringify(
	document: OpenAPI.Document,
	options?: { format?: "json" | "yaml"; indent?: number },
): Result<string, OpenAPIStringifyError>;

export class OpenAPIParseError extends Error {}
export class OpenAPIStringifyError extends Error {}

export const MEDIA_TYPE_JSON = "application/json";
export const MEDIA_TYPE_YAML = "application/yaml"; // RFC 9512
```

How problems become responses: `createDocument` reads `catalog.entries()` and emits one
`components.schemas.Problem` for the RFC 9457 base members. Each entry becomes a
`components.responses.<Name>` whose `application/problem+json` schema is `allOf` the base,
`type` as a `const` of the entry's URL, `status` as a `const`, and the entry's extension schema.
An operation's `problems: ["notFound", "validationError"]` adds a `$ref` under each entry's
status. When two named entries share a status (uptime's `badRequest`, `validationError` and
`limitExceeded` are all `400`), the response under `400` is a `oneOf` of their schemas with the
descriptions joined. That needs one change in `@sdxc/problem`: `CatalogEntry` gains
`extensions?: StandardSchemaV1`, the schema the entry was declared with, and `ISSUES_SCHEMA` is
rebuilt with `@sdxc/json-schema` combinators. It stays a `remix/data-schema` schema, so no caller
changes.

#### `@sdxc/openapi` — `"./security"`

```ts
export function bearer(options?: {
	description?: string;
	bearerFormat?: string;
}): OpenAPI.HttpScheme;
export function apiKey(options: {
	in: "header" | "query" | "cookie";
	name: string;
	description?: string;
}): OpenAPI.ApiKeyScheme;
export function oauth2(options: {
	description?: string;
	flows: {
		clientCredentials?: { tokenUrl: string; scopes: Record<string, string> };
		authorizationCode?: {
			authorizationUrl: string;
			tokenUrl: string;
			scopes: Record<string, string>;
		};
	};
}): OpenAPI.OAuth2Scheme;
export function openIdConnect(options: {
	openIdConnectUrl: string;
	description?: string;
}): OpenAPI.OpenIdConnectScheme;
```

OpenAPI 3.1 has no field for an OAuth 2.0 authorization server's metadata URL. `oauth2()` writes
the flows' URLs, and its `description` links to the resource's
`/.well-known/oauth-protected-resource` document, which ADR-084 publishes. That metadata's
`scopes_supported` is built from `document.scopes()`, so the scopes an operation requires and the
scopes the resource advertises come from one list.

#### `@sdxc/openapi` — `"./router"`

```ts
import type { RequestHandler } from "remix/fetch-router";

export interface ServeOptions {
	/** @default "public, max-age=300" */
	cacheControl?: string;
}

/**
 * A handler that serves the document: JSON by default, YAML for `Accept: application/yaml` or
 * `?format=yaml`, with a strong `ETag` over the serialized bytes and `304` on a match.
 * `build` runs on the first request and its result is reused, which keeps document assembly
 * out of the Worker's global scope.
 */
export function openapiHandler(
	build: () => Result<OpenAPI.Document, OpenAPIBuildError>,
	options?: ServeOptions,
): RequestHandler;
```

Negotiation goes through `@sdxc/http/negotiate`, and a build failure answers `500` with a problem
document, which the conformance test catches before a deploy does.

#### `@sdxc/openapi` — `"./testing"`

```ts
export interface Violation {
	operationId: string | null;
	kind:
		| "undocumented-operation" // method + path matches no operation
		| "undocumented-status"
		| "undocumented-media-type"
		| "undocumented-problem-type"
		| "missing-header"
		| "body-mismatch";
	message: string;
	/** JSON Pointer into the response body, for a body mismatch. */
	pointer?: string;
}

export class ConformanceError extends Error {
	readonly violations: readonly Violation[];
}

/** Checks one exchange against the operations; the response body is read from a clone. */
export function checkResponse(
	document: DocumentBuilder,
	request: Request,
	response: Response,
): Promise<Result<void, ConformanceError>>;

/** Records every exchange a test router serves, for a suite-level assertion. */
export function createConformanceRecorder(document: DocumentBuilder): {
	middleware: Middleware;
	violations(): readonly Violation[];
	/** Declared `operationId` + status pairs no recorded exchange produced. */
	uncovered(): readonly { operationId: string; status: number }[];
};
```

Response bodies are validated with the declared schema's own `~standard.validate`, the same
`remix/data-schema` code the schema's JSON Schema was derived from. So the check answers "does
this response match what the document says", and the conversion itself is tested once, in
`@sdxc/json-schema`. The recorder catches both directions `2796c090` fixed by hand. A response
the document does not describe is a violation. A documented status no test ever produced
(`uncovered()`) is a row the reference promises and nothing tests.

### Usage

#### Uptime: operations live beside the route map, not in the controllers

`apps/uptime/routes/api-groups.ts` exists so the bootstrap can map a group without importing the
controller behind it. The document must list every operation, and it must not import every
controller. So operations live in their own modules, which hold only schemas, and both the
controller and the document import them:

```ts
// apps/uptime/app/http/openapi/monitors.ts
import * as s from "@sdxc/json-schema";
import * as checks from "@sdxc/json-schema/checks";
import { defineOperation } from "@sdxc/openapi";

import { envelope } from "~/app/http/openapi/envelope";
import { typedId } from "~/app/services/typed-id";
import routes from "~/routes/web";

export const MonitorSchema = s
	.object({
		id: typedId("mon"),
		name: s.string(),
		url: s.string().pipe(checks.url()),
		intervalSeconds: s.integer(),
		enabledAt: s.nullable(s.integer()),
		createdAt: s.integer().meta({ description: "Epoch milliseconds" }),
		/* ... */
	})
	.meta({ id: "Monitor" });

export const monitorUpdate = defineOperation("monitorUpdate", routes.api.v1.monitors.update, {
	summary: "Update an HTTP monitor",
	tags: ["HTTP monitors"],
	params: s.object({ monitorId: typedId("mon") }),
	body: s.object({
		name: s.optional(s.string().pipe(checks.minLength(1), checks.maxLength(255))),
		intervalSeconds: s.optional(s.integer().pipe(checks.min(60), checks.max(3600))),
		/* ... */
	}),
	responses: {
		200: { description: "The updated monitor", body: envelope({ monitor: MonitorSchema }) },
	},
	problems: ["validationError", "unauthorized", "forbidden", "notFound"],
	security: [{ apiKey: ["monitors:write"] }],
});
```

`typedId(prefix)` in `app/services/typed-id.ts` becomes
`s.string().pipe(checks.pattern(typeIdPattern(prefix))).transform(decode)`, so the path
parameter documents its prefix, and the regex is the check. `envelope(data)` and
`pageEnvelope(data)` describe `apiSuccess()` and `apiPage()` once: `data`, `meta.requestId`,
`meta.timestamp`, `meta.pagination`, and the `Link` header for pages.

The controller reads the same operation:

```ts
// apps/uptime/app/http/controllers/api/monitor.ts
monitorUpdate: {
	middleware: [requireApiKey("monitors:write")],
	handler: async (ctx) => {
		let input = await monitorUpdateOp.parse(ctx.request, ctx.params);
		if (isFailure(input)) return inputProblem(input.error);
		/* input.data.params.monitorId, input.data.body.name, typed from the operation */
	},
},
```

`serializeMonitor` is annotated to return `s.InferOutput<typeof MonitorSchema>`. The compiler
checks the serializer against the documented shape, and the conformance recorder checks the
bytes.

#### Uptime: the document and its route

```ts
// apps/uptime/app/http/openapi/document.ts
export function buildApiDocument() {
	return createDocument({
		info: { title: "Uptime API", version: "1" },
		servers: [{ url: "https://uptime.sergiodxa.com" }],
		securitySchemes: {
			apiKey: bearer({ description: "An API key from Settings, sent as a bearer token" }),
		},
		problems: apiProblems,
	}).add(...Object.values(monitors), ...Object.values(dnsMonitors) /* ... */);
}

// apps/uptime/routes/web.ts gains  openapi: get("/api/v1/openapi.json")
// apps/uptime/bootstrap/app.tsx maps it to openapiHandler(() => buildApiDocument().build())
```

#### Uptime: the drift test

```ts
// apps/uptime/app/http/openapi/document.test.ts
test("the document builds and matches the committed snapshot", async () => {
	let document = unwrap(buildApiDocument().build());
	await expect(unwrap(stringify(document))).toMatchFileSnapshot("./openapi.snapshot.json");
});
```

Each API controller test installs `createConformanceRecorder(buildApiDocument()).middleware` on
its test router and ends with `expect(recorder.violations()).toEqual([])`. A helper in
`~/app/lib/test/openapi.ts` wraps that for every API test file. The committed snapshot turns
every contract change into a reviewable diff in the commit that makes it.

#### Auth-saas: the management API

Operations live in `apps/auth-saas/app/http/openapi/`. The document takes `managementProblems`
from `@sdxc/auth` and one security scheme:

```ts
oauth2({
	description:
		"Client-credentials token; resource metadata at /.well-known/oauth-protected-resource",
	flows: {
		clientCredentials: {
			tokenUrl: `https://api.${PLATFORM_DOMAIN}/oauth/token`,
			scopes: MANAGEMENT_SCOPES,
		},
	},
});
```

`GET /openapi.json` on `api.{PLATFORM_DOMAIN}` serves it. `info.version` is the `X-API-Version`
date the document describes (`apps/auth-saas/app/http/lib/api-version.ts`). When a second date is
published, each version gets its own document, built from the operations that version serves.

### Reference docs

The uptime reference stops hand-writing what the document holds. The 94 schema blocks, the field
tables, the "Required Scope" line and the "Possible Errors" table of every endpoint are rendered
from the document by the docs controller (`app/http/controllers/docs-show.tsx`). A resource page's
frontmatter names the operations it covers (`operations: [monitorsIndex, monitorShow, …]`), and
the controller renders the prose followed by each operation's generated reference. Guides,
explanations of behavior (repeat rules, status rules, pagination) and curl examples stay
hand-written Markdown, since they say what a schema cannot. Auth-saas has no reference to
migrate, so its document is the reference until a docs page renders it the same way.

## Consequences

### Positive

- **One source for the contract** - the schema a handler validates with is the schema the
  document publishes, and the drift `2796c090` fixed by hand becomes a failing test
- **Both directions of drift are caught** - undocumented responses are violations, and
  documented statuses no test produces are listed as uncovered
- **Typed handlers for free** - `operation.parse` replaces the pair of `s.parse(ctx.params)` and
  `validate(ctx.request)` calls in every API action, with types from the same declaration
- **Standard output** - any OpenAPI 3.1 tool (client generators, Postman, Scalar) reads the API
  without a hand-maintained export
- **Problem catalogs become documentation** - each entry is a reusable response, and ADR-077's
  "render the error reference from `entries()`" happens through this package

### Negative

- **Schemas move off `remix/data-schema`'s own module** - API-facing schemas import
  `@sdxc/json-schema` instead. The names and signatures match, but it is a wrapper that has to
  follow data-schema's releases, and a combinator data-schema adds does not exist here until it
  is wrapped
- **`refine` and `transform` stay opaque** - a refinement documents nothing unless its author
  adds `meta()` or uses a keyword-carrying check. The document can be less strict than the
  validator, and the conformance test cannot notice that, because it validates with the stricter
  code
- **Response schemas are new work** - uptime has serializers, not response schemas. About 25
  resource shapes must be written once, which is the same information the 94 Markdown blocks hold
  today, but it is still a port
- **Two more packages** - both are published and documented, and `@sdxc/problem` gains a
  dependency on `@sdxc/json-schema`

### Neutral

- **An upstream path exists** - if `remix/data-schema` implements `StandardJSONSchemaV1`,
  `toJSONSchema` accepts its schemas directly and the combinators can shrink to the metadata
  data-schema lacks. `@sdxc/openapi` depends only on the Standard JSON Schema interface, so it is
  unaffected
- **OpenAPI 3.1, not 3.2** - 3.2 adds `oauth2MetadataUrl`, which would replace the description
  link to the protected-resource metadata. Tooling support for 3.1 is broad today; moving is a
  version field and one security-scheme field
- **`@sdxc/mcp` keeps its JSON-Schema-first subset** - adopting `@sdxc/json-schema` there is a
  separate decision

## Implementation Plan

### Phase 1: `@sdxc/json-schema`

**Priority:** High
**Estimated Effort:** 1 day

1. Write the tests first: each combinator's keywords, `optional`/`defaulted` against `required`,
   `nullable` on scalars and objects, `variant` with `discriminator`, `lazy` recursion through
   `$defs`, `transform` input and output sides, a nested plain data-schema schema failing with its
   path, and every combinator validating exactly as its `remix/data-schema` counterpart
2. Implement the combinators by wrapping `remix/data-schema`, then checks, coerce,
   `withJSONSchema` and `toJSONSchema`
3. README per the package documentation guide, and the root README table row

### Phase 2: `@sdxc/openapi`

**Priority:** High
**Estimated Effort:** 1.5 days

1. Tests first: `:param` to `{param}`, params keys against pattern variables (type tests under
   `bun typecheck`), duplicate `operationId`, problem entries merging into `oneOf` per status,
   `$ref` hoisting of named schemas, YAML and JSON round trips, conformance violations of each kind,
   and `uncovered()`
2. Implement `createDocument`, `defineOperation`, `parse`/`stringify`, `"./security"`,
   `"./router"`, `"./testing"`
3. In `@sdxc/problem` (its own commit): add `extensions` to `CatalogEntry`, and rebuild
   `ISSUES_SCHEMA` with `@sdxc/json-schema`

### Phase 3: Adopt in uptime

**Priority:** High
**Estimated Effort:** 2 days

1. `typedId` on `@sdxc/json-schema`; `envelope`/`pageEnvelope` schemas beside `apiSuccess`/`apiPage`
2. One `app/http/openapi/<resource>.ts` per resource group in `routes/api-groups.ts`, moving each
   controller's schemas there and switching handlers to `operation.parse`
3. `buildApiDocument`, the `/api/v1/openapi.json` route, the snapshot test, and the conformance
   recorder in every API controller test
4. Render each resource page's reference sections from the document, and delete the hand-written
   schema blocks and error tables

### Phase 4: Adopt in auth-saas

**Priority:** Medium
**Estimated Effort:** 1.5 days

1. Operations per resource under `app/http/openapi/`, replacing `parseBody` with `operation.parse`
2. The document with `managementProblems` and the `oauth2` scheme, served at `/openapi.json`
3. The snapshot test and the conformance recorder in the management test harness

## Alternatives Considered

### 1. Hand-write JSON Schema next to each data-schema schema (`withJSONSchema` everywhere)

**Rejected because**: it reproduces the uptime docs' problem one layer down, two descriptions of
one contract kept in step by hand. It stays available as the escape hatch for a schema
the combinators cannot express, and the conformance test catches a disagreement.

### 2. JSON Schema literals as the source, as `@sdxc/mcp` does

Derive the TypeScript type and the validator from a JSON Schema literal.

**Rejected because**: every API schema in the repo is already data-schema, uses `refine`,
`transform`, variants and defaults, and would need a full 2020-12 validator re-implemented. MCP's
narrow subset is right for model-filled arguments and wrong for a public REST API.

### 3. Switch to a schema library that implements Standard JSON Schema

Zod 4, Valibot and ArkType can emit JSON Schema.

**Rejected because**: the repo standardized on `remix/data-schema` (and AGENTS.md forbids new
Zod). Their conversions are also silent or throwing on refinements, so they share the
`refine`/`transform` limitation.

### 4. Generate the document by scanning source (TypeScript AST or runtime tracing)

**Rejected because**: closures hide the shape from an AST as well, and inferring responses from
serializer return types gives types without limits, formats or descriptions. A declaration the
handler itself executes is the only source that cannot disagree with the handler.

### 5. Keep the hand-written reference and add response tests

**Rejected because**: tests would assert the handler's behavior, not the reference's text, and
the two would still drift, which is the state `2796c090` inherited.

## References

- [OpenAPI Specification 3.1.1](https://spec.openapis.org/oas/v3.1.1.html)
- [JSON Schema 2020-12](https://json-schema.org/draft/2020-12)
- [Standard Schema and Standard JSON Schema](https://standardschema.dev)
- [RFC 9457 - Problem Details for HTTP APIs](https://www.rfc-editor.org/rfc/rfc9457)
- [RFC 9512 - YAML Media Type](https://www.rfc-editor.org/rfc/rfc9512)
- [ADR-057: Request Context Instead of a Service Container](./ADR-057-request-context-instead-of-a-service-container.md)
- [ADR-077: Problem Details Package](./ADR-077-problem-details-package.md)
- [ADR-084: OAuth Protected Resource Metadata](./ADR-084-oauth-protected-resource-metadata.md)
- [ADR-092: JSON Merge Patch Package](./ADR-092-json-merge-patch-package.md)
- [auth-saas ADR-034: Management API](./auth-saas/ADR-034-management-api.md)

## Notes

- Implementation: `@sdxc/problem` stays free of a `@sdxc/json-schema` dependency, because
  it is a public package and `@sdxc/json-schema` is private. `ISSUES_SCHEMA` implements
  Standard JSON Schema with a hand-written converter instead of being rebuilt from the
  combinators, and `CatalogEntry.extensions` is present only on entries declared with one.
- Implementation: combinators nest any `DescribedSchema` (a `remix/data-schema` schema that
  implements Standard JSON Schema), so `s.object({ errors: ISSUES_SCHEMA })` composes. `pipe`
  accepts plain data-schema checks too; only keyword-carrying checks document themselves.
- Implementation: `defaulted` and `lazy` return `Schema<InferInput<S> | undefined, …>` and
  `Schema<InferInput<S>, InferOutput<S>>` rather than `S`, matching what data-schema returns.
  An object's inferred types make a key whose value accepts `undefined` optional (`key?:`).
- Implementation: `OpenAPI.Document` makes optional what the specification makes optional
  (`servers`, `paths`, `components`, `jsonSchemaDialect`) and types `openapi` as `string`, so
  `parse` can return documents other tools wrote; a built document always sets every field.
- Implementation: problem names are checked at compile time by `DocumentBuilder.add`, since
  `defineOperation` runs before the catalog is known; `Operation` carries them as a type
  parameter. `DocumentBuilder` also exposes `operations()` and `problems()` for the
  conformance checker.
- Implementation: `openapiHandler` negotiates with `remix/headers` (`Accept`, `IfNoneMatch`)
  instead of `@sdxc/http/negotiate`, which is not a dependency of the package. The ETag is the
  hex SHA-256 of the serialized bytes; a weak `If-None-Match` also revalidates.
- Implementation: every schema in the document describes its input side, response bodies
  included, because the conformance checker validates a response by passing its body to the
  schema. A request body is always `required: true`.
- Adoption (uptime): handlers keep their own parsing (`s.parse` of the params, `validate` of the
  body, `PAGING` for the query) with the operation module's schemas, rather than
  `operation.parse`. Several handlers answer `404` before they read the body, and `parse`
  validates params, query and body up front, which would reorder those answers.
- Adoption (uptime): a reference page marks each endpoint with `<!-- operation: <id> -->`
  where its generated scope line, error table and JSON Schema blocks go, in place of a
  frontmatter list, so each endpoint's prose stays beside its reference. Field tables stay
  hand-written, since their descriptions and defaults read better than a generated table.
- Adoption (uptime): `checkConformance(routeMap)` in `app/lib/test/openapi.ts` limits
  `uncovered()` to the file's own operations, since each API test file covers one
  controller. Branches only a programming error reaches (the `internal` problem after
  `Pagination.byKeyset`) are left undeclared.
- Adoption (auth-saas): some handlers keep their own parsing with the operation's schemas
  and the operation documents them only: merge-patch routes read through `readPatchBody`,
  the subject list and keyset lists keep `managementPaging.parse` (a bad `per_page` answers
  `invalidRequest`), and the import route streams its NDJSON body unread by `parse`.
- Adoption (auth-saas): the shared harness's recorder asserts `violations()` only, not
  `uncovered()`, since each area's test files share one document of 75 operations. The
  `X-API-Version` echo is undocumented; `unsupportedApiVersion` is listed on every operation.

## Current Progress

- [x] Phase 1: `@sdxc/json-schema`
- [x] Phase 2: `@sdxc/openapi` (with the `@sdxc/problem` change)
- [x] Phase 3: Adopt in uptime (`app/http/openapi/`: one module per resource, the document,
      `/api/v1/openapi.json`, the snapshot test, the conformance recorder in every API test file,
      and the reference's scope lines, error tables and schema blocks rendered from the document)
- [x] Phase 4: Adopt in auth-saas (`app/http/openapi/`: one module per area covering all 75
      management operations, `/openapi.json`, the snapshot test, and the conformance recorder
      in every management test harness)
