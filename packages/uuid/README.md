# @sdxc/uuid

Validate and assert UUIDs behind a branded UUID type, and generate v4 or v7 values.

A `UUID` is the same string, carrying proof of the check in its type: validate once where the
value enters, and every function below can ask for a `UUID` instead of re-checking a `string`.

## Installation

```sh
npm add @sdxc/uuid
```

The generators use the platform's Web Crypto API, available in browsers, Node, Bun, Deno and
Cloudflare Workers.

## Usage

### Generate an identifier

Each UUID version is its own entry point exporting the same `generateUUID()`, so the import
path picks the version.

```typescript
import { generateUUID } from "@sdxc/uuid/v7";

let id = generateUUID();
// "019a6f3e-5c21-7a4b-9d3e-8f1a2b3c4d5e", typed UUID
```

A v7 value starts with its creation time, so values sort in the order they were generated.
Import from `@sdxc/uuid/v4` for a fully random value that reveals nothing:

```typescript
import { generateUUID } from "@sdxc/uuid/v4";

let id = generateUUID();
// "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d", typed UUID
```

### Check a string you received

```typescript
import { isUUID } from "@sdxc/uuid";

let value = "550e8400-e29b-41d4-a716-446655440000";

if (isUUID(value)) {
	// value is UUID here
}
```

A UUID is exactly 36 characters of lowercase hex shaped `8-4-4-4-12`, so stored identifiers
have one spelling. Any version passes.

### Assert and tell the failures apart

`assertUUID` narrows the value for the rest of the scope, or throws one of three error classes.

```typescript
import {
	assertUUID,
	InvalidUUIDFormatError,
	InvalidUUIDLengthError,
	InvalidUUIDTypeError,
} from "@sdxc/uuid";

try {
	assertUUID(value);
	// value is UUID from here on
} catch (error) {
	if (error instanceof InvalidUUIDTypeError) {
		// not a string: "Expected a string, got object"
	} else if (error instanceof InvalidUUIDLengthError) {
		// wrong length: "Invalid UUID length: 10"
	} else if (error instanceof InvalidUUIDFormatError) {
		// 36 characters in the wrong shape
	}
}
```

## API

### `isUUID(value: string): value is UUID`

Returns `true` when the value is a lowercase `8-4-4-4-12` hex string, narrowing it to `UUID`.
Accepts exactly the values `assertUUID` accepts.

### `assertUUID(value: string): asserts value is UUID`

Narrows the value to `UUID`, or throws `InvalidUUIDTypeError` for a non-string,
`InvalidUUIDLengthError` for a length other than 36, and `InvalidUUIDFormatError` otherwise.

### `generateUUID(): UUID` from `@sdxc/uuid/v7`

Returns a version 7 UUID ([RFC 9562](https://www.rfc-editor.org/rfc/rfc9562)): a 48-bit
millisecond timestamp, a 12-bit counter and 62 random bits. Each value sorts after the previous
one from the same process, including within one millisecond. Anyone holding the value can read
its creation time.

### `generateUUID(): UUID` from `@sdxc/uuid/v4`

Returns a version 4 UUID from `crypto.randomUUID()`: 122 random bits, with no ordering and no
creation time.

### `InvalidUUIDTypeError`

Thrown for a non-string; the message names the type received.

### `InvalidUUIDLengthError`

Thrown for a string that is not 36 characters; the message names the length.

### `InvalidUUIDFormatError`

Thrown for 36 characters that are not lowercase `8-4-4-4-12` hex; the message repeats the value.

### Types

#### `UUID`

A branded UUID string. A plain `string` must pass `isUUID` or `assertUUID` to become one, and a
`UUID` is usable anywhere a `string` is.

## Pattern: Narrow Once At The Edge

Assert an identifier where it enters a request handler, and the functions below take a `UUID`
without re-validating.

```typescript
import type { UUID } from "@sdxc/uuid";

import { assertUUID, InvalidUUIDLengthError, InvalidUUIDFormatError } from "@sdxc/uuid";

export async function handler(request: Request) {
	let accountId = new URL(request.url).pathname.split("/").at(-1) ?? "";

	try {
		assertUUID(accountId);
	} catch (error) {
		if (error instanceof InvalidUUIDLengthError || error instanceof InvalidUUIDFormatError) {
			return new Response("Not Found", { status: 404 });
		}
		throw error;
	}

	return Response.json(await loadAccount(accountId));
}

async function loadAccount(accountId: UUID) {
	return { id: accountId };
}
```

## Pattern: Validate A Form Field Without Throwing

A person can mistype a field, so branch on `isUUID` and answer with a result.

```typescript
import type { UUID } from "@sdxc/uuid";

import { isUUID } from "@sdxc/uuid";

function readAccountId(form: FormData): { ok: true; accountId: UUID } | { ok: false } {
	let value = form.get("accountId");
	if (typeof value !== "string" || !isUUID(value)) return { ok: false };
	return { ok: true, accountId: value };
}
```

## Pattern: Time-Ordered Record Ids

Use v7 for primary keys: new rows append to the end of the index, and sorting by id sorts by
creation, so the last id of a page is enough of a cursor for the next one.

```typescript
import type { UUID } from "@sdxc/uuid";

import { generateUUID } from "@sdxc/uuid/v7";

interface Note {
	id: UUID;
	body: string;
}

let notes: Note[] = [];

function createNote(body: string): Note {
	let note = { id: generateUUID(), body };
	notes.push(note);
	return note;
}

function notesAfter(cursor: UUID | null, limit: number) {
	return notes.filter((note) => cursor === null || note.id > cursor).slice(0, limit);
}
```

Reach for `@sdxc/uuid/v4` when an identifier must not reveal when it was created, such as a
public share id.

## Pattern: Prefixed Identifiers

[`@sdxc/typeid`](https://www.npmjs.com/package/@sdxc/typeid) takes a `UUID` and a prefix and
encodes them as one self-describing string that keeps the v7 sort order.

```typescript
import { TypeID } from "@sdxc/typeid";
import { generateUUID } from "@sdxc/uuid/v7";

let accountId = TypeID.fromUUID("account", generateUUID());

accountId.toString();
// "account_01h455vb4pex5vsknk084sn02q"
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
