# @sdxc/scim

SCIM 2.0 resources, filters, PATCH operations and discovery documents.

## Installation

```bash
npm add @sdxc/scim
```

Every fallible call returns an [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result)
value, and `@sdxc/scim/data-table` translates filters into
[`remix`](https://www.npmjs.com/package/remix)'s `remix/data-table` predicates. Both install
alongside this package.

SCIM 2.0 is how an enterprise directory (Okta, Microsoft Entra ID, Google Workspace) pushes
people and groups into a service. [RFC 7643](https://www.rfc-editor.org/rfc/rfc7643) defines
the resources and [RFC 7644](https://www.rfc-editor.org/rfc/rfc7644) the protocol. This package
holds the standard's half of a SCIM endpoint: the User, Group and Enterprise User types, the
complete filter grammar, PATCH, list queries and `ListResponse`, attribute projection, the SCIM
error document and the discovery documents. Routing, authentication and storage stay yours.

Every failure is a `ScimError`, which `errorResponse` turns into the RFC 7644 §3.12 document.
One `Discovery.Definitions` value describes the attributes an endpoint serves: `/Schemas`
advertises it, and filters, PATCH and projection evaluate against it, so what a client is told
and what the server does agree.

## Usage

### Create A User

```typescript
import { errorResponse, parseUser, readBody, scimResponse, userResource } from "@sdxc/scim";
import { isFailure } from "@sdxc/result";

let body = await readBody(request);
if (isFailure(body)) return errorResponse(body.error);

let user = parseUser(body.data);
if (isFailure(user)) return errorResponse(user.error); // 400 invalidValue

user.data.userName; // "bjensen@example.com"
user.data.extensions.enterprise?.department; // typed Enterprise User extension

let stored = await saveUser(user.data);
return scimResponse(userResource(stored), { status: 201 });
```

### List Users With A Filter

```typescript
import { errorResponse, listResponse, parseListQuery, project } from "@sdxc/scim";
import { compileFilter } from "@sdxc/scim/filter";
import { isFailure } from "@sdxc/result";

let query = parseListQuery(new URL(request.url), { maxCount: 200, attributes: DEFINITIONS });
if (isFailure(query)) return errorResponse(query.error);

let matches = query.data.filter
	? compileFilter(query.data.filter, {
			definitions: DEFINITIONS,
			allow: ["userName", "emails.value"],
		})
	: null;
if (matches && isFailure(matches)) return errorResponse(matches.error);

let all = (await loadUsers()).map((user) => userResource(user));
let found = matches ? all.filter(matches.data) : all;
let start = query.data.startIndex - 1;

return listResponse(
	{
		resources: found.slice(start, start + query.data.count),
		totalResults: found.length,
		startIndex: query.data.startIndex,
	},
	(resource) => project(resource, query.data, DEFINITIONS),
);
```

`userName eq "BJensen@Example.com"` matches `bjensen@example.com`, because the definition says
`userName` is `caseExact: false`.

### Patch A User

```typescript
import { isFailure } from "@sdxc/result";
import { errorResponse, parseUser, userResource } from "@sdxc/scim";
import { applyPatch, parsePatch } from "@sdxc/scim/patch";

let operations = parsePatch(body.data);
if (isFailure(operations)) return errorResponse(operations.error);

let patched = applyPatch(userResource(current), operations.data, { definitions: DEFINITIONS });
if (isFailure(patched)) return errorResponse(patched.error); // noTarget, mutability, invalidPath

let next = parseUser(patched.data); // then store it the way a PUT would
```

### Serve Discovery

```typescript
import { ENTERPRISE_USER_SCHEMA, GROUP_SCHEMA, scimResponse, USER_SCHEMA } from "@sdxc/scim";
import {
	ENTERPRISE_USER_DEFINITION,
	GROUP_DEFINITION,
	pickAttributes,
	resourceTypes,
	schemas,
	serviceProviderConfig,
	USER_DEFINITION,
} from "@sdxc/scim/discovery";

export const DEFINITIONS = {
	[USER_SCHEMA]: pickAttributes(USER_DEFINITION, ["userName", "name", "emails", "active"]),
	[ENTERPRISE_USER_SCHEMA]: ENTERPRISE_USER_DEFINITION,
};

scimResponse(
	serviceProviderConfig({
		patch: true,
		filter: { supported: true, maxResults: 200 },
		sort: false,
		etag: false,
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

`MEDIA_TYPE` (`application/scim+json`), `USER_SCHEMA`, `GROUP_SCHEMA`, `ENTERPRISE_USER_SCHEMA`,
`LIST_RESPONSE_SCHEMA`, `PATCH_OP_SCHEMA`, `SEARCH_REQUEST_SCHEMA` and `ERROR_SCHEMA`.

#### `ScimError`

`new ScimError(status, detail, { scimType? })`. `status` is the HTTP status, `scimType` one of
RFC 7644 Table 9's codes (`invalidFilter`, `invalidPath`, `noTarget`, `mutability`,
`uniqueness`, `invalidValue`, `invalidSyntax`, `tooMany`, `invalidVers`, `sensitive`) or `null`,
and `message` the `detail`. `ScimErrorOptions` types the options.

#### `parseUser(body, options?): Result<Scim.User, ScimError>`

Reads a User. Attribute names match case-insensitively, `null` members count as unassigned, and
each extension is read from its URN member and validated with its schema. Pass
`options.extensions` as `{ key: { urn, schema } }` with any synchronous Standard Schema; the
result's `extensions.key` is typed from the schema (`ParseUserOptions`, `ExtensionSchemas`,
`InferExtensions`). The Enterprise User extension is read under
`enterprise` by default. A complete `meta` is read with `Date`s; an incomplete one is dropped.

#### `parseGroup(body): Result<Scim.Group, ScimError>`

Reads a Group; member `$ref` becomes `ref`, and member `type` matches `User`/`Group` in any case.

#### `userResource(user, options?)` / `groupResource(group)`

The wire objects: `schemas` filled from the extensions present, extensions under their URNs,
`ref` written `$ref`, dates as RFC 3339, and unassigned members (empty arrays included)
dropped. `password` is left out. Pass `options.extensions` (`ResourceOptions`) to name the
URN of each custom extension key.

#### `version(resource): Promise<string>`

A weak entity tag (`W/"…"`) over a key-order-independent serialization of the resource,
leaving `meta` out so stamping the version into `meta.version` keeps it stable.

#### `matchesVersion(request, current): boolean`

Whether `If-Match` and `If-None-Match` let the request proceed, comparing tags weakly as
RFC 7644 §3.14's examples require. Answer `412` for a failed write and `304` for a read that
fails `If-None-Match`.

#### `readBody(request): Promise<Result<unknown, ScimError>>`

Reads a JSON body sent as `application/scim+json`, `application/json` or with no
`Content-Type`. Another type is `415`, invalid JSON is `400 invalidSyntax`.

#### `parseListQuery(url, options?)` / `parseSearchRequest(body, options?)`

Read a list request from the query string or a `POST /.search` body into a `Scim.ListQuery`.
`startIndex` below 1 reads as 1, `count` below 0 as 0 and above `maxCount` as `maxCount`, and a
missing `count` is `defaultCount` (100). With `options.attributes`, the filter and every path
must resolve against those definitions. `ListQueryOptions` types the options.

#### `scimResponse(body, init?)`, `errorResponse(error, init?)`, `listResponse(page, toResource, init?)`

`Response` builders typed `application/scim+json`. `errorResponse` writes `status` as a string
and leaves `scimType` out when the error has none; `listResponse` sets `itemsPerPage` to the
page length.

#### `project(resource, query, definitions)`

Applies `returned` (`always`, `never`, `default`, `request`) and the query's `attributes` or
`excludedAttributes`, including sub-attributes (`name.givenName`) and whole extensions (the URN).

#### `Scim` (types)

The resource model: `Scim.User<Extensions>`, `Scim.Group`, `Scim.Member`, `Scim.Name`,
`Scim.Address`, `Scim.EnterpriseUser`, `Scim.GroupMembership`, `Scim.MultiValued`, `Scim.Meta`,
plus `Scim.ListQuery`, `Scim.Page` and `Scim.ErrorType`.

### `@sdxc/scim/filter`

#### `parseFilter(text): Result<Filter.Expression, ScimError>`

Parses anything the RFC 7644 §3.4.2.2 ABNF accepts: `eq ne co sw ew gt ge lt le pr`, `and`,
`or`, `not (…)`, grouping, value paths (`emails[type eq "work"]`) and fully qualified paths.
Keywords match in any case; precedence is `not` > `and` > `or`. Errors are
`400 invalidFilter` with the position.

#### `parsePath(text)`, `stringifyFilter(expression)`, `stringifyPath(path)`

Attribute notation parsing (`400 invalidPath`), and writing trees back to text that parses to
the same tree.

#### `compileFilter(expression, { definitions, allow? })`

A predicate over wire resources. String comparisons fold case unless `caseExact`, date-times
compare as instants, a multi-valued attribute matches when any value does, and `emails co "x"`
reads `emails.value`. Ordering a boolean or binary, a type mismatch, an undefined path, or a
path outside `allow` fails `invalidFilter` at compile time. `Filter.CompileOptions` types the
options.

#### `Filter` (types)

The tree `parseFilter` returns: `Filter.Expression` is a `Compare`, `Present`, `Logical`, `Not`
or `ValuePath`, over `Filter.AttributePath`, `Filter.Operator` and `Filter.Value`.

### `@sdxc/scim/data-table`

#### `filterToWhere(expression, columns): Result<Predicate, ScimError | UntranslatableFilterError>`

Translates a filter into a `remix/data-table` predicate selecting the same rows. `columns`
maps paths to a column name (case-sensitive) or `{ column, caseExact: false }`, which folds
case through `ilike`. `ne` also matches `NULL`, and `not` is pushed down to inverse operators.
Value paths, unmapped paths, negated substring matches, case-folded ordering or `ne`, and
values containing `%`, `_` or `\` fail with `UntranslatableFilterError`, the signal to evaluate
that filter in memory with `compileFilter`. `ColumnMap` types `columns`. SQLite folds ASCII case
in `like`, so a `co`/`sw`/`ew` on a `caseExact` column can return extra rows there; confirm with
`compileFilter` when it matters.

### `@sdxc/scim/patch`

#### `parsePatch(body): Result<Patch.Operation[], ScimError>`

Checks the `PatchOp` schema and reads each operation, `op` in any case. `remove` without a path
is `noTarget`; a bad path is `invalidPath`.

#### `applyPatch(resource, operations, { definitions }): Result<Resource, ScimError>`

Applies RFC 7644 §3.5.2 to a copy, all operations or none. `add` appends new values to
multi-valued attributes and merges into complex ones, `replace` swaps multi-valued attributes
and merges complex ones, path-less `add`/`replace` apply each member (URN keys and dotted keys
included), and a value filter matching nothing is `noTarget` for `remove`/`replace`. Read-only
changes, and changes to an `immutable` attribute that has a value, are `mutability`. Where an
attribute is boolean, `"True"`/`"False"` are read as booleans.

`Patch.Operation`, `Patch.Path` and `Patch.ApplyOptions` type the operations and options.

### `@sdxc/scim/discovery`

- `USER_DEFINITION`, `GROUP_DEFINITION`, `ENTERPRISE_USER_DEFINITION`: RFC 7643 §8.7 definitions
- `pickAttributes(definition, names)`: the definition narrowed to named attributes and
  sub-attributes (`emails.value`)
- `serviceProviderConfig(options)`, `resourceTypes(types)`, `schemas(definitions)`: the discovery
  documents as plain objects, for `scimResponse`

`id`, `externalId`, `schemas` and `meta` are resolved for every resource even though `/Schemas`
omits them, as RFC 7643 §3 defines them in common. Unqualified names resolve against the
definitions in insertion order, after a resource's own `schemas`, so put the core schema first.

`Discovery.Definitions`, `Discovery.SchemaDefinition`, `Discovery.Attribute`,
`Discovery.ServiceProviderConfigOptions`, `Discovery.AuthenticationScheme` and
`Discovery.ResourceType` type the definitions and documents.

## Pattern: Push A Filter Into SQL, Fall Back In Memory

```typescript
import { isFailure, isSuccess } from "@sdxc/result";
import { errorResponse, groupResource } from "@sdxc/scim";
import { filterToWhere } from "@sdxc/scim/data-table";
import { compileFilter } from "@sdxc/scim/filter";
import { and, eq } from "remix/data-table";

let where = query.filter
	? filterToWhere(query.filter, {
			displayName: { column: "display_name", caseExact: false },
			externalId: "external_id",
		})
	: null;

let rows = await db.findMany(groups, {
	where:
		where && isSuccess(where)
			? and(eq("tenant_id", tenant.id), where.data)
			: eq("tenant_id", tenant.id),
});

let resources = rows.map(toGroup).map(groupResource);
if (query.filter && where && isFailure(where)) {
	let matches = compileFilter(query.filter, { definitions: DEFINITIONS });
	if (isFailure(matches)) return errorResponse(matches.error);
	resources = resources.filter(matches.data);
}
```

## Pattern: Conditional Replace With Versions

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
let next = userResource(await replaceUser(id, user.data));
let tag = await version(next);
return scimResponse({ ...next, meta: { ...next.meta, version: tag } }, { headers: { ETag: tag } });
```

## Pattern: One Definition For Everything

Build `/Schemas` from the same `Definitions` value that `compileFilter`, `applyPatch` and
`project` receive, and restrict filters with `allow` to the attributes your store can filter by.
PATCH as read, apply, replace: apply the operations to the current wire representation, then
store the result through the same path a `PUT` takes.

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
