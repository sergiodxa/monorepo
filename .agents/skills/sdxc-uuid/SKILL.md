---
name: sdxc-uuid
description: "@sdxc/uuid validates, asserts and generates UUIDs behind a branded `UUID` type, so a checked identifier cannot be confused with the raw string it came from. Use when a UUID arrives as a path segment, query parameter or form field and every layer below re-checks it, when you want `isUUID`/`assertUUID` narrowing instead of a cast, or when generating a v4 identifier with `generateUUID`."
---

# @sdxc/uuid

A UUID reaches your code as a `string`, and every layer below re-checks it because the type says nothing. This package checks once and hands back a `UUID`: the same string carrying proof of the check in its type. The surface is four exports — the `UUID` type, `isUUID`, `assertUUID`, `generateUUID` — plus three error classes (`InvalidUUIDTypeError`, `InvalidUUIDLengthError`, `InvalidUUIDFormatError`). It has no dependencies and runs on any runtime with `crypto.randomUUID()`.

Full API, options and examples: [packages/uuid/README.md](packages/uuid/README.md)

## When to reach for it

- An identifier arrives as text at a request boundary and the functions below it should be able to ask for a `UUID` rather than re-validating a `string`.
- A form field or query parameter may be wrong, and you want a branch rather than a throw.
- You need a new random identifier and want it typed without a cast.
- An error message has to distinguish a truncated identifier from one in the wrong shape.

## Using it

Declare the workspace dependency, then import:

```json
{ "dependencies": { "@sdxc/uuid": "workspace:*" } }
```

```ts
import type { UUID } from "@sdxc/uuid";

import { assertUUID, generateUUID, isUUID } from "@sdxc/uuid";

let id = generateUUID(); // UUID, from crypto.randomUUID()

if (isUUID(value)) {
	// value is UUID here
}

function readAccountId(value: string) {
	assertUUID(value);
	return value; // typed UUID from here on
}
```

## Suggestions

- Narrow once at the edge and type the signatures underneath as `UUID`; `assertUUID` suits a boundary where an invalid value should stop the request, `isUUID` suits a value a person can get wrong.
- Only lowercase `8-4-4-4-12` hex passes: uppercase and the brace-wrapped form both fail, so stored and compared identifiers have one spelling. The check is about format, not about which UUID version produced the value.
- The length check runs before the shape check, so a truncated identifier reports `InvalidUUIDLengthError` instead of reading as malformed.

## Related

- `@sdxc/typeid` — takes a `UUID` and a prefix and encodes them as one sortable, self-describing identifier; skill `sdxc-typeid`
