---
title: Address JSON with JSON Pointer
description: Parse, stringify, get and set RFC 6901 JSON Pointers, so a member named a/b still points at itself in a problem, a schema path or a patch.
section:
    title: HTTP APIs
    order: 5
order: 6
lastUpdated: 2026-10-25
outcomes:
    - "How to parse and stringify RFC 6901 pointers with `@sdxc/json-pointer`"
    - "How to read and write a value at a pointer"
    - "How to name a validation issue so a member called `a/b` still points at itself"
---

A JSON Pointer names a value inside a JSON document as a `/`-separated path. A member
named `a/b` is written `/a~1b`, and a `~` in a name is written `~0`, so the pointer still
points at that member. The empty string is the whole document.

[`@sdxc/json-pointer`](/api/json-pointer) is that encoding. Fallible calls return a
[`@sdxc/result`](/api/result), so a missing path is a branch rather than `undefined`.
[`@sdxc/problem`](/api/problem) writes the same pointers onto validation issues, and
[`@sdxc/merge-patch`](/api/merge-patch) names the member a patch cannot express.
[`@sdxc/json-patch`](/api/json-patch) aims every operation at a pointer, and each node
[`@sdxc/jsonpath`](/api/jsonpath) selects carries a location that `stringify` turns into one.

```bash
npm add @sdxc/json-pointer @sdxc/problem @sdxc/result
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
import { isFailure, unwrap } from "@sdxc/result";

let document = { foo: ["bar", "baz"], "a/b": 1 };

unwrap(get(document, "/foo/0")); // "bar"
unwrap(get(document, "/a~1b")); // 1

let missing = get(document, "/foo/9");
isFailure(missing); // true
```

The empty pointer is the document itself. Use it when a problem's `pointer` is `""` and the
issue is about the whole body.

## Write a value

`set` returns a new tree, and the empty pointer replaces the document. `undefined` has no
JSON form, so setting it fails.

<note>
`set` assigns at an existing parent: every token before the last must already resolve, so
`set({}, "/a/b", 1)` fails. Write the missing parents first, one `set` per level, when a path
may not exist yet.
</note>

```typescript {% title="app/services/write-field.ts" %}
import { set } from "@sdxc/json-pointer";
import { isFailure, unwrap } from "@sdxc/result";

unwrap(set({ a: { b: 1 } }, "/a/b", 2)); // { a: { b: 2 } }
unwrap(set({ a: 1 }, "/b", 2)); // { a: 1, b: 2 }

let missing = set({}, "/a/b", 1);
isFailure(missing); // true
```

A key named `__proto__` is stored as data. The original document is left unchanged.

## Name a validation issue

A problem's `errors` entries point at the member each issue is about. `issuesFrom` in
[`@sdxc/problem`](/docs/http-apis/json-apis) writes those pointers for the issues a schema
reports, and `toPointer` from the same package does it for an issue you raise yourself, such
as a check that needs the database. Both escape every segment, so a member named `a/b` still
points at itself.

Here a book's `labels` object is keyed by names the user chose, so a label may hold a `/`:

```typescript {% title="app/services/books/label-issues.ts" %}
import type { ProblemIssue } from "@sdxc/problem";

import { toPointer } from "@sdxc/problem";

export function unknownLabelIssue(label: string): ProblemIssue {
	return {
		pointer: toPointer(["labels", label]),
		code: "unknown-label",
		message: `No shelf is named ${label}.`,
	};
}
```

`toPointer` takes a Standard Schema issue path, so segments may be keys or `{ key }`
objects. When the path is plain strings and numbers, `stringify` from `@sdxc/json-pointer`
gives the same pointer.

A merge-patch `diff` that would set a member to a literal `null` fails with that member's
pointer on `UnrepresentableChangeError`. `@sdxc/json-schema` conversion errors and
`@sdxc/well-known` JSON document issues name the same locations.

## Test the pointer

The case worth pinning is the label whose name holds the separator: the pointer the issue
carries must resolve to that label in the body the client sent.

```typescript {% title="app/services/books/label-issues.test.ts" %}
import { get } from "@sdxc/json-pointer";
import { unwrap } from "@sdxc/result";
import { expect, test } from "vitest";

import { unknownLabelIssue } from "~/app/services/books/label-issues";

test("a label named sci-fi/classic still points at itself", () => {
	let body = { title: "Kindred", labels: { "sci-fi/classic": true } };
	let issue = unknownLabelIssue("sci-fi/classic");

	expect(issue.pointer).toBe("/labels/sci-fi~1classic");
	expect(unwrap(get(body, issue.pointer))).toBe(true);
});
```

## Where to go next

- [Build a JSON API with problem details](/docs/http-apis/json-apis) — `issuesFrom` writes
  these pointers onto a `422`.
- [Idempotent writes and JSON Merge Patch](/docs/http-apis/safe-writes) — a patch that cannot
  express a `null` names the member with a pointer.
- [`@sdxc/json-pointer`](/api/json-pointer) — every error type and the empty-pointer cases.
