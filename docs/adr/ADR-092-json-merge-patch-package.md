# ADR-092: JSON Merge Patch Package

## Status

**Accepted** - 2026-09-24

## Background

[RFC 7396](https://www.rfc-editor.org/rfc/rfc7396) defines JSON Merge Patch: a partial update is
a JSON document shaped like the resource. A member present in the patch replaces the target's
member. A member set to `null` removes it. A nested object merges recursively. Anything that is
not an object, arrays included, replaces the target wholesale. The media type is
`application/merge-patch+json`, and it is meant for `PATCH` (RFC 5789).

The question was whether the repo does partial updates at all. It does: two apps answer `PATCH`
with JSON bodies, and nine of uptime's `PUT` endpoints already behave like a merge patch without
saying so. Each endpoint implements its own semantics, and they disagree about what an absent
member, a `null` and a nested object mean.

## Context

### Every partial-update JSON endpoint today

Found by grepping every route map for `patch(`/`put(` and every controller for
`s.optional(s.nullable(`. Dashboard edits in every app are HTML form `POST`s to `/actions/…` and
are not JSON APIs.

| Endpoint                                                                                                          | Method | Body semantics today                                                                                                                                         |
| ----------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| auth-saas `/tenants/:tenantId/subjects/:subjectId`                                                                | PATCH  | Absent keeps; nested `profile` merges one level; `null` in `profile` clears a column; `null` in `attributes` is **stored** as a value                        |
| auth-saas `/tenants/:tenantId/clients/:clientId`                                                                  | PATCH  | Every field required: a full replacement under the `PATCH` verb                                                                                              |
| auth-saas `/tenants/:tenantId/webhook-endpoints/:endpointId`                                                      | PATCH  | Every field required: a full replacement                                                                                                                     |
| auth-saas `/tenants/:tenantId/roles/:roleId`                                                                      | PATCH  | `scope` required, `name`/`description` optional; `null` refused                                                                                              |
| auth-saas `/tenants/:tenantId/subjects/:subjectId/passkeys/:credentialId`                                         | PATCH  | `{ label }` required: a one-field update                                                                                                                     |
| uptime `/api/v1/dns-monitors/:id/records/:recordId`                                                               | PATCH  | `{ isEnabled }` required, unknown keys rejected                                                                                                              |
| uptime `/api/v1/{monitors,dns-monitors,tcp-monitors,flow-monitors,cron-jobs,alerts,maintenance,status-pages}/:id` | PUT    | Every field `s.optional`: absent keeps. `null` clears on `status-pages` (`description`, `logoUrl`, `customDomain`), `alerts` and `maintenance` (`monitorId`) |
| uptime `/api/v1/team`                                                                                             | PUT    | Absent keeps; `logoUrl` cannot be cleared                                                                                                                    |
| uptime `/api/v1/status-pages/:id/monitors`                                                                        | PUT    | A real replacement of the attachment lists                                                                                                                   |
| auth-saas `/scim/v2/{Users,Groups}/:id`                                                                           | PATCH  | SCIM `PatchOp` (RFC 7644): an operation list, not a merge patch                                                                                              |

The uptime reference already documents the `status-pages` `PUT` as a merge patch: "Only provided
fields are updated" and "`null` clears it". The handlers implement that by hand, one
`if (result.data.x !== undefined)` line per field (`apps/uptime/app/http/controllers/api/monitor.ts`,
lines 106-125).

### What goes wrong without a shared definition

| Problem                                                                                                                                                                  | Where                                                                        |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `null` means "clear" in `profile` and "store null" in `attributes` within one request body                                                                               | `apps/auth-saas/database/subjects.ts`, `updateSubject` / `profileChanges`    |
| `PATCH` that requires the whole resource, so a caller must read before every write                                                                                       | auth-saas `clients/update.ts`, `webhook-endpoints/update.ts`                 |
| No request checks `Content-Type`; auth-saas calls `ctx.request.json()` on any body                                                                                       | every auth-saas update action                                                |
| `@sdxc/validate` reads a body as JSON only when `Content-Type` contains `application/json`, so it answers `application/merge-patch+json` with "Unsupported content-type" | `packages/validate/src/index.ts`, `validate()`                               |
| Update schemas restate every create field as `s.optional(...)`, so limits are written twice                                                                              | uptime `UpdateMonitorSchema` beside the create schema, repeated per resource |
| `@sdxc/auth`'s client sends `PATCH` with `content-type: application/json`                                                                                                | `packages/auth/src/management-client.ts`, `updateTenantSubject`              |

### What the RFC asks of an implementation

| Rule                                                                              | Consequence for the package                                                                   |
| --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| A non-object patch replaces the target entirely                                   | `apply(target, "x")` is `"x"`; `apply(target, [1])` is `[1]`                                  |
| A non-object target is treated as `{}` when the patch is an object                | `apply(3, { a: 1 })` is `{ a: 1 }`                                                            |
| `null` in a patch object removes the member; nothing can set a member to `null`   | `diff` fails when the target holds a `null` the source does not; APIs model "empty" as absent |
| Arrays are values, never merged element-wise                                      | `diff` emits the whole array when any element changed                                         |
| Nested objects merge recursively                                                  | a patch shaped like the resource updates one nested field without resending its siblings      |
| The patch is applied atomically, and a result the server cannot accept is refused | validate the **result** against the resource schema before writing anything                   |
| Media type `application/merge-patch+json`, advertised through `Accept-Patch`      | a constant, a request check, and a `415` answer carrying `Accept-Patch`                       |

## Decision

Add `@sdxc/merge-patch`: apply, generate, read and validate RFC 7396 merge patches on plain JSON
values and standard `Request` objects, with no framework dependency.

### Package name

| Name                             | Trade-off                                                                                                                       |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| **`@sdxc/merge-patch`**          | Short and matches the media type's own name (`merge-patch+json`); "JSON" is implied by every patch the repo sends               |
| `@sdxc/json-merge-patch`         | The RFC's full title and unambiguous on npm; longer to type and import, with nothing gained inside the repo                     |
| Part of `@sdxc/http`             | No new package; but merge patch is a JSON format with no HTTP in `apply`/`diff`, and clients import it without the HTTP helpers |
| `@sdxc/json-patch` covering both | One place for partial updates; RFC 6902 is a different format (an operation list with JSON Pointers) that no endpoint uses      |

`@sdxc/merge-patch` wins because the package is one format with one media type. The repo names
format packages after the format (`@sdxc/problem`, `@sdxc/opml`), and the media type already calls
it "merge-patch".

### Scope

The package includes:

- `apply` and `diff` over `JSONValue`
- `parse`/`stringify` for merge patch documents, returning `Result`
- The media type constant, a request check, and a reader that refuses other media types
- `applyValidated`, which applies a patch and validates the result with a Standard Schema
  (a `remix/data-schema` schema in practice), typed by the schema's output
- `MergePatchOf<T>`, the type of a valid patch for a resource type `T`, for clients

What stays out:

- JSON Patch (RFC 6902) lives nowhere today; it gets its own package if an endpoint needs
  ordered, array-positional operations
- SCIM `PatchOp` (RFC 7644) lives in the SCIM package ADR-085 adds, since its paths and filters are
  SCIM's own
- Turning a patched representation into database column changes lives in each app's data layer;
  `diff(current, next)` gives it the changed members
- Documenting an operation's body as `application/merge-patch+json` lives in `@sdxc/openapi`
  (ADR-080), which takes any media type as a body key
- Problem responses (`415`, validation failures) are built with `@sdxc/problem` by the caller

### Exports

#### `"."`

```ts
import type { StandardSchemaV1 } from "@standard-schema/spec";
import type { Result } from "@sdxc/result";
import type { JSONValue } from "@sdxc/types";

export const MEDIA_TYPE = "application/merge-patch+json";

/**
 * The patches that are valid for a resource of type `T`: every member optional, `null`
 * wherever the member itself is optional (removing it), objects recursively patchable,
 * arrays and scalars replaced whole.
 */
export type MergePatchOf<T> = T extends readonly unknown[]
	? T
	: T extends object
		? { [K in keyof T]?: MergePatchOf<T[K]> | (undefined extends T[K] ? null : never) }
		: T;

/** Applies `patch` to `target` per RFC 7396 and returns a new value; neither input is mutated. */
export function apply(target: JSONValue, patch: JSONValue): JSONValue;

/**
 * The smallest merge patch that turns `source` into `target`: removed members become `null`,
 * changed arrays are sent whole, and `{}` means the two are equal.
 */
export function diff(
	source: JSONValue,
	target: JSONValue,
): Result<JSONValue, UnrepresentableChangeError>;

/** `target` sets a member to `null`, which no merge patch can express. */
export class UnrepresentableChangeError extends Error {
	/** RFC 6901 JSON Pointer to the member. */
	readonly pointer: string;
}

export function parse(text: string): Result<JSONValue, MergePatchParseError>;
export function stringify(patch: JSONValue): string;

export class MergePatchParseError extends Error {}

/**
 * Applies `patch` to `target` and validates the result, so a patch is accepted exactly when the
 * resource it produces is valid: one schema serves create and update.
 */
export function applyValidated<Output>(
	target: JSONValue,
	patch: JSONValue,
	schema: StandardSchemaV1<unknown, Output>,
): Result<Output, MergePatchValidationError>;

export class MergePatchValidationError extends Error {
	/** Standard Schema issues, with paths into the patched result; `issuesFrom` in `@sdxc/problem` turns them into `errors`. */
	readonly issues: readonly StandardSchemaV1.Issue[];
}
```

`applyValidated` validates the result, not the patch. A patch that removes a required member
fails on that member, and a patch that sets `intervalSeconds` out of range fails on
`/intervalSeconds`. The limits live once, in the schema the create endpoint already uses. The
issue paths point into the patched result, and for every member the patch touched they are the
same paths the patch used.

#### `"./request"`

```ts
/** Whether the request's `Content-Type` essence is `application/merge-patch+json`, case-insensitively, parameters ignored. */
export function isMergePatch(request: Request): boolean;

/** Reads and parses the body; the media type is checked before the body is read. */
export function readMergePatch(
	request: Request,
	options?: { alsoAccept?: readonly string[] },
): Promise<Result<JSONValue, MergePatchRequestError>>;

export class MergePatchRequestError extends Error {
	readonly reason: "unsupported-media-type" | "invalid-json";
	/** The status to answer with: `415` or `400`. */
	readonly status: 415 | 400;
}

/** `Accept-Patch: application/merge-patch+json` (RFC 5789), for a `415` or an `OPTIONS` answer. */
export const ACCEPT_PATCH_HEADER: readonly [name: "Accept-Patch", value: typeof MEDIA_TYPE];
```

`alsoAccept: ["application/json"]` is the migration path. An endpoint that has always taken
`application/json` keeps its existing callers while it starts advertising the merge patch media
type.

### Null means delete

This is the rule the repo has been splitting on. Adopting the package makes it the same everywhere:

- In a merge patch, `null` removes a member. For a nullable column (`status_pages.description`),
  removing and clearing are the same write, and the API reads the member back as `null` or absent,
  whichever the resource's serializer already does.
- A value that must be able to hold a literal `null` cannot be written through a merge patch.
  auth-saas subject `attributes` store `null` today (`AttributeValue` includes it). Under merge
  patch, `{ "attributes": { "department": null } }` deletes the attribute row, and reading the
  subject reports the attribute absent. That changes behavior for any caller that wrote `null`
  meaning "known to be empty", and it goes in the management API's changelog for the version that
  adopts it.
- `diff` refuses to produce a patch that would need to set `null`, so a client computing its
  patch from two snapshots learns about the conflict before sending.

### Usage

#### Auth-saas: subjects update, the first adopter

The endpoint whose semantics are inconsistent today moves first:

```ts
// apps/auth-saas/app/http/controllers/management/subjects/update.ts
handler: async (ctx) => {
	let patch = await readMergePatch(ctx.request, { alsoAccept: ["application/json"] });
	if (isFailure(patch)) return mediaTypeOrJsonProblem(patch.error);

	let current = await ctx.tenantStub.describeWritableSubject(subjectId); // new: the writable projection
	if (!current) return subjectNotFound();

	let next = applyValidated(current, patch.data, WritableSubjectSchema);
	if (isFailure(next)) return managementProblem("validationFailed", { extensions: { errors: issuesFrom(next.error.issues) } });

	let result = await ctx.tenantStub.updateSubject({ subjectId, changes: unwrap(diff(current, next.data)), actor });
	/* ... */
},
```

`updateSubject` in `apps/auth-saas/database/subjects.ts` takes the diff. A `null` attribute
deletes its `subject_attributes` row, and `profileChanges` keeps mapping `null` to a cleared
column. `UpdateSubjectBodySchema` is replaced by `WritableSubjectSchema`, the same shape without
`s.optional` on every member.

#### Auth-saas: clients and webhook endpoints

`clients/update.ts` and `webhook-endpoints/update.ts` answer `PATCH` but require the full
resource. With merge patch, a caller sends only `{ "redirectUris": [...] }`. Arrays replace
wholesale, which is what a redirect-URI list update means. The existing full-body requests stay
valid patches, so no caller breaks. `roles/update.ts` and the passkey rename take the same
reader, and their bodies already are valid merge patches.

#### `@sdxc/auth` client

`ManagementClient.updateTenantSubject` sends `content-type: application/merge-patch+json`, and
`UpdateTenantSubjectInput` becomes `MergePatchOf<TenantSubjectWritable>`, so a caller's `null`
is typed as the removal it is. The same applies to the client and webhook-endpoint update methods
once their inputs become partial.

#### Uptime

- `PATCH /api/v1/dns-monitors/:id/records/:recordId` reads through `readMergePatch` with
  `alsoAccept: ["application/json"]`; its body is unchanged.
- The eight resources whose `PUT` is already partial gain a `PATCH` leaf next to `resources()`'s
  `update` in `apps/uptime/routes/web.ts`, mapped to the same action. The handler replaces its
  per-field `if (x !== undefined)` block with `applyValidated(serialized, patch, CreateSchema)`
  and `diff`. `PUT` keeps accepting the same bodies, since it is a public API. The reference
  documents `PATCH` as the update method.
- `PUT /api/v1/team` gets the same `PATCH`, which also gives `logoUrl` a way to be cleared.
- `PUT /api/v1/status-pages/:id/monitors` stays a `PUT`: it replaces the lists.

## Consequences

### Positive

- **One meaning for `null` and for absence** - every partial update removes on `null` and keeps
  on absence, including nested objects, which today depends on the endpoint
- **One schema per resource** - updates validate the patched result with the create schema, and
  the `s.optional` copies and per-field `!== undefined` blocks go away
- **Real `PATCH` on clients and webhook endpoints** - callers stop reading the whole resource
  before changing one field
- **A standard clients already know** - `application/merge-patch+json` is what Kubernetes, GitHub
  and most OpenAPI tooling expect for a partial JSON update

### Negative

- **A behavior change on subject attributes** - `null` stops being storable through the API, and
  a caller relying on it has to be told
- **Handlers read before they write** - `applyValidated` needs the current writable representation.
  auth-saas already loads the subject, and uptime already loads the row, so this adds a serialize
  step, not a query
- **Merge patch cannot edit inside an array** - adding one redirect URI means resending the list,
  and concurrent edits to one list race. An `If-Match` precondition solves that, but it is not
  part of this ADR
- **Two methods for one uptime operation** - `PUT` and `PATCH` coexist on nine endpoints until
  `PUT` can be retired in a later API version

### Neutral

- **`@sdxc/validate` needs `+json` suffix support** - independently of this package, `validate()`
  should treat any `application/*+json` media type (RFC 6839) as JSON. That is a separate fix in
  that package
- **No `remix` dependency** - `applyValidated` takes any Standard Schema, so the package depends
  only on `@sdxc/result`, `@sdxc/types` and the Standard Schema types

## Implementation Plan

### Phase 1: Specify and build the package

**Priority:** Medium
**Estimated Effort:** 3 hours

1. Tests first from RFC 7396 Appendix A (every example case) for `apply`, then `diff`
   round trips (`apply(source, diff(source, target)) = target`), the `null`-in-target failure,
   media type detection with parameters and case, and `applyValidated` issue paths
2. Implement `apply`, `diff`, `parse`, `stringify`, `applyValidated`, `"./request"`
3. README per the package documentation guide, and the root README table row

### Phase 2: Auth-saas subjects, clients, webhook endpoints

**Priority:** Medium
**Estimated Effort:** 4 hours

1. Subjects: `readMergePatch` + `applyValidated` + `diff`, with `updateSubject` deleting an
   attribute on `null`, and a regression test for the attribute behavior
2. Clients and webhook endpoints: accept partial bodies, and test that the old full-body requests
   still pass unchanged
3. Roles and passkey rename: switch to the reader
4. `@sdxc/auth` (its own commit): send the merge patch media type, type inputs with `MergePatchOf`

### Phase 3: Uptime

**Priority:** Low
**Estimated Effort:** 4 hours

1. Add the `PATCH` leaves, and move the eight partial `PUT` handlers onto `applyValidated` + `diff`
2. DNS record update onto the reader
3. Update the API reference; under ADR-080 this is the operation's body media type

## Alternatives Considered

### 1. JSON Patch (RFC 6902)

An ordered list of `add`/`remove`/`replace`/`move`/`copy`/`test` operations addressed by JSON
Pointer, with media type `application/json-patch+json`.

**Rejected because**: it solves problems the repo's endpoints do not have: positional array
edits, moves, and `test` preconditions inside the patch. It costs every caller the operation
syntax, and none of the endpoints above edits inside an array. It can set a member to `null`,
which merge patch cannot, but no endpoint needs that except auth-saas attributes, where treating
`null` as removal is acceptable. SCIM's `PatchOp` is the one operation-list format the repo
speaks, and it stays inside SCIM.

### 2. Keep per-endpoint semantics and document them

**Rejected because**: the inconsistency is inside a single request body today (auth-saas subject
`profile` versus `attributes`). Documenting it does not make it predictable, and every new
endpoint picks again.

### 3. Put it in `@sdxc/http`

**Rejected because**: `apply` and `diff` are pure JSON functions a client uses without any HTTP
helper, and `@sdxc/http` would pull its `remix` dependency into a client that only builds patches.

### 4. Defer until a new endpoint needs it

**Rejected because**: six JSON `PATCH` endpoints and nine partial `PUT` endpoints exist, and the
auth-saas management API is still on its first published version, where the attribute change is
cheapest.

## References

- [RFC 7396 - JSON Merge Patch](https://www.rfc-editor.org/rfc/rfc7396)
- [RFC 6902 - JSON Patch](https://www.rfc-editor.org/rfc/rfc6902)
- [RFC 5789 - PATCH Method for HTTP](https://www.rfc-editor.org/rfc/rfc5789)
- [RFC 6839 - Additional Media Type Structured Syntax Suffixes](https://www.rfc-editor.org/rfc/rfc6839)
- [RFC 7644 - SCIM Protocol, section 3.5.2 (PATCH)](https://www.rfc-editor.org/rfc/rfc7644#section-3.5.2)
- [ADR-077: Problem Details Package](./ADR-077-problem-details-package.md)
- [ADR-080: OpenAPI Package](./ADR-080-openapi-package.md)
- [ADR-085: SCIM 2.0 Package](./ADR-085-scim-package.md)

## Current Progress

- [x] Phase 1: Specify and build the package (`packages/merge-patch`; `@sdxc/validate` now reads
      any `+json` body)
- [x] Phase 2: Auth-saas subjects, clients, webhook endpoints (subjects project the described
      subject onto a writable shape and send `diff` to `updateSubject`; clients and webhook
      endpoints validate the patched record against the register schema and keep their
      full-replacement store writes; roles and passkey rename read through the reader;
      `@sdxc/auth` sends the media type and types the client update as `Partial` of the record,
      since `@sdxc/auth` is published and cannot depend on `@sdxc/merge-patch` without an
      install; `updateTenantClient` also moved from `PUT` to the `PATCH` the server answers)
- [x] Phase 3: Uptime (the eight partial resources and the team gain a `PATCH` read by
      `readApiUpdate`; `PUT` keeps its own handler and body; the DNS record toggle keeps
      `validate()`, which reads the merge patch media type beside its earlier content types)

## Notes

- Implementation: the package defines and exports its own `JSONValue` (and `JSONObject`),
  structurally identical to `@sdxc/types`'s, so it carries no dependency for one type alias
- Implementation: `"./request"` also exports `mergePatchProblem(error)`, the `415`/`400` problem
  response with `Accept-Patch` on a `415`, since every adopter would otherwise build the same one
- Implementation: `diff` of two equal non-object values returns the target itself, because `{}`
  applied to a non-object replaces it with `{}`; `{}` means "equal" only between objects
- Implementation: `applyValidated` fails with a single issue when the schema validates
  asynchronously, since its `Result` is synchronous; `remix/data-schema` schemas are synchronous
- Implementation: uptime's `PUT` endpoints keep their pre-merge-patch behavior (`null` refused
  except where it already cleared, re-sent `enabled` resetting `enabledAt`/`next_due_at`, form
  bodies read, alert channel settings ignored); merge patch semantics apply to `PATCH` only, so
  existing integrations see no change until `PUT` is retired in a later API version
- Implementation: uptime alert channel settings (`strategy`, `email`, `url`, `webhookUrl`, …) are
  writable through `PATCH`, validated with the create body and rebuilt with `buildConfig`
- Implementation: the uptime dashboard's team form stores any text as the logo while the API
  requires a URL; `PATCH /api/v1/team` leaves a stored non-URL logo out of the patch target so a
  patch that omits `logoUrl` still validates
