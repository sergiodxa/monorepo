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

A string that does not start with `/`, or holds a `~` not followed by `0` or `1`, fails.

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

## Write a value

`set` returns a new tree, and the empty pointer replaces the document. `undefined` has no
JSON form, so setting it fails.

> [!NOTE]
> `set` assigns at an existing parent: every token before the last must already resolve, so
> `set({}, "/a/b", 1)` fails. Write the missing parents first, one `set` per level, when a path
> may not exist yet.

```typescript {% title="app/services/write-field.ts" %}
import { set } from "@sdxc/json-pointer";
import { isFailure, unwrap } from "@sdxc/result";

unwrap(set({ a: { b: 1 } }, "/a/b", 2)); // { a: { b: 2 } }
unwrap(set({ a: 1 }, "/b", 2)); // { a: 1, b: 2 }

let missing = set({}, "/a/b", 1);
isFailure(missing); // true
```

The original document is left unchanged.

## Name a validation issue

A problem's `errors` entries point at the member each issue is about. `issuesFrom` in
[`@sdxc/problem`](/docs/http-apis/json-apis) writes them for schema issues, and `toPointer`
does it for an issue you raise yourself. Here a book's `labels` are keyed by names the user
chose, so a label may hold a `/`:

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

`toPointer` takes a Standard Schema issue path; for plain strings and numbers, `stringify`
gives the same pointer.

## Test the pointer

The case worth pinning is a label whose name holds the separator:

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
- [Accept JSON Patch updates](/docs/http-apis/json-patch) — every patch operation aims at a
  pointer.
- [`@sdxc/json-pointer`](/api/json-pointer) — every error type and the empty-pointer cases.
