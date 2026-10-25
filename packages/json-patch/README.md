# @sdxc/json-patch

Apply, validate and diff RFC 6902 JSON Patch documents.

A [JSON Patch](https://www.rfc-editor.org/rfc/rfc6902) is an ordered list of operations —
`add`, `remove`, `replace`, `move`, `copy` and `test` — each aimed at an
[RFC 6901 JSON Pointer](https://www.npmjs.com/package/@sdxc/json-pointer). A patch applies all or
nothing: when one operation fails, the document is left exactly as it was.

It complements [`@sdxc/merge-patch`](https://www.npmjs.com/package/@sdxc/merge-patch). A merge
patch sends a partial document, which is the simplest update to write but cannot set a member to
`null`, edit one array element or make a change conditional. JSON Patch sends operations, so it
inserts and removes array elements, writes an explicit `null`, and guards an update with `test`
preconditions.

## Installation

```sh
npm add @sdxc/json-patch
```

Fallible calls return [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result) values.

## Usage

### Apply a patch

```typescript
import { apply } from "@sdxc/json-patch";

apply({ title: "Draft", tags: ["a"] }, [
	{ op: "test", path: "/title", value: "Draft" },
	{ op: "replace", path: "/title", value: "Hello" },
	{ op: "add", path: "/tags/-", value: "b" },
]);
// success({ title: "Hello", tags: ["a", "b"] })
```

### Compute a patch

```typescript
import { diff } from "@sdxc/json-patch";

diff({ tags: ["a", "c"], note: "x" }, { tags: ["a", "b", "c"], note: null });
// [
//   { op: "add", path: "/tags/1", value: "b" },
//   { op: "replace", path: "/note", value: null },
// ]
```

### Read a request body

```typescript
import { parse } from "@sdxc/json-patch";
import { isFailure } from "@sdxc/result";

let patch = parse(await request.text());
if (isFailure(patch)) return new Response(patch.error.message, { status: 400 });
```

## API

### `apply(document: JSONValue, patch: readonly Operation[]): Result<JSONValue, JsonPatchError>`

Runs the operations in order against a copy of `document` and returns the patched copy, which
shares no object or array with either input. The patch is validated first, even when typed, so a
value cast from untrusted JSON is still checked before anything runs.

### `diff(source: JSONValue, target: JSONValue): Operation[]`

A patch for which `apply(source, patch)` returns `target`. Objects compare member by member
regardless of order, an array keeps its shared leading and trailing elements and edits only the
span between them, and equal documents give `[]`.

### `validate(value: unknown): Result<Operation[], JsonPatchError>`

Checks that a value is a patch document — an array of operations with a known `op`, JSON Pointer
`path` and `from` members, and a `value` member where the operation needs one — and returns the
operations without any unrecognized members.

### `parse(text: string): Result<Operation[], JsonPatchError>`

`JSON.parse` followed by `validate`.

### `stringify(patch: readonly Operation[]): string`

Writes a patch as the JSON text a request body carries.

### `MEDIA_TYPE`

`"application/json-patch+json"`.

### `JsonPatchError`

Every failure. `index` is the failing operation's position, or `null` when the document as a
whole is not a patch, and `reason` picks the RFC 5789 answer:

| `reason`          | Meaning                                  | Status |
| ----------------- | ---------------------------------------- | ------ |
| `"invalid-patch"` | The text or an operation is malformed    | 400    |
| `"unresolvable"`  | A `path` or `from` has nothing to act on | 422    |
| `"test-failed"`   | A `test` operation's value did not match | 409    |

### Types

#### `Operation`

The union of `AddOperation`, `RemoveOperation`, `ReplaceOperation`, `MoveOperation`,
`CopyOperation` and `TestOperation`. `JSONPatch` is `Operation[]`.

#### `JSONValue` / `JSONObject`

The JSON values every function reads and writes.

#### `JsonPatchErrorReason`

`"invalid-patch" | "unresolvable" | "test-failed"`.

## Pattern: Accept JSON Patch On A PATCH Endpoint

The handler checks the media type, applies the patch to the stored resource and maps each
failure reason to its status.

```typescript
import { apply, MEDIA_TYPE, parse } from "@sdxc/json-patch";
import { isFailure } from "@sdxc/result";

const STATUS = { "invalid-patch": 400, unresolvable: 422, "test-failed": 409 } as const;

async function updateArticle(request: Request, id: string) {
	if (request.headers.get("Content-Type")?.split(";")[0]?.trim() !== MEDIA_TYPE) {
		return new Response(null, { status: 415, headers: { "Accept-Patch": MEDIA_TYPE } });
	}

	let patch = parse(await request.text());
	if (isFailure(patch)) return new Response(patch.error.message, { status: 400 });

	let next = apply(await articles.find(id), patch.data);
	if (isFailure(next)) {
		return new Response(next.error.message, { status: STATUS[next.error.reason] });
	}

	await articles.save(id, next.data);
	return Response.json(next.data);
}
```

## Pattern: Update Only If Nobody Else Did

A `test` operation turns a patch into a compare-and-set: the update applies only while the
member still holds the value the client last saw.

```typescript
import { MEDIA_TYPE, stringify } from "@sdxc/json-patch";

let response = await fetch(`/articles/${id}`, {
	method: "PATCH",
	headers: { "Content-Type": MEDIA_TYPE },
	body: stringify([
		{ op: "test", path: "/revision", value: 7 },
		{ op: "replace", path: "/revision", value: 8 },
		{ op: "remove", path: "/tags/2" },
	]),
});
if (response.status === 409) {
	/** Someone else saved first: reload and retry. */
}
```

## Pattern: Send Only What Changed

```typescript
import { diff, MEDIA_TYPE, stringify } from "@sdxc/json-patch";

let patch = diff(original, edited);
if (patch.length > 0) {
	await fetch(`/articles/${id}`, {
		method: "PATCH",
		headers: { "Content-Type": MEDIA_TYPE },
		body: stringify(patch),
	});
}
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
		"@sdxc/json-patch": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
