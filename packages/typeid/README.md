# @sdxc/typeid

Type-safe TypeID values: a UUID and the prefix that names what it identifies.

A TypeID is one string carrying both halves of an identifier:
`user_01h455vb4pex5vsknk084sn02q` says which resource it points at and which UUID it stands
for, so a log line or a URL segment reads as the thing it identifies, and an id from the
wrong table stops being a lookup that silently finds nothing.

The encoding follows the
[TypeID specification](https://github.com/jetify-com/typeid/tree/main/spec), and values sort
the way the UUIDs behind them sort, so a UUIDv7 id stays time-ordered once it is prefixed.

## Installation

```bash
npm add @sdxc/typeid
```

UUIDs come from [`@sdxc/uuid`](https://www.npmjs.com/package/@sdxc/uuid), which installs
alongside this package: `generateUUID` produces the values `TypeID.fromUUID` takes, and
`toUUID()` hands them back.

## Usage

### Create One From A UUID

```typescript
import { TypeID } from "@sdxc/typeid";
import { generateUUID } from "@sdxc/uuid";

let userId = TypeID.fromUUID("user", generateUUID());

userId.prefix; // "user"
userId.toString(); // "user_01h455vb4pex5vsknk084sn02q"
userId.toUUID(); // "01890a5d-ac96-774b-bcce-b302099a8057"
```

The prefix is a literal type, so `userId` is a `TypeID<"user">` and a function that asks
for one refuses a `TypeID<"post">`.

### Parse One Back

```typescript
import { TypeID } from "@sdxc/typeid";

let userId = TypeID.fromString("user_01h455vb4pex5vsknk084sn02q", "user");

userId.prefix; // "user"
userId.suffix; // "01h455vb4pex5vsknk084sn02q"
userId.toUUID(); // "01890a5d-ac96-774b-bcce-b302099a8057"
```

The second argument is the prefix you expect. Passing it turns a `post_` id arriving where
a user id belongs into a `PrefixMismatchError` at the edge of the system, rather than a
query that returns nothing several layers deeper.

### Check A String Without Catching

```typescript
import { TypeID } from "@sdxc/typeid";

TypeID.isValid("user_01h455vb4pex5vsknk084sn02q", "user"); // true
TypeID.isValid("user_01h455vb4pex5vsknk084sn02q", "org"); // false
TypeID.isValid("user_nope"); // false
```

## Format Rules

**A prefix is lowercase ASCII letters and underscores, at most 63 characters**, and it
starts and ends with a letter. `User`, `user1` and `_user` are each an
`InvalidPrefixError`.

**The last underscore is the separator.** `user_profile_01h455vb4pex5vsknk084sn02q` parses
as the prefix `user_profile`, so a multi-word prefix needs no escaping.

**The suffix is exactly 26 Crockford Base32 characters**, drawn from
`0123456789abcdefghjkmnpqrstvwxyz` — no `i`, `l`, `o` or `u`, so the characters that look
alike cannot both appear. A suffix whose first character exceeds `7` would decode past 128
bits and is an `InvalidBase32StringError`.

**A prefix is optional.** A bare 26-character suffix parses with an empty prefix and
serializes back without a separator, which is how the specification writes an untyped id.

**Every parse failure is a `TypeIdError`**, so one `instanceof` check covers the whole
package while the individual classes say which rule was broken. A malformed UUID handed to
`TypeID.fromUUID` reports itself through the error classes of `@sdxc/uuid` instead, from
the layer that validated it.

## API

### `TypeID.fromUUID(prefix: prefix, uuid: UUID): TypeID<prefix>`

Encodes a UUID under a prefix. The `UUID` type comes from `@sdxc/uuid`, so a string that
was never validated as a UUID stops at the type level.

### `TypeID.fromString(value: string, prefix?: prefix): TypeID<prefix>`

Parses a TypeID string, throwing on any value the [format rules](#format-rules) refuse.
Passing `prefix` also requires the parsed prefix to match it.

### `TypeID.isValid(value: string, prefix?: prefix): boolean`

Whether `value` parses, and whether its prefix matches `prefix` when one is given. The
same checks as `fromString`, reported as a boolean.

### `new TypeID(prefix: prefix, suffix: Base32)`

Pairs a prefix with a suffix that is already encoded — the value `suffix` reports back.
Rebinding an existing id to another prefix is what this constructor is for; a UUID or a
string goes through `fromUUID` or `fromString`.

```typescript
let anonymousId = new TypeID("anon", userId.suffix);
```

### `typeId.prefix: prefix`

The prefix this value carries, typed as the literal it was created with.

### `typeId.suffix: Base32`

The 26-character Base32 suffix, without the prefix or separator.

### `typeId.toUUID(): UUID`

Decodes the suffix back to the canonical UUID string, which is the form a UUID column
stores.

### `typeId.toString(): string`

The canonical string, `prefix_suffix`. A value with an empty prefix serializes to the
suffix alone.

### `typeid(prefix: prefix): (uuid: UUID) => TypeID<prefix>`

Binds a prefix once and returns a function that encodes UUIDs under it, so call sites name
the factory instead of repeating the prefix string.

```typescript
let createUserId = typeid("user");

let userId = createUserId(generateUUID()); // TypeID<"user">
```

### Errors

The error classes ship from `@sdxc/typeid/errors`, and all of them extend `TypeIdError`.

```typescript
import { PrefixMismatchError, TypeIdError } from "@sdxc/typeid/errors";
```

#### `TypeIdError`

The base class for everything this package throws.

#### `InvalidPrefixError`

A prefix breaks the prefix rules. The message repeats the prefix that arrived.

#### `PrefixMismatchError`

A TypeID parsed cleanly but carries a different prefix than the one asked for. The message
names both.

#### `EmptyPrefixError`

A value carries a separator with nothing before it, such as `_01h455vb4pex5vsknk084sn02q`.

#### `MissingSeparatorError`

A value is longer than a bare suffix yet has no separator, so a prefix was intended and
lost.

#### `InvalidSuffixLengthError`

A suffix is not 26 characters. The message names the length that arrived.

#### `InvalidBase32CharacterError`

A suffix contains a character outside the Base32 alphabet, such as the `i` that an `l`
often becomes when an id is retyped.

#### `InvalidBase32StringError`

A suffix is 26 valid characters yet decodes past 128 bits, so no UUID can hold it.

## Pattern: Parse At The Boundary

Convert the string into a `TypeID` where the request arrives, and everything deeper
receives a value whose prefix has already been checked:

```typescript
import { TypeID } from "@sdxc/typeid";

export async function GET(request: Request) {
	let { pathname } = new URL(request.url);
	let segment = pathname.split("/").at(-1) ?? "";

	if (!TypeID.isValid(segment, "user")) {
		return new Response("Not found", { status: 404 });
	}

	let user = await findUser(TypeID.fromString(segment, "user").toUUID());

	return Response.json(user);
}
```

`isValid` answers the routing question and `fromString` produces the value, so a wrong
prefix becomes a `404` instead of a query for an id that belongs to another table.

## Pattern: One Factory Per Resource

A module of prefix-bound factories keeps every prefix string in one file, and each factory
returns its own type:

```typescript
import { typeid } from "@sdxc/typeid";
import { generateUUID } from "@sdxc/uuid";

export let createUserId = typeid("user");
export let createSessionId = typeid("session");
export let createInvoiceId = typeid("invoice");

let userId = createUserId(generateUUID()); // TypeID<"user">
let sessionId = createSessionId(generateUUID()); // TypeID<"session">
```

Because the return types differ, a function that takes a `TypeID<"user">` rejects a
session id before the code runs.

## Pattern: Store UUIDs, Serve TypeIDs

A UUID column stays a UUID column. The prefix is applied on the way out and stripped on
the way in, so the database keeps its native type while every id the outside world sees
says what it is:

```typescript
import { TypeID } from "@sdxc/typeid";
import type { UUID } from "@sdxc/uuid";

interface UserRow {
	id: UUID;
	email: string;
}

function serialize(user: UserRow) {
	return { id: TypeID.fromUUID("user", user.id).toString(), email: user.email };
}

function deserialize(id: string): UUID {
	return TypeID.fromString(id, "user").toUUID();
}
```

The pair is symmetric, so an id that made a round trip through a client comes back as the
same UUID it left as.

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
		"@sdxc/typeid": "2026.9.4"
	}
}
```

A caret or tilde range reads the date as major, minor and patch, so it accepts every
later release in the same year. An exact version keeps the upgrade yours to schedule.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
