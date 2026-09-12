# @sdxc/uuid

Validate, assert and generate UUIDs behind a branded UUID type.

A UUID reaches your code as a `string`, and every layer below re-checks it because the type
says nothing. This package checks once and hands back a `UUID`: the same string, carrying
proof of the check in its type, so a function that asks for a `UUID` cannot be handed the
raw path segment it came from.

## Installation

```bash
npm add @sdxc/uuid
```

`generateUUID` calls the platform's
[`crypto.randomUUID()`](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID).
[`@sdxc/typeid`](https://www.npmjs.com/package/@sdxc/typeid) installs alongside it when you
want prefixed identifiers built on these values.

## Usage

### Generate An Identifier

```typescript
import { generateUUID } from "@sdxc/uuid";

let id = generateUUID();
// "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d" as UUID
```

The longhand is `crypto.randomUUID()` followed by the check that brands its result, which is
what lets the value flow into anything typed as `UUID` without a cast.

### Narrow A String You Received

```typescript
import { isUUID } from "@sdxc/uuid";

let value = "550e8400-e29b-41d4-a716-446655440000";

if (isUUID(value)) {
	// value is UUID here
}
```

A value passes when it is a string of exactly 36 characters shaped `8-4-4-4-12` in lowercase
hex. Uppercase and the brace-wrapped form both fail, so the identifiers you store and compare
have one spelling. The version and variant digits are read as hex like any other, so the
check is about the format rather than which UUID version produced it.

### Assert At A Boundary

```typescript
import { assertUUID } from "@sdxc/uuid";

function readAccountId(value: string) {
	assertUUID(value);
	return value; // typed UUID from here on
}
```

`assertUUID` throws rather than returning, which suits the edge of a system: the value is an
identifier or the request stops here.

### Tell The Failures Apart

```typescript
import {
	assertUUID,
	InvalidUUIDFormatError,
	InvalidUUIDLengthError,
	InvalidUUIDTypeError,
} from "@sdxc/uuid";

try {
	assertUUID(value);
} catch (error) {
	if (error instanceof InvalidUUIDTypeError) {
		// something other than a string arrived
	}

	if (error instanceof InvalidUUIDLengthError) {
		// a string of the wrong length: "Invalid UUID length: 10"
	}

	if (error instanceof InvalidUUIDFormatError) {
		// 36 characters in the wrong shape
	}
}
```

Three classes rather than one message, so a truncated identifier and a mistyped one are
distinguishable when you decide what to answer.

## API

### `UUID`

The UUID string type, branded. A plain `string` is not assignable to it, and a `UUID` is
assignable anywhere a `string` is, so the brand costs nothing at the call sites that only
read the value.

### `isUUID(value: string): value is UUID`

Reports whether a string is a UUID, narrowing it to `UUID` inside the branch that takes it.
Use it where an invalid value is an outcome you handle.

### `assertUUID(value: string): asserts value is UUID`

Narrows a string to `UUID` for the rest of the enclosing scope, throwing when it is not one:
`InvalidUUIDTypeError` for a non-string, `InvalidUUIDLengthError` for a string that is not 36
characters, and `InvalidUUIDFormatError` for 36 characters in the wrong shape.

### `generateUUID(): UUID`

Returns a new random UUID from `crypto.randomUUID()`, already narrowed to `UUID`. That is a
version 4 UUID as defined by [RFC 9562](https://www.rfc-editor.org/rfc/rfc9562), random in
every position the format leaves free.

### Errors

#### `InvalidUUIDTypeError`

Validation received something that is not a string. The message names the runtime type that
arrived, as in `Expected a string, got object`.

#### `InvalidUUIDLengthError`

A string of the wrong length, reported as `Invalid UUID length: 10`. The check runs before
the shape check, so a truncated identifier says so instead of reading as malformed.

#### `InvalidUUIDFormatError`

A 36-character string that is not lowercase `8-4-4-4-12` hex. The message repeats the value
that failed, as in `Invalid UUID format: 550e8400_e29b_41d4_a716_446655440000`.

## Pattern: Narrowing Once At The Edge

An identifier arrives as text — a path segment, a query parameter, a form field — and every
function under the handler wants it typed. Assert it where it enters, and the signatures
below can ask for a `UUID` and be sure they have one:

```typescript
import type { UUID } from "@sdxc/uuid";

import { assertUUID } from "@sdxc/uuid";

export async function GET(request: Request) {
	let accountId = new URL(request.url).pathname.split("/").at(-1) ?? "";
	assertUUID(accountId);

	return Response.json(await loadAccount(accountId));
}

async function loadAccount(accountId: UUID) {
	// no re-validation: the type already carries the check
}
```

The throw is the point: an identifier that never validated never reaches the query.

## Pattern: Branching Instead Of Throwing

A form field is a value a person can get wrong, which makes an exception the wrong shape for
the answer. `isUUID` gives you the same narrowing in an expression you can branch on:

```typescript
import type { UUID } from "@sdxc/uuid";

import { isUUID } from "@sdxc/uuid";

function readAccountId(input: FormData): { ok: true; accountId: UUID } | { ok: false } {
	let value = input.get("accountId");
	if (typeof value !== "string" || !isUUID(value)) return { ok: false };
	return { ok: true, accountId: value };
}
```

`isUUID` is `assertUUID` with the throw turned into a `false`, so the two agree on exactly
which strings are identifiers.

## Pattern: Prefixed Identifiers

A UUID says nothing about what it identifies, which is why an identifier pasted into a bug
report is so hard to place. [`@sdxc/typeid`](https://www.npmjs.com/package/@sdxc/typeid)
takes a `UUID` and a prefix and encodes them as one sortable, self-describing string:

```typescript
import { TypeID } from "@sdxc/typeid";
import { generateUUID } from "@sdxc/uuid";

let accountId = TypeID.fromUUID("account", generateUUID());

accountId.toString();
// "account_01h455vb4pex5vsknk084sn02q"
```

It asks for a `UUID` rather than a `string`, so the value you generate here is accepted and a
random 36 characters is not.

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
		"@sdxc/uuid": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
