# @sdxc/typeid

Type-safe TypeID values: a UUID and the prefix that names what it identifies.

A TypeID such as `user_01h455vb4pex5vsknk084sn02q` carries both the resource it points at and
the UUID it stands for. The encoding follows the
[TypeID specification](https://github.com/jetify-com/typeid/tree/main/spec), and values sort the
way their UUIDs sort, so a UUIDv7 id stays time-ordered once it is prefixed.

## Installation

```sh
npm add @sdxc/typeid
```

UUIDs come from [`@sdxc/uuid`](https://www.npmjs.com/package/@sdxc/uuid), which installs
alongside this package.

## Usage

### Create one from a UUID

```typescript
import { TypeID } from "@sdxc/typeid";
import { generateUUID } from "@sdxc/uuid/v7";

let userId = TypeID.fromUUID("user", generateUUID());

userId.prefix; // "user"
userId.toString(); // "user_01h455vb4pex5vsknk084sn02q"
userId.toUUID(); // "01890a5d-ac96-774b-bcce-b302099a8057"
```

The prefix is a literal type, so `userId` is a `TypeID<"user">` and a function asking for one
rejects a `TypeID<"post">`.

### Parse one back

```typescript
import { TypeID } from "@sdxc/typeid";

let userId = TypeID.fromString("user_01h455vb4pex5vsknk084sn02q", "user");

userId.suffix; // "01h455vb4pex5vsknk084sn02q"
userId.toUUID(); // "01890a5d-ac96-774b-bcce-b302099a8057"
```

The second argument is the prefix you expect; a `post_` id passed here throws a
`PrefixMismatchError`.

### Check a string without catching

```typescript
import { TypeID } from "@sdxc/typeid";

TypeID.isValid("user_01h455vb4pex5vsknk084sn02q", "user"); // true
TypeID.isValid("user_01h455vb4pex5vsknk084sn02q", "org"); // false
TypeID.isValid("user_nope"); // false
```

### Tell the failures apart

```typescript
import { TypeID } from "@sdxc/typeid";
import { PrefixMismatchError, TypeIdError } from "@sdxc/typeid/errors";

try {
	TypeID.fromString(input, "user");
} catch (error) {
	if (error instanceof PrefixMismatchError) {
		// a valid id for another resource
	} else if (error instanceof TypeIdError) {
		// a malformed id
	}
}
```

## API

### `TypeID.fromUUID(prefix: prefix, uuid: UUID): TypeID<prefix>`

Encodes a UUID under a prefix. `UUID` is the validated string type from `@sdxc/uuid`.

### `TypeID.fromString(value: string, prefix?: prefix): TypeID<prefix>`

Parses a TypeID string and throws a `TypeIdError` subclass on any value that breaks the format;
passing `prefix` also requires the parsed prefix to match it. The format:

- A prefix is lowercase ASCII letters and underscores, at most 63 characters, starting and ending
  with a letter.
- The last underscore is the separator, so `user_profile_01h455vb4pex5vsknk084sn02q` has the
  prefix `user_profile`.
- The suffix is exactly 26 characters of Crockford Base32 (`0123456789abcdefghjkmnpqrstvwxyz`)
  that decode to at most 128 bits.
- A bare 26-character suffix parses with an empty prefix.

### `TypeID.isValid(value: string, prefix?: prefix): boolean`

The same checks as `fromString`, answered as a boolean.

### `new TypeID(prefix: prefix, suffix: Base32)`

Pairs a prefix with the suffix of an existing TypeID, which rebinds that id to another prefix.
Throws `InvalidPrefixError` for a prefix that breaks the rules.

### `typeId.prefix` and `typeId.suffix`

The prefix, typed as the literal it was created with, and the 26-character Base32 suffix.

### `typeId.toUUID(): UUID`

Decodes the suffix back to the canonical UUID string.

### `typeId.toString(): string`

The canonical `prefix_suffix` string; a value with an empty prefix serializes to the suffix
alone.

### `typeid(prefix: prefix): (uuid: UUID) => TypeID<prefix>`

Binds a prefix once and returns a function that encodes UUIDs under it.

### Errors from `./errors`

Every class extends `TypeIdError`, so one `instanceof` check covers the package.

| Class                         | Thrown when                                                             |
| ----------------------------- | ----------------------------------------------------------------------- |
| `InvalidPrefixError`          | A prefix breaks the prefix rules                                        |
| `PrefixMismatchError`         | The parsed prefix differs from the expected one; the message names both |
| `EmptyPrefixError`            | A separator has nothing before it, as in `_01h455vb4pex5vsknk084sn02q`  |
| `MissingSeparatorError`       | A value is longer than a bare suffix and has no separator               |
| `InvalidSuffixLengthError`    | A suffix is not 26 characters                                           |
| `InvalidBase32CharacterError` | A suffix contains a character outside the Base32 alphabet               |
| `InvalidBase32StringError`    | A suffix decodes past 128 bits                                          |

A malformed UUID handed to `fromUUID` throws the error classes of `@sdxc/uuid`.

## Pattern: Parse At The Boundary

Convert the path segment into a `TypeID` where the request arrives, so everything deeper receives
an id whose prefix is already checked and an id for another resource answers `404`.

```typescript
import { TypeID } from "@sdxc/typeid";

export async function handleUser(request: Request) {
	let segment = new URL(request.url).pathname.split("/").at(-1) ?? "";

	if (!TypeID.isValid(segment, "user")) {
		return new Response("Not found", { status: 404 });
	}

	let user = await findUser(TypeID.fromString(segment, "user").toUUID());
	return Response.json(user);
}
```

## Pattern: One Factory Per Resource

A module of prefix-bound factories keeps every prefix string in one file, and each factory
returns its own type.

```typescript
import type { TypeID } from "@sdxc/typeid";

import { typeid } from "@sdxc/typeid";
import { generateUUID } from "@sdxc/uuid/v7";

export let createUserId = typeid("user");
export let createSessionId = typeid("session");

function revokeSessions(userId: TypeID<"user">) {
	// ...
}

revokeSessions(createUserId(generateUUID())); // compiles
revokeSessions(createSessionId(generateUUID())); // type error
```

## Pattern: Store UUIDs, Serve TypeIDs

The database keeps a native UUID column; the prefix is applied on the way out and stripped on the
way in, and the round trip returns the same UUID.

```typescript
import type { UUID } from "@sdxc/uuid";

import { TypeID } from "@sdxc/typeid";

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

## Pattern: One UUID Under Several Prefixes

The constructor moves an existing id to another prefix while keeping its UUID, for a record that
is exposed as more than one kind of resource.

```typescript
import { TypeID } from "@sdxc/typeid";

let userId = TypeID.fromString("user_01h455vb4pex5vsknk084sn02q", "user");
let authorId = new TypeID("author", userId.suffix);

authorId.toString(); // "author_01h455vb4pex5vsknk084sn02q"
authorId.toUUID() === userId.toUUID(); // true
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
