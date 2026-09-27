# @sdxc/merge-patch

Apply, diff and read RFC 7396 JSON Merge Patch documents.

## Installation

```bash
npm add @sdxc/merge-patch
```

Fallible calls return [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result) values, and
`@sdxc/merge-patch/request` answers refusals with
[`@sdxc/problem`](https://www.npmjs.com/package/@sdxc/problem) documents. Both install alongside
this package.

A [JSON merge patch](https://www.rfc-editor.org/rfc/rfc7396) is a partial update written in the
shape of the resource: the body lists only the members that change, a nested object merges into
the member it lands on, `null` removes a member, and arrays and scalars replace what was there.
Its media type is `application/merge-patch+json`. The root entry point is pure JSON with no HTTP
in it, so a client builds patches with it alone; `@sdxc/merge-patch/request` reads a patch off a
standard `Request`. `null` always means removal, so a merge patch never sets a member to a
literal `null`; `diff` refuses to produce such a patch, and a client learns about the conflict
before sending.

## Usage

### Apply And Diff

```typescript
import { apply, diff } from "@sdxc/merge-patch";
import { unwrap } from "@sdxc/result";

apply({ title: "Goodbye!", tags: ["a", "b"] }, { title: "Hello!", tags: ["a"], draft: null });
// { title: "Hello!", tags: ["a"] }

unwrap(diff({ name: "Home", interval: 60 }, { name: "Home", interval: 30 }));
// { interval: 30 }
```

### Read A PATCH Request

A handler that validates the patched resource with the create schema, and writes only what
changed:

```typescript
import { applyValidated, diff } from "@sdxc/merge-patch";
import { mergePatchProblem, readMergePatch } from "@sdxc/merge-patch/request";
import { issuesFrom, validationProblem } from "@sdxc/problem";
import { isFailure, unwrap } from "@sdxc/result";

let patch = await readMergePatch(request, { alsoAccept: ["application/json"] });
if (isFailure(patch)) return mergePatchProblem(patch.error);

let current = await loadArticle(id); // a JSONValue
let next = applyValidated(current, patch.data, ARTICLE_SCHEMA);
if (isFailure(next)) return validationProblem(issuesFrom(next.error));

await updateArticle(id, unwrap(diff(current, next.data)));
```

## API

### `@sdxc/merge-patch`

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

Reads a merge patch document. Any JSON value is a valid patch, so this fails, with a
`MergePatchParseError`, only on text that is not JSON.

#### `stringify(patch: JSONValue): string`

Writes a patch as the JSON text a request body carries.

#### `applyValidated(target, patch, schema): Result<Output, MergePatchValidationError>`

Applies the patch and validates the **result** with a Standard Schema (a `remix/data-schema` schema
in practice), so one schema serves create and update: a patch removing a required member fails on
that member, and a patch setting a value out of range fails at that value's path. The
`MergePatchValidationError`'s `issues` point into the patched result, and
`validationProblem(issuesFrom(error))` from `@sdxc/problem` answers with them. The schema must
validate synchronously.

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

The JSON types every function reads and writes.

### `@sdxc/merge-patch/request`

#### `isMergePatch(request: Request): boolean`

Whether the `Content-Type` essence is `application/merge-patch+json`, case-insensitively, with
parameters ignored.

#### `readMergePatch(request, options?): Promise<Result<JSONValue, MergePatchRequestError>>`

Checks the media type, then reads and parses the body. A request with another media type is refused
with its body left unread. `alsoAccept` (`ReadMergePatchOptions`) lists further media types read
the same way;
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

## Pattern: Compute A Patch From Two Snapshots

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

## Pattern: Advertise The Format On `OPTIONS`

```typescript
import { ACCEPT_PATCH_HEADER } from "@sdxc/merge-patch/request";

return new Response(null, { status: 204, headers: [ACCEPT_PATCH_HEADER, ["Allow", "GET, PATCH"]] });
```

## Pattern: Type The Patches A Client Sends

```typescript
import type { MergePatchOf } from "@sdxc/merge-patch";

import { MEDIA_TYPE, stringify } from "@sdxc/merge-patch";

interface Article {
	title: string;
	summary?: string;
	tags: string[];
}

function patchArticle(id: string, patch: MergePatchOf<Article>) {
	return fetch(`/articles/${id}`, {
		method: "PATCH",
		headers: { "Content-Type": MEDIA_TYPE },
		body: stringify(patch),
	});
}

await patchArticle("a1", { summary: null, tags: ["http"] }); // clears summary, replaces tags
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
		"@sdxc/merge-patch": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
