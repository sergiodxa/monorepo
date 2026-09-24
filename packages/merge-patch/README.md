# @sdxc/merge-patch

Apply, diff and read RFC 7396 JSON Merge Patch documents.

## Overview

A JSON merge patch is a partial update written in the shape of the resource: the body lists only
the members that change, a nested object merges into the member it lands on, `null` removes a
member, and arrays and scalars replace what was there. Its media type is
`application/merge-patch+json`, and it is what `PATCH` endpoints in this repo read.

The package has two entry points. `@sdxc/merge-patch` holds the pure JSON functions (`apply`,
`diff`, `parse`, `stringify`, `applyValidated`) and the `MergePatchOf<T>` type, and has no HTTP in
it, so a client builds patches with it alone. `@sdxc/merge-patch/request` reads a patch off a
standard `Request`, refusing other media types with `415` before the body is read, and builds the
problem response for a refusal with [`@sdxc/problem`](../problem/README.md).

One rule follows from the format: a merge patch cannot set a member to a literal `null`, because
`null` means removal. `diff` refuses to produce such a patch, so a client learns about the conflict
before sending. See [RFC 7396](https://www.rfc-editor.org/rfc/rfc7396).

## Usage

```typescript
import { apply, diff } from "@sdxc/merge-patch";
import { unwrap } from "@sdxc/result";

apply({ title: "Goodbye!", tags: ["a", "b"] }, { title: "Hello!", tags: ["a"], draft: null });
// { title: "Hello!", tags: ["a"] }

unwrap(diff({ name: "Home", interval: 60 }, { name: "Home", interval: 30 }));
// { interval: 30 }
```

A `PATCH` handler that validates the patched resource with the create schema:

```typescript
import { applyValidated, diff } from "@sdxc/merge-patch";
import { mergePatchProblem, readMergePatch } from "@sdxc/merge-patch/request";
import { issuesFrom, validationProblem } from "@sdxc/problem";
import { isFailure, unwrap } from "@sdxc/result";

let patch = await readMergePatch(ctx.request, { alsoAccept: ["application/json"] });
if (isFailure(patch)) return mergePatchProblem(patch.error);

let current = serialize(await Monitor.find(ctx.db, id));
let next = applyValidated(current, patch.data, MonitorSchema);
if (isFailure(next)) return validationProblem(issuesFrom(next.error));

await Monitor.update(ctx.db, id, unwrap(diff(current, next.data)));
```

## API

### `"."`

#### `apply(target: JSONValue, patch: JSONValue): JSONValue`

Applies `patch` to `target` per RFC 7396 and returns a new value. Neither input is mutated, and the
result shares no object or array with them. A non-object patch replaces the target; an object patch
applied to a non-object merges into `{}`. A member named `__proto__` is written as data.

#### `diff(source: JSONValue, target: JSONValue): Result<JSONValue, UnrepresentableChangeError>`

The smallest patch that turns `source` into `target`, so `apply(source, patch)` equals `target`.
Removed members become `null`, changed arrays are sent whole, and `{}` means two objects are equal.
A non-object target is its own patch. Fails with `UnrepresentableChangeError`, whose `pointer` is an
RFC 6901 JSON Pointer, when the target holds `null` as an object member at any depth.

#### `parse(text: string): Result<JSONValue, MergePatchParseError>`

Reads a merge patch document. Any JSON value is a valid patch, so this fails only on text that is
not JSON.

#### `stringify(patch: JSONValue): string`

Writes a patch as the JSON text a request body carries.

#### `applyValidated(target, patch, schema): Result<Output, MergePatchValidationError>`

Applies the patch and validates the **result** with a Standard Schema (a `remix/data-schema` schema
in practice), so one schema serves create and update: a patch removing a required member fails on
that member, and a patch setting a value out of range fails at that value's path. The error's
`issues` point into the patched result, and `validationProblem(issuesFrom(error))` from
`@sdxc/problem` answers with them. The schema must validate synchronously.

#### `MEDIA_TYPE`

`"application/merge-patch+json"`.

#### `MergePatchOf<T>`

The type of a valid patch for a resource `T`: every member optional, `null` allowed only where the
member itself is optional, objects recursively patchable, arrays and scalars replaced whole.

```typescript
interface Subject {
	email: string;
	displayName?: string;
}
let patch: MergePatchOf<Subject> = { displayName: null }; // ok
let bad: MergePatchOf<Subject> = { email: null }; // type error: email is required
```

#### `JSONValue` / `JSONObject`

The JSON types every function reads and writes, structurally identical to `JSONValue` from
`@sdxc/types`.

### `"./request"`

#### `isMergePatch(request: Request): boolean`

Whether the `Content-Type` essence is `application/merge-patch+json`, case-insensitively, with
parameters ignored.

#### `readMergePatch(request, options?): Promise<Result<JSONValue, MergePatchRequestError>>`

Checks the media type, then reads and parses the body. A request with another media type is refused
with its body left unread. `alsoAccept` lists further media types read the same way;
`["application/json"]` keeps an endpoint's existing callers while it adopts merge patch.

#### `MergePatchRequestError`

Carries `reason` (`"unsupported-media-type"` or `"invalid-json"`) and the `status` to answer with
(`415` or `400`).

#### `mergePatchProblem(error: MergePatchRequestError): Response`

The `application/problem+json` response for a refusal: the error's status, its message as `detail`,
and `Accept-Patch: application/merge-patch+json` on a `415`.

#### `ACCEPT_PATCH_HEADER`

`["Accept-Patch", "application/merge-patch+json"]`, a header tuple for an `OPTIONS` answer:
`headers.set(...ACCEPT_PATCH_HEADER)`.

## Patterns

### Client: compute a patch from two snapshots

```typescript
import { diff, MEDIA_TYPE, stringify } from "@sdxc/merge-patch";
import { isFailure } from "@sdxc/result";

let patch = diff(original, edited);
if (isFailure(patch)) throw new Error(`Cannot clear ${patch.error.pointer} with a merge patch`);

await fetch(url, {
	method: "PATCH",
	headers: { "Content-Type": MEDIA_TYPE },
	body: stringify(patch.data),
});
```

### Advertise the format on `OPTIONS`

```typescript
import { ACCEPT_PATCH_HEADER } from "@sdxc/merge-patch/request";

return new Response(null, { status: 204, headers: [ACCEPT_PATCH_HEADER, ["Allow", "GET, PATCH"]] });
```

## Related Packages

- [`@sdxc/problem`](../problem/README.md) - problem responses and `issuesFrom` for validation issues
- [`@sdxc/validate`](../validate/README.md) - reads any `+json` body, merge patches included, when a
  schema should see the raw patch

## Tips

- Validate the patched result, not the patch: `applyValidated` with the create schema keeps limits
  in one place
- Write only `diff(current, next)`, so a request touching one member updates one column
- A member that must hold a literal `null` cannot be written through a merge patch; `null` always
  removes
