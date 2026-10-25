# @sdxc/scim

SCIM 2.0 resources, filters, PATCH operations, cursor pagination, discovery documents and events.

SCIM 2.0 is how an enterprise directory (Okta, Microsoft Entra ID, Google Workspace) pushes
people and groups into a service; [RFC 7643](https://www.rfc-editor.org/rfc/rfc7643) defines the
resources and [RFC 7644](https://www.rfc-editor.org/rfc/rfc7644) the protocol, which
[RFC 9865](https://www.rfc-editor.org/rfc/rfc9865) extends with cursors and
[RFC 9967](https://www.rfc-editor.org/rfc/rfc9967) with events. This package is the
standard's half of a SCIM endpoint: typed Users and Groups, the filter grammar, PATCH, list
queries, attribute projection, errors, discovery and signed events. Routing, authentication,
storage and event delivery stay yours.

## Installation

```sh
npm add @sdxc/scim
```

Fallible calls return a `Result` from [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result),
`@sdxc/scim/data-table` builds predicates for `remix/data-table` from
[`remix`](https://www.npmjs.com/package/remix), and `@sdxc/scim/events` signs tokens with
[`@sdxc/jwt`](https://www.npmjs.com/package/@sdxc/jwt).

## Usage

### Read a User and answer

Every failure is a `ScimError`; `errorResponse` turns it into the RFC 7644 error document.

```typescript
import { isFailure } from "@sdxc/result";
import {
	errorResponse,
	parseUser,
	readBody,
	ScimError,
	scimResponse,
	userResource,
} from "@sdxc/scim";

let body = await readBody(request);
if (isFailure(body)) return errorResponse(body.error);

let user = parseUser(body.data);
if (isFailure(user)) return errorResponse(user.error);

user.data.userName; // "bjensen@example.com"
user.data.extensions.enterprise?.department; // the typed Enterprise User extension

if (await findUserByUserName(user.data.userName)) {
	let taken = new ScimError(409, "userName is taken.", { scimType: "uniqueness" });
	return errorResponse(taken);
}

let stored = await saveUser(user.data);
return scimResponse(userResource(stored), { status: 201 });
```

### Describe the attributes you serve

One `Discovery.Definitions` value drives filters, PATCH, projection and `/Schemas`, so what a
client is told and what the server does agree. Put the core schema first: unqualified names
resolve in insertion order.

```typescript
import { ENTERPRISE_USER_SCHEMA, USER_SCHEMA } from "@sdxc/scim";
import type { Discovery } from "@sdxc/scim/discovery";
import { ENTERPRISE_USER_DEFINITION, pickAttributes, USER_DEFINITION } from "@sdxc/scim/discovery";

export const DEFINITIONS: Discovery.Definitions = {
	[USER_SCHEMA]: pickAttributes(USER_DEFINITION, ["userName", "name", "emails", "active"]),
	[ENTERPRISE_USER_SCHEMA]: ENTERPRISE_USER_DEFINITION,
};
```

### List Users with a filter

```typescript
import { isFailure } from "@sdxc/result";
import { errorResponse, listResponse, parseListQuery, project, userResource } from "@sdxc/scim";
import { compileFilter } from "@sdxc/scim/filter";

let query = parseListQuery(new URL(request.url), { maxCount: 200, attributes: DEFINITIONS });
if (isFailure(query)) return errorResponse(query.error);

let resources = (await loadUsers()).map((user) => userResource(user));

if (query.data.filter) {
	let matches = compileFilter(query.data.filter, {
		definitions: DEFINITIONS,
		allow: ["userName", "emails.value"],
	});
	if (isFailure(matches)) return errorResponse(matches.error);
	resources = resources.filter(matches.data);
}

let start = query.data.startIndex - 1;
return listResponse(
	{
		resources: resources.slice(start, start + query.data.count),
		totalResults: resources.length,
		startIndex: query.data.startIndex,
	},
	(resource) => project(resource, query.data, DEFINITIONS),
);
```

`userName eq "BJensen@Example.com"` matches `bjensen@example.com`, because `userName` is
`caseExact: false` in the definition; `allow` refuses filters on any other attribute. For
`POST /Users/.search`, read the same query from the body with `parseSearchRequest(body.data)`.

### Patch a User

Apply the operations to the current wire representation, then store the result the way a `PUT`
would.

```typescript
import { isFailure } from "@sdxc/result";
import { errorResponse, parseUser, readBody, scimResponse, userResource } from "@sdxc/scim";
import { applyPatch, parsePatch } from "@sdxc/scim/patch";

let body = await readBody(request);
if (isFailure(body)) return errorResponse(body.error);

let operations = parsePatch(body.data);
if (isFailure(operations)) return errorResponse(operations.error);

let patched = applyPatch(userResource(await loadUser(id)), operations.data, {
	definitions: DEFINITIONS,
});
if (isFailure(patched)) return errorResponse(patched.error); // noTarget, mutability, invalidPath

let next = parseUser(patched.data);
if (isFailure(next)) return errorResponse(next.error);
return scimResponse(userResource(await replaceUser(id, next.data)));
```

### Page with cursors

With `cursor: true`, `parseListQuery` reads RFC 9865's `cursor`: `null` pages by `startIndex`,
`""` asks for the first cursor page. A cursor page answers `nextCursor` until its last page.

```typescript
let query = parseListQuery(url, { maxCount: 200, cursor: true });
if (isFailure(query)) return errorResponse(query.error);

if (query.data.cursor !== null) {
	let page = await store.after(query.data.cursor, query.data.count);
	if (!page)
		return errorResponse(new ScimError(400, "Unknown cursor.", { scimType: "invalidCursor" }));
	return listResponse({ resources: page.users, totalResults, nextCursor: page.next }, toWire);
}
```

### Publish an event

`createScimEvent` builds an RFC 9967 Security Event Token typed `secevent+jwt`. Deliver it by
RFC 8935 push or RFC 8936 poll with `@sdxc/webhooks/security-events`.

```typescript
import { JWK } from "@sdxc/jwt";
import { createScimEvent, scimEvents } from "@sdxc/scim/events";

let signed = await createScimEvent({
	issuer: "https://scim.example.com",
	audience: "https://receiver.example.com/events",
	subject: { uri: `/Users/${user.id}`, externalId: user.externalId },
	events: [scimEvents.patch({ attributes: ["active"] }), scimEvents.deactivate()],
}).sign(JWK.Algorithm.ES256, keys);
```

### Serve discovery

```typescript
import { ENTERPRISE_USER_SCHEMA, GROUP_SCHEMA, scimResponse, USER_SCHEMA } from "@sdxc/scim";
import {
	GROUP_DEFINITION,
	resourceTypes,
	schemas,
	serviceProviderConfig,
} from "@sdxc/scim/discovery";

scimResponse(
	serviceProviderConfig({
		patch: true,
		filter: { supported: true, maxResults: 200 },
		sort: false,
		etag: true,
		authenticationSchemes: [
			{ type: "oauthbearertoken", name: "Bearer Token", description: "A per-connection token." },
		],
	}),
);

scimResponse(
	resourceTypes([
		{
			id: "User",
			endpoint: "/Users",
			schema: USER_SCHEMA,
			extensions: [{ schema: ENTERPRISE_USER_SCHEMA, required: false }],
		},
		{ id: "Group", endpoint: "/Groups", schema: GROUP_SCHEMA },
	]),
);

scimResponse(schemas([...Object.values(DEFINITIONS), GROUP_DEFINITION]));
```

## API

### `@sdxc/scim`

#### Constants

`MEDIA_TYPE` (`application/scim+json`), and the schema URNs `USER_SCHEMA`, `GROUP_SCHEMA`,
`ENTERPRISE_USER_SCHEMA`, `LIST_RESPONSE_SCHEMA`, `PATCH_OP_SCHEMA`, `SEARCH_REQUEST_SCHEMA` and
`ERROR_SCHEMA`.

#### `new ScimError(status: number, detail: string, options?: ScimErrorOptions)`

The error every call fails with: `status` is the HTTP status, `message` the detail, and
`scimType` an RFC 7644 detail code (`invalidFilter`, `uniqueness`, `mutability`, …) or `null`.

#### `parseUser(body: unknown, options?: ParseUserOptions): Result<Scim.User, ScimError>`

Reads a User, matching attribute names in any case and reading `null` as unassigned. Each
extension is read from its URN member and validated with a Standard Schema; `options.extensions`
(`{ key: { urn, schema } }`) replaces the default, which reads the Enterprise User extension under
`enterprise`.

#### `parseGroup(body: unknown): Result<Scim.Group, ScimError>`

Reads a Group; a member's `$ref` becomes `ref`.

#### `userResource(user: Scim.User, options?: ResourceOptions): object`

The wire object: `schemas` filled from the extensions present, extensions under their URNs,
`ref` written `$ref`, dates as RFC 3339, `password` and empty members dropped. Pass the same
`extensions` as `parseUser` to name each custom extension's URN.

#### `groupResource(group: Scim.Group): object`

The Group's wire object, with the same rules as `userResource`.

#### `readBody(request: Request): Promise<Result<unknown, ScimError>>`

Reads a JSON body sent as `application/scim+json`, `application/json` or with no `Content-Type`;
another type fails `415`, and invalid JSON `400 invalidSyntax`.

#### `parseListQuery(url: URL, options?: ListQueryOptions): Result<Scim.ListQuery, ScimError>`

Reads `filter`, `startIndex`, `count`, `sortBy`, `sortOrder`, `attributes` and
`excludedAttributes` from the query string. `count` defaults to `options.defaultCount` (100) and
is capped at `options.maxCount`; with `options.attributes`, every path must resolve against those
definitions. `options.cursor` reads `cursor` too, and `options.defaultPagination: "cursor"` pages
a request naming neither by cursor; a cursor outside RFC 3986's unreserved set fails
`invalidCursor`.

#### `parseSearchRequest(body: unknown, options?: ListQueryOptions): Result<Scim.ListQuery, ScimError>`

The same query read from a `POST /.search` body.

#### `scimResponse(body: object, init?: ResponseInit): Response`

A JSON `Response` typed `application/scim+json`.

#### `errorResponse(error: ScimError, init?: ResponseInit): Response`

The RFC 7644 error document, answered with the error's status.

#### `listResponse(page: Scim.Page, toResource: (resource) => object, init?: ResponseInit): Response`

A `ListResponse` of the page's resources mapped through `toResource`, with `itemsPerPage` set to
the page length. An index page writes `startIndex`; a cursor page writes `nextCursor` and
`previousCursor` when set.

#### `project(resource: object, query: Scim.ListQuery, definitions: Discovery.Definitions): object`

Keeps the members a response carries, applying each attribute's `returned` and the query's
`attributes` or `excludedAttributes`, down to sub-attributes and whole extensions.

#### `version(resource: object): Promise<string>`

A weak entity tag (`W/"…"`) over the resource's content, independent of key order and of `meta`,
so storing it in `meta.version` leaves it unchanged.

#### `matchesVersion(request: Request, current: string): boolean`

Whether the request's `If-Match` and `If-None-Match` let it proceed against the current tag,
compared weakly. Answer `false` with `412`, or with `304` on a read that sent `If-None-Match`.

### `@sdxc/scim/filter`

#### `parseFilter(text: string): Result<Filter.Expression, ScimError>`

Parses the full RFC 7644 filter grammar: every operator, `and`/`or`/`not`, grouping, value paths
(`emails[type eq "work"]`) and schema-qualified paths. Errors are `400 invalidFilter` with the
position.

#### `parsePath(text: string): Result<Filter.AttributePath, ScimError>`

Parses an attribute path such as `name.givenName`; a bad one fails `400 invalidPath`.

#### `stringifyFilter(expression: Filter.Expression): string` / `stringifyPath(path: Filter.AttributePath): string`

Write a tree back to text that parses to the same tree.

#### `compileFilter(expression: Filter.Expression, options: Filter.CompileOptions): Result<(resource: object) => boolean, ScimError>`

A predicate over wire resources, evaluated with the types and `caseExact` of
`options.definitions`. A multi-valued attribute matches when any value does. A type mismatch,
an unknown path, or a path outside `options.allow` fails `invalidFilter` at compile time.

### `@sdxc/scim/data-table`

#### `filterToWhere(expression: Filter.Expression, columns: ColumnMap): Result<Predicate, ScimError | UntranslatableFilterError>`

A `remix/data-table` predicate selecting the rows the filter matches. `columns` maps each
filterable path to a column name, compared case-sensitively, or to
`{ column, caseExact: false }`, compared through `ilike`.

#### `UntranslatableFilterError`

The failure for a filter SQL cannot express exactly: value paths, unmapped paths, negated
substring matches, case-folded ordering, and values holding `%`, `_` or `\`. Evaluate that filter
in memory with `compileFilter`.

### `@sdxc/scim/patch`

#### `parsePatch(body: unknown): Result<Patch.Operation[], ScimError>`

Reads a `PatchOp` body, `op` in any case.

#### `applyPatch(resource: object, operations: Patch.Operation[], options: Patch.ApplyOptions): Result<object, ScimError>`

Applies the operations to a copy, all or none, following RFC 7644 §3.5.2. Writes to a read-only
attribute, or to an `immutable` one that has a value, fail `mutability`; a filter matching
nothing fails `noTarget`.

### `@sdxc/scim/discovery`

#### `USER_DEFINITION`, `GROUP_DEFINITION`, `ENTERPRISE_USER_DEFINITION`

The RFC 7643 schema definitions.

#### `pickAttributes(definition: Discovery.SchemaDefinition, names: string[]): Discovery.SchemaDefinition`

The definition narrowed to the named attributes and sub-attributes (`emails.value`).

#### `serviceProviderConfig(options: Discovery.ServiceProviderConfigOptions)`, `resourceTypes(types: Discovery.ResourceType[])`, `schemas(definitions: Discovery.SchemaDefinition[])`

The `/ServiceProviderConfig`, `/ResourceTypes` and `/Schemas` documents, ready for
`scimResponse`. `pagination` (RFC 9865) and `securityEvents` (RFC 9967) appear when given.

### `@sdxc/scim/events`

#### `createScimEvent(input: Events.TokenInput): ScimEventToken`

An unsigned token with a fresh `jti`, `iat` now, the subject as a `scim` `sub_id`, the events,
and `txn` when given.

#### `scimEvents`

One builder per RFC 9967 event: `feedAdd`, `feedRemove`, `create`, `patch`, `put` (`full` with
`data`, `notice` with `attributes`), `delete`, `activate`, `deactivate` and `asyncResponse`.
`EVENT_URIS` names each URI.

#### `ScimEventToken`

A `SecurityEventToken` from `@sdxc/jwt` whose `subjectId` reads the `scim` `sub_id` format;
`ScimEventToken.verify` refuses a token of any other type and holds it to RFC 8417's claims.

#### `prefersAsync(request: Request): boolean`, `acceptedResponse(options): Response`

Reads `Prefer: respond-async`, and answers the empty `202` with `Set-Txn` (`SET_TXN_HEADER`).

### Types

#### `Scim`

The resource model: `Scim.User<Extensions>`, `Scim.Group`, `Scim.Member`, `Scim.Name`,
`Scim.Address`, `Scim.EnterpriseUser`, `Scim.GroupMembership`, `Scim.MultiValued`, `Scim.Meta`,
plus `Scim.ListQuery`, `Scim.Page` (`Scim.IndexPage` or `Scim.CursorPage`) and `Scim.ErrorType`.

#### `Filter`

The tree `parseFilter` returns: `Filter.Expression` is a `Compare`, `Present`, `Logical`, `Not` or
`ValuePath` over `Filter.AttributePath`, `Filter.Operator` and `Filter.Value`;
`Filter.CompileOptions` types `compileFilter`'s options.

#### `Patch`

`Patch.Operation`, `Patch.Path` and `Patch.ApplyOptions`.

#### `Discovery`

`Discovery.Definitions`, `Discovery.SchemaDefinition`, `Discovery.Attribute`,
`Discovery.ServiceProviderConfigOptions`, `Discovery.AuthenticationScheme`,
`Discovery.Pagination`, `Discovery.SecurityEvents` and `Discovery.ResourceType`.

#### `Events`

`Events.TokenInput`, `Events.Subject`, `Events.SubjectId`, `Events.Event`, `Events.Change` and
`Events.Completion`.

#### Options and extensions

`ScimErrorOptions`, `ListQueryOptions`, `ParseUserOptions`, `ResourceOptions` and `ColumnMap` type
the options above; `ExtensionSchemas` types an extensions map and `InferExtensions` the parsed
`extensions` it produces.

## Pattern: Push A Filter Into SQL, Fall Back In Memory

Translate what SQL can answer exactly, and evaluate the rest over the loaded rows.

```typescript
import { isFailure, isSuccess } from "@sdxc/result";
import { errorResponse, groupResource, parseListQuery } from "@sdxc/scim";
import { filterToWhere } from "@sdxc/scim/data-table";
import { compileFilter } from "@sdxc/scim/filter";
import { and, eq } from "remix/data-table";

let query = parseListQuery(new URL(request.url), { attributes: DEFINITIONS });
if (isFailure(query)) return errorResponse(query.error);
let filter = query.data.filter;

let where = filter
	? filterToWhere(filter, {
			displayName: { column: "display_name", caseExact: false },
			externalId: "external_id",
		})
	: null;

let rows = await db.findMany(groups, {
	where:
		where && isSuccess(where)
			? and(eq("tenant_id", tenantId), where.data)
			: eq("tenant_id", tenantId),
});
let resources = rows.map((row) => groupResource(toGroup(row)));

if (filter && where && isFailure(where)) {
	let matches = compileFilter(filter, { definitions: DEFINITIONS });
	if (isFailure(matches)) return errorResponse(matches.error);
	resources = resources.filter(matches.data);
}
```

## Pattern: Conditional Writes With Entity Tags

Stamp each response with its version, and refuse a write whose `If-Match` is stale.

```typescript
import {
	errorResponse,
	matchesVersion,
	ScimError,
	scimResponse,
	userResource,
	version,
} from "@sdxc/scim";

let current = userResource(await loadUser(id));
if (!matchesVersion(request, await version(current))) {
	return errorResponse(new ScimError(412, "The resource changed since it was read."));
}

let next = userResource(await replaceUser(id, user));
let tag = await version(next);
return scimResponse({ ...next, meta: { ...next.meta, version: tag } }, { headers: { ETag: tag } });
```

On a `GET` that sent `If-None-Match`, the same `false` answers `304 Not Modified`.

## Pattern: A Custom Schema Extension

Give `parseUser` and `userResource` the same extensions map, and add the extension's definition so
filters, PATCH and `/Schemas` know its attributes. The map replaces the default, so list
`enterprise` in it too when you also accept the Enterprise User extension.

```typescript
import { isFailure } from "@sdxc/result";
import { errorResponse, parseUser, scimResponse, USER_SCHEMA, userResource } from "@sdxc/scim";
import type { Discovery } from "@sdxc/scim/discovery";
import { USER_DEFINITION } from "@sdxc/scim/discovery";
import * as s from "remix/data-schema";

let BADGE_URN = "urn:example:params:scim:schemas:extension:badge:2.0:User";

let extensions = {
	badge: { urn: BADGE_URN, schema: s.object({ number: s.string() }) },
};

let definitions: Discovery.Definitions = {
	[USER_SCHEMA]: USER_DEFINITION,
	[BADGE_URN]: {
		id: BADGE_URN,
		name: "Badge",
		attributes: [
			{
				name: "number",
				type: "string",
				multiValued: false,
				required: true,
				caseExact: true,
				mutability: "readWrite",
				returned: "default",
				uniqueness: "server",
			},
		],
	},
};

let user = parseUser(body, { extensions });
if (isFailure(user)) return errorResponse(user.error); // 400 invalidValue names the bad member

user.data.extensions.badge?.number; // string | undefined
return scimResponse(userResource(user.data, { extensions }));
```

`definitions` then feeds `compileFilter`, `applyPatch`, `project` and `schemas`, so a client can
filter on `urn:example:params:scim:schemas:extension:badge:2.0:User:number`.

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
		"@sdxc/scim": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
