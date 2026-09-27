# ADR-085: SCIM 2.0 Package

## Status

**Accepted** - 2026-09-24

## Background

SCIM 2.0 is how an enterprise directory (Okta, Microsoft Entra ID, Google Workspace, JumpCloud)
pushes its people and groups into a service: [RFC 7643](https://www.rfc-editor.org/rfc/rfc7643)
defines the resource schemas (User, Group, the Enterprise User extension, resource metadata) and
[RFC 7644](https://www.rfc-editor.org/rfc/rfc7644) defines the protocol (the `/Users` and
`/Groups` endpoints, the filter grammar, PATCH operations, list paging, the error document and
the discovery endpoints). auth-saas implements the service-provider side as a paid add-on
([auth-saas ADR-029](./auth-saas/ADR-029-scim-provisioning.md)).

That implementation interleaves two different kinds of code. One is the protocol: media types,
schema URNs, the `ListResponse` envelope, the error document, the filter and PATCH-path grammars,
the discovery documents. The other is auth-saas's own model: connection tokens, the link table,
the mapping onto subjects, the entitlement carve-out for deactivation, audit rows. The protocol
half is written as the narrowest subset the deployed clients were observed sending, parsed with
regular expressions (`/^(\S+)\s+eq\s+"([^"]*)"$/i`, `/^members\[value eq "([^"]*)"\]$/`), and
ADR-029 refuses the rest of the grammar because "a half-implemented parser answers wrong rather
than refusing". A complete, tested parser removes that argument, and it is spec logic no app
should own.

## Context

### Current state

| File                                              | Lines | Spec logic                                                                                                                 | App logic                                                                                                     |
| ------------------------------------------------- | ----: | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `apps/auth-saas/database/scim.ts`                 |  1761 | `parseEqFilter` (regex, `eq` only), `startIndex`/`count` clamping and slicing twice, page-size constants, resource types   | tables, token digest and rotation, link rows, subject mapping, digest-based no-op replace, audit, group roles |
| `apps/auth-saas/app/http/scim/request.ts`         |   230 | resource body schemas, PATCH envelope, PATH regexes, list query reading                                                    | folding the Enterprise URN onto `enterprise: Record<string, AttributeValue>`, the op-to-RPC translation       |
| `apps/auth-saas/app/http/scim/response.ts`        |   237 | `application/scim+json`, schema URNs, the error document, `ListResponse`, dropping empty members                           | `scimFailure` (refusal reason to status and `scimType`), `userToScim`, `groupToScim`                          |
| `apps/auth-saas/app/http/controllers/scim/*.ts`   |   595 | `ServiceProviderConfig`, `ResourceTypes`, `Schemas` documents, the attribute-definition shape, `501` for `/Bulk` and `/Me` | which attributes are advertised, the pure-deactivation entitlement exception, RPC calls to the tenant object  |
| `apps/auth-saas/app/http/middleware/scim-gate.ts` |   101 | reading `Authorization: Bearer`                                                                                            | per-token rate limit, entitlement check, publishing `ctx.scimToken`                                           |

About 2.9k lines, of which roughly 700 are protocol. The rest is auth-saas and stays there.

### Where the subset deviates from the RFCs

| Behavior today                                                 | What the RFC says                                                                                                      |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `userName eq "Ana@Example.com"` misses `ana@example.com`       | `userName` and Group `displayName` are `caseExact: false` (RFC 7643 §4.1.1, §4.2), so `eq` folds case                  |
| Anything beyond `attr eq "value"` refused with `invalidFilter` | The grammar has `ne`, `co`, `sw`, `pr`, `and`/`or`/`not` and value paths (`emails[type eq "work"]`), RFC 7644 §3.4.2.2 |
| Attribute names compared case-sensitively (`username` refused) | Attribute names are case-insensitive (RFC 7643 §2.1)                                                                   |
| No `meta` on any representation                                | `meta.resourceType`, `created`, `lastModified`, `location` describe every resource (RFC 7643 §3.1)                     |
| A negative `count` slices from the end                         | A `count` below 0 is 0, a `startIndex` below 1 is 1 (RFC 7644 §3.4.2.4)                                                |
| PATCH without `path` refused                                   | A path-less `add` or `replace` carries an object whose members are merged (RFC 7644 §3.5.2.1, .3)                      |

### What the RFCs ask of an implementation

| Rule                                                                             | Consequence for the package                                                                    |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Filter grammar: `attrPath op value`, `pr`, `and`/`or`/`not`, groups, value paths | a real tokenizer and recursive-descent parser producing an AST, errors as `invalidFilter`      |
| Comparison honors the attribute's type and `caseExact`                           | evaluation reads attribute definitions, the same objects the `Schemas` endpoint serves         |
| Attributes may be written fully qualified (`urn:...:User:userName`)              | paths carry an optional schema URN, resolved against the declared schemas                      |
| PATCH `path` is `attrPath` or `valuePath[.subAttr]`, ops are add/remove/replace  | one path parser shared with the filter grammar; `remove` without `path` is `noTarget`          |
| Errors: `schemas`, `status` as a string, `scimType`, `detail`                    | a SCIM-specific error type and document, independent of RFC 9457                               |
| Media type `application/scim+json`                                               | every response builder sets it; request reading accepts it and `application/json`              |
| `ListResponse` with one-based `startIndex`, `itemsPerPage`, `totalResults`       | one query parser with the RFC's clamping rules and one envelope builder                        |
| `version` is an opaque (typically weak) entity tag, compared on `If-Match`       | a version helper that compares opaque tags, since RFC 7644 §3.14 sends `W/"..."` on `If-Match` |
| `returned: always/default/never/request`, `attributes`, `excludedAttributes`     | a projection function driven by attribute definitions                                          |

## Decision

Add `@sdxc/scim`: the resource model, grammars and documents of SCIM 2.0, as plain functions over
plain data and `Response` objects. Routing, authentication policy and storage stay in the app.

### Package name

| Name                           | Trade-off                                                                                                 |
| ------------------------------ | --------------------------------------------------------------------------------------------------------- |
| **`@sdxc/scim`** (recommended) | Names the standard; covers both sides, since the filter, PATCH and resource code serves a client too      |
| `@sdxc/scim-server`            | Accurate for the one consumer, but a SCIM client pushing users to a customer's directory reuses all of it |
| `@sdxc/scim2`                  | Encodes a version nobody needs to distinguish; SCIM 1.1 has no deployed clients left to tell it from      |
| `@sdxc/scim-core` + `-server`  | Two packages and two release lines for one consumer; subpath exports give the same separation             |

`@sdxc/scim` wins because the package holds the standard, not a role in it, matching `@sdxc/saml`
and `@sdxc/problem`.

### Scope

The package includes:

- RFC 7643 User, Group and Enterprise User types, their schema URNs, and parsing a wire resource
  into camelCase fields plus typed extensions
- Resource metadata (`meta`) and version tags
- The RFC 7644 filter grammar: parse to an AST, evaluate against a resource, and translate to a
  `remix/data-table` predicate where the filter allows it
- The PATCH request: parse operations and paths, apply them to a resource
- List queries (`filter`, `startIndex`, `count`, `sortBy`, `sortOrder`, `attributes`,
  `excludedAttributes`, and the `POST /.search` body), `ListResponse`, and attribute projection
- The error document, `ScimError`, and the `application/scim+json` response builders
- Discovery documents: `ServiceProviderConfig`, `ResourceTypes`, `Schemas`, and the RFC 7643 §8.7
  attribute definitions for User, Group and Enterprise User

What stays out, and where it lives:

- Routing and controllers live in the app, mapped with `createAction` as auth-saas does today
- Bearer-token authentication, rate limiting and entitlements live in the app's middleware
- Storage, the mapping from SCIM attributes onto the app's own model, and uniqueness rules live in
  the app (for auth-saas, in the tenant Durable Object)
- Bulk (RFC 7644 §3.7) is left to a later revision; `serviceProviderConfig` advertises
  `bulk.supported: false` unless told otherwise
- RFC 9457 problem documents live in `@sdxc/problem`; SCIM clients parse only the SCIM error
  schema, so this package writes that one

### Exports

Five subpaths, so an app that only needs the filter parser, or only the discovery documents, pulls
in nothing else.

#### `"."` — resources, errors, responses, list queries

```ts
import type { Result } from "@sdxc/result";
import type * as s from "remix/data-schema";

export const MEDIA_TYPE = "application/scim+json";
export const USER_SCHEMA = "urn:ietf:params:scim:schemas:core:2.0:User";
export const GROUP_SCHEMA = "urn:ietf:params:scim:schemas:core:2.0:Group";
export const ENTERPRISE_USER_SCHEMA = "urn:ietf:params:scim:schemas:extension:enterprise:2.0:User";
export const LIST_RESPONSE_SCHEMA = "urn:ietf:params:scim:api:messages:2.0:ListResponse";
export const PATCH_OP_SCHEMA = "urn:ietf:params:scim:api:messages:2.0:PatchOp";
export const SEARCH_REQUEST_SCHEMA = "urn:ietf:params:scim:api:messages:2.0:SearchRequest";
export const ERROR_SCHEMA = "urn:ietf:params:scim:api:messages:2.0:Error";

export namespace Scim {
	interface MultiValued<Value = string> {
		value: Value;
		display?: string;
		type?: string;
		primary?: boolean;
	}

	interface Meta {
		resourceType: string;
		created: Date;
		lastModified: Date;
		location: string;
		version?: string; // an entity tag, W/"..." when weak
	}

	interface Name {
		formatted?: string;
		familyName?: string;
		givenName?: string;
		middleName?: string;
		honorificPrefix?: string;
		honorificSuffix?: string;
	}

	interface EnterpriseUser {
		employeeNumber?: string;
		costCenter?: string;
		organization?: string;
		division?: string;
		department?: string;
		manager?: { value?: string; ref?: string; displayName?: string };
	}

	interface User<Extensions extends object = { enterprise?: EnterpriseUser }> {
		id?: string;
		externalId?: string;
		userName: string;
		name?: Name;
		displayName?: string;
		nickName?: string;
		profileUrl?: string;
		title?: string;
		userType?: string;
		preferredLanguage?: string;
		locale?: string;
		timezone?: string;
		active?: boolean;
		password?: string; // writeOnly, never serialized back
		emails?: MultiValued[];
		phoneNumbers?: MultiValued[];
		ims?: MultiValued[];
		photos?: MultiValued[];
		addresses?: Address[];
		groups?: MultiValued[]; // readOnly
		entitlements?: MultiValued[];
		roles?: MultiValued[];
		x509Certificates?: MultiValued[];
		extensions: Extensions;
		meta?: Meta;
	}

	interface Address {
		formatted?: string;
		streetAddress?: string;
		locality?: string;
		region?: string;
		postalCode?: string;
		country?: string;
		type?: string;
		primary?: boolean;
	}

	interface Group {
		id?: string;
		externalId?: string;
		displayName: string;
		members?: { value: string; ref?: string; display?: string; type?: "User" | "Group" }[];
		meta?: Meta;
	}

	interface ListQuery {
		filter: Filter.Expression | null;
		startIndex: number; // one-based, at least 1
		count: number; // 0 through maxCount
		sortBy: Filter.AttributePath | null;
		sortOrder: "ascending" | "descending";
		attributes: Filter.AttributePath[];
		excludedAttributes: Filter.AttributePath[];
	}

	interface Page<Resource> {
		resources: Resource[];
		totalResults: number;
		startIndex: number;
	}

	type ErrorType =
		| "invalidFilter"
		| "tooMany"
		| "uniqueness"
		| "mutability"
		| "invalidSyntax"
		| "invalidPath"
		| "noTarget"
		| "invalidValue"
		| "invalidVers"
		| "sensitive";
}

/** A SCIM refusal: the status, the RFC 7644 §3.12 `scimType` when one applies, and a detail. */
export class ScimError extends Error {
	readonly status: number;
	readonly scimType: Scim.ErrorType | null;
	constructor(status: number, detail: string, options?: { scimType?: Scim.ErrorType });
}

/** Extension schemas keyed by URN; the key in the parsed resource is the option's own key. */
export interface ExtensionSchemas {
	[key: string]: { urn: string; schema: s.Schema<unknown> };
}

/** `{ enterprise: { urn, schema } }` becomes `{ enterprise?: InferOutput<schema> }`. */
type InferExtensions<Extensions extends ExtensionSchemas> = {
	[Key in keyof Extensions]?: s.InferOutput<Extensions[Key]["schema"]>;
};

export interface ListQueryOptions {
	defaultCount?: number; // 100 when omitted
	maxCount?: number; // also what serviceProviderConfig advertises as filter.maxResults
	attributes?: Discovery.Definitions;
}

export function parseUser<Extensions extends ExtensionSchemas>(
	body: unknown,
	options?: { extensions?: Extensions },
): Result<Scim.User<InferExtensions<Extensions>>, ScimError>;
export function parseGroup(body: unknown): Result<Scim.Group, ScimError>;

/** The wire object: `schemas` filled from the extensions present, URN keys, empty members dropped. */
export function userResource(
	user: Scim.User<object>,
	options?: { extensions?: ExtensionSchemas },
): object;
export function groupResource(group: Scim.Group): object;

/** A weak entity tag over a stable serialization, for `meta.version` and the `ETag` header. */
export function version(resource: object): Promise<string>;
/** `If-Match`/`If-None-Match` against a version, comparing opaque tags weakly as SCIM clients expect. */
export function matchesVersion(request: Request, current: string): boolean;

export function readBody(request: Request): Promise<Result<unknown, ScimError>>; // 400 invalidSyntax
export function parseListQuery(
	url: URL,
	options?: ListQueryOptions,
): Result<Scim.ListQuery, ScimError>;
export function parseSearchRequest(
	body: unknown,
	options?: ListQueryOptions,
): Result<Scim.ListQuery, ScimError>;

export function scimResponse(body: object, init?: ResponseInit): Response; // application/scim+json
export function errorResponse(error: ScimError, init?: ResponseInit): Response;
export function listResponse<Resource>(
	page: Scim.Page<Resource>,
	toResource: (r: Resource) => object,
): Response;

/** `returned` and `attributes`/`excludedAttributes` applied to one wire object. */
export function project(
	resource: object,
	query: Scim.ListQuery,
	definitions: Discovery.Definitions,
): object;
```

`password` is accepted by `parseUser` and never written by `userResource`, since RFC 7643 marks
it `returned: never`. Extensions default to `{ enterprise: EnterpriseUser }`; an app that stores
the Enterprise URN's members as free-form attributes passes its own schema for it.

#### `"./filter"` — the grammar

```ts
export namespace Filter {
	interface AttributePath {
		schema: string | null; // the URN prefix, when written fully qualified
		attribute: string;
		subAttribute: string | null;
	}

	type Operator = "eq" | "ne" | "co" | "sw" | "ew" | "gt" | "ge" | "lt" | "le";
	type Value = string | number | boolean | null;

	type Expression =
		| { kind: "compare"; path: AttributePath; operator: Operator; value: Value }
		| { kind: "present"; path: AttributePath }
		| { kind: "and" | "or"; left: Expression; right: Expression }
		| { kind: "not"; expression: Expression }
		| { kind: "valuePath"; path: AttributePath; filter: Expression };

	interface CompileOptions {
		/** Attribute definitions: type, `caseExact`, multi-valued; also the allowlist. */
		definitions: Discovery.Definitions;
		/** Paths callers may filter on; anything else is `invalidFilter`. Defaults to every definition. */
		allow?: string[];
	}
}

export function parseFilter(text: string): Result<Filter.Expression, ScimError>;
export function parsePath(text: string): Result<Filter.AttributePath, ScimError>;
export function stringifyFilter(expression: Filter.Expression): string;

/** A predicate over a wire-shaped resource; string `eq` folds case where `caseExact` is false. */
export function compileFilter(
	expression: Filter.Expression,
	options: Filter.CompileOptions,
): Result<(resource: object) => boolean, ScimError>;
```

`parseFilter` answers any text the ABNF in RFC 7644 §3.4.2.2 accepts, with operator and logical
keywords matched case-insensitively and precedence `not` > `and` > `or`. Evaluation follows the
RFC's type rules: `gt`/`ge`/`lt`/`le` on booleans and binary are `invalidFilter`, date-time strings
compare as instants, and a multi-valued attribute matches when any value matches.

#### `"./data-table"` — pushing a filter into SQL

```ts
import type { Predicate } from "remix/data-table";

export interface ColumnMap {
	[path: string]: string | { column: string; caseExact?: boolean };
}

/** The filter is valid but has no `remix/data-table` equivalent; evaluate it in memory instead. */
export class UntranslatableFilterError extends Error {}

export function filterToWhere(
	expression: Filter.Expression,
	columns: ColumnMap,
): Result<Predicate, ScimError | UntranslatableFilterError>;
```

`eq`/`ne`/`gt`/`ge`/`lt`/`le` map to `remix/data-table`'s operators of the same names, `co`/`sw`/`ew`
to `like` (or `ilike` when `caseExact` is false) with `%` and `_` escaped, `pr` to `notNull`, and
`and`/`or` to `and`/`or`. `remix/data-table` has no negation operator, so `not` translates only
when it wraps something with a direct inverse (`eq` to `ne`, `pr` to `isNull`); anything else, a
value path, or a path absent from `columns` fails with `UntranslatableFilterError`. The caller then
falls back to `compileFilter` over the rows it loaded, which is always correct, only slower. This
subpath is separate so the core never imports `remix/data-table`.

#### `"./patch"` — PatchOp

```ts
export namespace Patch {
	interface Operation {
		op: "add" | "remove" | "replace";
		path: {
			attribute: Filter.AttributePath;
			filter: Filter.Expression | null;
			subAttribute: string | null;
		} | null;
		value: unknown;
	}
}

export function parsePatch(body: unknown): Result<Patch.Operation[], ScimError>;

/** Applies every operation, or none: the first failure returns before the resource is touched. */
export function applyPatch<Resource extends object>(
	resource: Resource,
	operations: Patch.Operation[],
	options: { definitions: Discovery.Definitions },
): Result<Resource, ScimError>;
```

`parsePatch` checks the `PatchOp` schema URN and reads `op` case-insensitively, since Entra ID
sends `"Replace"`. `applyPatch` works on a copy of the wire-shaped resource and implements RFC 7644
§3.5.2: `add` appends to multi-valued attributes and sets single-valued ones, a path-less `add` or
`replace` merges an object, `remove` without a path is `noTarget`, a value path that matches
nothing is `noTarget` for `remove` and `replace`, and a `readOnly` or `immutable` attribute is
`mutability`. When the definitions say an attribute is boolean, the strings `"True"` and `"False"`
are read as booleans.

#### `"./discovery"` — capability documents

```ts
export namespace Discovery {
	interface Attribute {
		name: string;
		type:
			| "string"
			| "boolean"
			| "decimal"
			| "integer"
			| "dateTime"
			| "reference"
			| "binary"
			| "complex";
		multiValued: boolean;
		required: boolean;
		caseExact: boolean;
		mutability: "readOnly" | "readWrite" | "immutable" | "writeOnly";
		returned: "always" | "never" | "default" | "request";
		uniqueness: "none" | "server" | "global";
		description?: string;
		subAttributes?: Attribute[];
		canonicalValues?: string[];
		referenceTypes?: string[];
	}

	interface SchemaDefinition {
		id: string;
		name: string;
		description?: string;
		attributes: Attribute[];
	}

	/** Every definition an endpoint serves, by URN; filters, patches and projections read it. */
	interface Definitions {
		[urn: string]: SchemaDefinition;
	}
}

export const USER_DEFINITION: Discovery.SchemaDefinition; // RFC 7643 §8.7.1
export const GROUP_DEFINITION: Discovery.SchemaDefinition;
export const ENTERPRISE_USER_DEFINITION: Discovery.SchemaDefinition;

/** The same definition narrowed to named attributes, for advertising the subset an app maps. */
export function pickAttributes(
	definition: Discovery.SchemaDefinition,
	names: string[],
): Discovery.SchemaDefinition;

export function serviceProviderConfig(options: {
	patch: boolean;
	filter: { supported: boolean; maxResults: number };
	sort: boolean;
	etag: boolean;
	changePassword?: boolean;
	bulk?: { maxOperations: number; maxPayloadSize: number };
	authenticationSchemes: { type: string; name: string; description: string; specUri?: string }[];
	documentationUri?: string;
}): object;
export function resourceTypes(
	types: {
		id: string;
		endpoint: string;
		schema: string;
		extensions?: { schema: string; required: boolean }[];
	}[],
): object;
export function schemas(definitions: Discovery.SchemaDefinition[]): object;
```

The documents are plain objects so the app wraps them with `scimResponse` and chooses its own
caching. Since the same `Definitions` object drives `compileFilter`, `applyPatch`, `project` and
the `Schemas` endpoint, the advertised surface and the evaluated one come from one value.

### Usage

The tenant Worker keeps its controllers, now built from the package:

```ts
import { errorResponse, listResponse, parseListQuery, ScimError } from "@sdxc/scim";
import { createAction } from "remix/router";

list: createAction(routes.scimUsersList, {
	middleware: [gate],
	handler: async (ctx) => {
		let query = parseListQuery(ctx.url, { maxCount: 200, attributes: SCIM_DEFINITIONS });
		if (isFailure(query)) return errorResponse(query.error);

		let result = await ctx.tenantStub.scimReadUserPage({ token: ctx.scimToken, query: query.data });
		if (!result.ok) return scimFailure(result);
		return listResponse({ ...result, resources: result.representations }, userToScim);
	},
}),
```

Inside the tenant object, the user list keeps assembling representations (they span the
`subjects`, `subject_identifiers` and `scim_links` tables, so there is no single-table `WHERE`) and
filters them with the compiled predicate, restricted to the attributes ADR-029 serves:

```ts
import { compileFilter } from "@sdxc/scim/filter";

let matches = compileFilter(input.query.filter, {
	definitions: SCIM_DEFINITIONS,
	allow: ["userName", "externalId", "emails.value"],
});
if (isFailure(matches)) return { ok: false, reason: "unsupported-filter" };
```

Groups live in one table, so their list pushes the filter into the query:

```ts
import { filterToWhere } from "@sdxc/scim/data-table";

let where = filterToWhere(filter, {
	displayName: { column: "display_name", caseExact: false },
	externalId: "external_id",
});
let groups = await db.findMany(scimGroups, {
	where: isSuccess(where)
		? and(eq("connection_id", connection.id), where.data)
		: eq("connection_id", connection.id),
	orderBy: ["created_at", "asc"],
});
```

A user PATCH becomes read, apply, replace: the handler parses the operations (so the gate can
still recognize a pure `active: false` deactivation and skip the entitlement check), the tenant
object applies them to the current wire representation with `applyPatch`, and the result goes
through the same mapping and digest comparison `scimReplaceUser` already performs. The per-attribute
switch in `scimPatchUser` disappears. A group PATCH keeps interpreting operations one by one,
because a directory group can hold thousands of members and applying the whole member array would
rewrite every membership row to add one.

## Consequences

### Positive

- **The whole grammar, tested once** - filters and PATCH paths any conformant client sends parse
  correctly, and anything the app chooses not to serve is refused by an allowlist, not by a regex
  that happens not to match
- **Spec-correct comparisons** - `caseExact`, attribute-name case folding and type rules come from
  attribute definitions, fixing the case-sensitive `userName eq` auth-saas answers today
- **One source for the advertised surface** - the definitions served at `/Schemas` are the ones
  filters, patches and projections evaluate against
- **Simpler user PATCH** - read, apply, replace reuses the replace path and its digest no-op
- **Reusable on the client side** - a future outbound SCIM push (to a customer's own SCIM server)
  uses the same resource types, patch builder and error parser

### Negative

- **A larger surface than auth-saas needs** - `sortBy`, projection and value-path filters have no
  caller that ADR-029 serves today; they are written and tested for conformance, not for use
- **ADR-029's refusal table changes meaning** - accepting `and`, `co` and value paths on allowed
  attributes is a wider contract, and `/ServiceProviderConfig` must keep describing it truthfully
- **`filterToWhere` is partial** - negation and value paths fall back to in-memory evaluation,
  which a caller must remember to write

### Neutral

- **No router factory** - the app keeps mapping routes; see Alternatives
- **Case-insensitive `like` on SQLite** - `ilike` is what `remix/data-table` offers; its exact
  behavior on `@sdxc/data-table-sqlstorage` is settled by that adapter's tests
- **`etag` stays unsupported in auth-saas** - the package makes `meta.version` and `If-Match`
  available; turning them on is a separate auth-saas decision

## Implementation Plan

### Phase 1: Specify and build the package

**Priority:** High
**Estimated Effort:** 2 days

1. Write the tests first from the RFCs' own examples: every filter in RFC 7644 §3.4.2.2, the PATCH
   examples in §3.5.2, the resource examples in RFC 7643 §8, and the error table in §3.12
2. Build `parseFilter`/`parsePath`/`compileFilter`, then `parsePatch`/`applyPatch` on the shared path
   parser, then `filterToWhere`, resources, list queries, responses and discovery
3. Add captured request bodies from Okta and Entra ID as fixtures, taken from auth-saas's existing
   controller tests
4. Write the README and add the row to the root README package table

### Phase 2: Migrate auth-saas

**Priority:** High
**Estimated Effort:** 1 day

| Call site                                     | Change                                                                                                                                                                    |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/http/scim/response.ts`                   | delete URNs, `scimJson`, `scimError`, `scimListResponse`; keep `scimFailure`, `userToScim`, `groupToScim` building on `userResource`/`groupResource`, now stamping `meta` |
| `app/http/scim/request.ts`                    | delete; bodies go through `parseUser` (with the app's Enterprise schema) and `parseGroup`, PATCH through `parsePatch`, list through `parseListQuery`                      |
| `app/http/controllers/scim/discovery.ts`      | build the three documents with `serviceProviderConfig`, `resourceTypes`, `schemas(pickAttributes(...))` from one `SCIM_DEFINITIONS` module                                |
| `app/http/controllers/scim/{users,groups}.ts` | swap imports; the pure-deactivation check reads `Patch.Operation` paths                                                                                                   |
| `app/http/controllers/scim/unsupported.ts`    | `errorResponse(new ScimError(501, ...))`                                                                                                                                  |
| `app/http/middleware/scim-gate.ts`            | `errorResponse` for its `401`/`403`/`429`; the gate itself stays                                                                                                          |
| `database/scim.ts`                            | delete `parseEqFilter` and both slicing blocks; list methods take a `Scim.ListQuery`; `scimPatchUser` applies then replaces; `scimReadGroupPage` uses `filterToWhere`     |

Keep the existing controller and database tests passing, adding cases for case-insensitive
`userName eq`, a path-less PATCH, and a negative `count`.

### Phase 3: Update ADR-029 and publish

**Priority:** Medium
**Estimated Effort:** 1 hour

1. Revise auth-saas ADR-029's refusal table to describe the allowlisted full grammar
2. Remove `private: true`, add `description` and `LICENSE.md`, `bun run release:bootstrap @sdxc/scim`

## Alternatives Considered

### 1. A `createScimRouter` taking a storage adapter

The package would own the routes and call an adapter (`createUser`, `replaceUser`, `patchUser`,
`listUsers`, ...) for storage.

**Rejected because**: auth-saas resolves the bearer token inside the tenant object in the same turn
as the write, admits a pure deactivation without the entitlement, and crosses an RPC boundary for
every call; the adapter would end up mirroring the object's RPC methods one-for-one, plus hooks
for each exception. With one consumer, a factory fixes the wrong seams. Revisit when a second app
serves SCIM.

### 2. Keep the observed subset in the app

**Rejected because**: the subset already diverges from the RFCs (case folding, clamping, path-less
PATCH), and each provider added later brings its own slice of the grammar, one regex at a time.

### 3. An npm library (`scim2-parse-filter`, `scimgateway`, `scim-patch`)

**Rejected because**: none returns `Result`, validates with `remix/data-schema`, or translates to
`remix/data-table`; the gateway-style ones own the HTTP server, and the parsers split filter and
PATCH-path grammars that the RFC defines together.

## Current Progress

- [x] Phase 1: `@sdxc/scim` built with its five subpaths, tested against every RFC 7644
      §3.4.2.2 filter and §3.5.2 PATCH example, the RFC 7643 §8 resources, and Okta and Entra
      ID request shapes
- [x] Phase 2: migrate auth-saas — definitions, resource shapes and wire form in
      `database/scim-resources.ts`; `request.ts` deleted; user PATCH as read, apply, replace; group
      list through `filterToWhere` with the in-memory fallback; group PATCH op by op
- [ ] Phase 3: update auth-saas ADR-029 and publish — ADR-029 revised; publishing is pending

## References

- [RFC 7643 - SCIM: Core Schema](https://www.rfc-editor.org/rfc/rfc7643)
- [RFC 7644 - SCIM: Protocol](https://www.rfc-editor.org/rfc/rfc7644)
- [auth-saas ADR-029: SCIM Provisioning](./auth-saas/ADR-029-scim-provisioning.md)
- [ADR-057: Request Context Instead of a Service Container](./ADR-057-request-context-instead-of-a-service-container.md)
- [ADR-077: Problem Details Package](./ADR-077-problem-details-package.md)
- [ADR-007: Publishable Package Releases](./ADR-007-publishable-package-releases.md)

## Notes

- `@sdxc/http`'s `precondition` compares `If-Match` strongly, so a weak tag never matches; SCIM's
  own examples send weak tags on `If-Match`, which is why `matchesVersion` lives here
- The `"True"`/`"False"` string coercion exists for Entra ID's PATCH values; it only applies where
  the attribute definition says `boolean`
- Implementation: `filterToWhere` refuses (with `UntranslatableFilterError`) a value containing
  `%`, `_` or `\` rather than escaping it, because `remix/data-table`'s `like`/`ilike` compile
  without an `ESCAPE` clause and SQLite has no default escape character. `eq` on a
  `caseExact: false` column becomes `ilike` with the literal value, while `ne` and ordering on such
  a column are untranslatable. `ne` translates to `ne OR IS NULL`, since SCIM's `ne` holds for an
  unassigned attribute. `not` is pushed down through `and`/`or` by De Morgan's laws, which
  translates more than the direct inverses the Decision lists
- Implementation: `id`, `externalId`, `schemas` and `meta` resolve for every resource as built-in
  common attributes, so RFC 7644's own `meta.lastModified gt …` and `schemas eq …` examples
  evaluate although RFC 7643 §8.7.1's `/Schemas` documents omit them
- Implementation: `applyPatch` also reads the provider shapes RFC 7644 leaves open: an `add`
  through an `eq` value filter that matches nothing appends the value it describes (Entra ID's
  `emails[type eq "work"].value`), a `remove` of a multi-valued attribute with a value list removes
  the listed items (Entra ID's group members), a bare value written to a complex attribute with a
  `value` sub-attribute reads as `{ value }` (Entra ID's `manager`), a path-less value's URN keys
  and dotted keys apply at their paths, a read-only attribute written back unchanged is accepted,
  and a newly written `primary: true` clears `primary` on the attribute's other values
- Implementation: the types gained `Patch.Path` (the operation path), `Scim.Member` and
  `Scim.GroupMembership` (so group references keep their `$ref` as `ref`), and
  `Discovery.ServiceProviderConfigOptions`/`ResourceType`; `ExtensionSchemas` takes any
  synchronous Standard Schema; `listResponse` and `errorResponse` take an optional `ResponseInit`
- Implementation: `matchesVersion` answers whether the request's `If-Match` and `If-None-Match`
  both let it proceed; the caller answers `412`, or `304` for a read failing `If-None-Match`.
  `readBody` also accepts a body with no `Content-Type` and answers `415` for other types
- Implementation: `GROUP_DEFINITION` marks `displayName` required, following RFC 7643 §4.2's
  text over the §8.7.1 schema listing. The RFC 7644 §3.4.2.2 text example
  `(meta.resourceType eq User) or …` has unquoted values the ABNF rejects, and `parseFilter`
  refuses it
- Implementation: auth-saas's controller tests hold no captured provider traffic, so the Okta and
  Entra ID fixtures follow the providers' documented request shapes. `@sdxc/problem` stays
  declared in `package.json` but unused, since the SCIM error document is independent of RFC 9457
