# @sdxc/json-pointer

Parse, stringify, get and set [RFC 6901](https://www.rfc-editor.org/rfc/rfc6901) JSON Pointers.

A JSON Pointer names a value inside a JSON document as a `/`-separated path. `~` in a
member name is written `~0` and `/` is written `~1`, so a key holding either still points
at itself. The empty string is the whole document.

## Installation

```sh
npm add @sdxc/json-pointer
```

Fallible calls return [`@sdxc/result`](https://www.npmjs.com/package/@sdxc/result) values.

## Usage

```typescript
import { get, parse, set, stringify } from "@sdxc/json-pointer";
import { unwrap } from "@sdxc/result";

stringify(["a/b", "m~n"]); // "/a~1b/m~0n"
unwrap(parse("/a~1b/m~0n")); // ["a/b", "m~n"]

let document = { foo: ["bar", "baz"], "a/b": 1 };
unwrap(get(document, "/foo/0")); // "bar"
unwrap(get(document, "/a~1b")); // 1
unwrap(set(document, "/foo/0", "qux")); // { foo: ["qux", "baz"], "a/b": 1 }
```

## API

### `stringify(segments: readonly (string | number)[]): string`

Writes path segments as a JSON Pointer. The empty list is `""`; each segment is `/` plus
its escaped text, and numbers are `String()`'d so `0` and `"0"` select the same index.

### `parse(pointer: string): Result<string[], JsonPointerParseError>`

Reads a pointer into unescaped tokens. `""` is `[]`. Any other string that does not start
with `/`, or that contains a `~` not followed by `0` or `1`, fails.

### `get(document: unknown, pointer: string): Result<unknown, JsonPointerError>`

Walks `document` along `pointer`. A missing member, an out-of-range index, or a walk
through a scalar fails rather than returning `undefined`.

### `set(document: unknown, pointer: string, value: unknown): Result<unknown, JsonPointerError>`

Returns a new tree with `value` stored at `pointer`. The empty pointer replaces the
document; `undefined` is not a JSON value and fails. Intermediate tokens must already
resolve — creating missing parents is RFC 6902 `add`.

### Types

#### `JsonPointerError`

A pointer that cannot be applied: the string is not RFC 6901, or a token has no member,
index, or container to land on.

#### `JsonPointerParseError`

A string that is not a JSON Pointer. Extends `JsonPointerError`, so `get` and `set` can
return a parse failure as the same error type.

## Pattern: Report a validation issue as a pointer

Flatten a schema path to keys, then `stringify`, so a member named `a/b` still points at
itself in the problem's `errors` list.

```typescript
import { stringify } from "@sdxc/json-pointer";

function toPointer(path: readonly (string | number | { key: string | number })[]): string {
	return stringify(path.map((segment) => (typeof segment === "object" ? segment.key : segment)));
}

toPointer([{ key: "users" }, { key: 0 }, "a/b"]); // "/users/0/a~1b"
```

## Pattern: Update one field without inventing parents

`set` copies the tree and writes the leaf. A pointer whose parent is missing fails, so a
PATCH that would create `/a/b` on `{}` is refused here and left to JSON Patch `add`.

```typescript
import { set } from "@sdxc/json-pointer";
import { isFailure } from "@sdxc/result";

let next = set({ a: { b: 1 } }, "/a/b", 2);
if (isFailure(next)) throw next.error;
// { a: { b: 2 } }

let missing = set({}, "/a/b", 1);
isFailure(missing); // true
```

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published, written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one release goes out per day.

Those numbers say when, not what: a later date means a later release and carries no compatibility promise. Any release may change or remove an export.

Depend on one exact date, and move it when you are ready to take the change:

```json
{
	"dependencies": {
		"@sdxc/json-pointer": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
