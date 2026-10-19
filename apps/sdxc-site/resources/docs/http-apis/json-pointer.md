---
title: Address JSON with JSON Pointer
description: Parse, stringify, get and set RFC 6901 JSON Pointers, so a member named a/b still points at itself in a problem, a schema path or a patch.
section:
    title: HTTP APIs
    order: 5
order: 6
lastUpdated: 2026-10-15
---

A JSON Pointer names a value inside a JSON document as a `/`-separated path. A member
named `a/b` is written `/a~1b`, and a `~` in a name is written `~0`, so the pointer still
points at that member. The empty string is the whole document.

[`@sdxc/json-pointer`](/api/json-pointer) is that encoding. Fallible calls return a
[`@sdxc/result`](/api/result), so a missing path is a branch rather than `undefined`.
[`@sdxc/problem`](/api/problem) writes the same pointers onto validation issues, and
[`@sdxc/merge-patch`](/api/merge-patch) names the member a patch cannot express.

```bash
npm add @sdxc/json-pointer @sdxc/result
```

## Parse and stringify

`stringify` joins path segments with `/` and escapes each one. `parse` undoes that. Numbers
are stringified, so `0` and `"0"` select the same array index.

```typescript {% title="app/services/pointers.ts" %}
import { parse, stringify } from "@sdxc/json-pointer";
import { unwrap } from "@sdxc/result";

stringify(["users", 0, "a/b"]); // "/users/0/a~1b"
unwrap(parse("/users/0/a~1b")); // ["users", "0", "a/b"]
stringify([]); // ""
unwrap(parse("")); // []
```

A string that does not start with `/`, or that contains a `~` not followed by `0` or `1`,
fails. Callers that already hold segments skip `parse` and pass them to `stringify`.

## Read a value

`get` walks the document along the pointer. A missing member, an out-of-range index, or a
walk through a scalar fails, so a `null` at that path and an absent path stay distinct.

```typescript {% title="app/services/read-field.ts" %}
import { get } from "@sdxc/json-pointer";
import { isFailure } from "@sdxc/result";

let document = { foo: ["bar", "baz"], "a/b": 1 };

let first = get(document, "/foo/0");
if (isFailure(first)) throw first.error;
// "bar"

let slash = get(document, "/a~1b");
if (isFailure(slash)) throw slash.error;
// 1

let missing = get(document, "/foo/9");
isFailure(missing); // true
```

The empty pointer is the document itself. Use it when a problem's `pointer` is `""` and the
issue is about the whole body.

## Write a value

`set` returns a new tree. Intermediate tokens must already resolve: creating missing
parents is JSON Patch `add`, not this assignment. The empty pointer replaces the document.
`undefined` is not a JSON value and fails.

```typescript {% title="app/services/write-field.ts" %}
import { set } from "@sdxc/json-pointer";
import { isFailure } from "@sdxc/result";

let next = set({ a: { b: 1 } }, "/a/b", 2);
if (isFailure(next)) throw next.error;
// { a: { b: 2 } }

let added = set({ a: 1 }, "/b", 2);
if (isFailure(added)) throw added.error;
// { a: 1, b: 2 }

let missing = set({}, "/a/b", 1);
isFailure(missing); // true
```

A key named `__proto__` is stored as data. The original document is left unchanged.

## Name a validation issue

Flatten a schema path to keys, then `stringify`, so a member named `a/b` still points at
itself in a problem's `errors` list.
[`issuesFrom`](/docs/http-apis/json-apis) in `@sdxc/problem` does this for Standard Schema
issues. Reach for `stringify` when the path is yours:

```typescript {% title="app/services/to-pointer.ts" %}
import { stringify } from "@sdxc/json-pointer";

export function toPointer(
	path: readonly (string | number | { key: string | number })[],
): string {
	return stringify(
		path.map((segment) => (typeof segment === "object" ? segment.key : segment)),
	);
}

toPointer([{ key: "users" }, { key: 0 }, "a/b"]); // "/users/0/a~1b"
```

A merge-patch `diff` that would set a member to a literal `null` fails with that member's
pointer on `UnrepresentableChangeError`. `@sdxc/json-schema` conversion errors and
`@sdxc/well-known` JSON document issues name the same locations.

## Where to go next

- [Build a JSON API with problem details](/docs/http-apis/json-apis) — `issuesFrom` writes
  these pointers onto a `422`.
- [Idempotent writes and JSON Merge Patch](/docs/http-apis/safe-writes) — a patch that cannot
  express a `null` names the member with a pointer.
- [Describe your API with OpenAPI](/docs/http-apis/openapi) — schema conversion failures
  point at the combinator that has no JSON Schema form.
- [`@sdxc/json-pointer`](/api/json-pointer) — every error type and the empty-pointer cases.
