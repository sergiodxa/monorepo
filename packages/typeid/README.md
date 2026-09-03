# @sdxc/typeid

Type-safe TypeID helpers for working with prefixed UUID strings.

## Overview

`@sdxc/typeid` wraps UUIDs in a small `TypeID` class so application code can keep the resource type close to the identifier itself. A `user` UUID becomes a string like `user_01h455vb4pex5vsknk084sn02q`, which is easier to route, log, and validate than a bare UUID.

The package follows the [TypeID specification](https://github.com/jetify-com/typeid/tree/main/spec) for prefix validation and Base32 suffix encoding. It supports parsing existing TypeID strings, generating new values from UUIDs, and converting a TypeID back to its UUID form.

## Usage

### Basic Example

```typescript
import { TypeID, typeid } from "@sdxc/typeid";
import { generateUUID } from "@sdxc/uuid";

let uuid = generateUUID();

let userId = TypeID.fromUUID("user", uuid);

userId.prefix;
// "user"

userId.toUUID();
// "550e8400-e29b-41d4-a716-446655440000"

userId.toString();
// "user_..."

let createPostId = typeid("post");
let postId = createPostId(generateUUID());
```

### Parse an Existing TypeID

```typescript
import { TypeID } from "@sdxc/typeid";

let value = TypeID.fromString("user_01h455vb4pex5vsknk084sn02q", "user");

let prefix = value.prefix;
let uuid = value.toUUID();
```

## API

### `TypeID<prefix>`

Represents a parsed or generated TypeID.

#### `new TypeID(prefix: prefix, suffix: Base32)`

Creates a TypeID from a validated prefix and Base32 suffix.

**Parameters:**

- `prefix`: The TypeID prefix, such as `user` or `post`
- `suffix`: The 26-character Base32 UUID suffix

#### `typeId.prefix`

The prefix stored in the TypeID.

**Returns:**

- The typed prefix string

#### `typeId.suffix`

The encoded Base32 suffix.

**Returns:**

- The 26-character TypeID suffix

#### `typeId.toUUID(): UUID`

Decodes the suffix back to a UUID string.

**Returns:**

- A UUID string

**Example:**

```typescript
import { TypeID } from "@sdxc/typeid";

let value = TypeID.fromString("user_01h455vb4pex5vsknk084sn02q");
let uuid = value.toUUID();
```

#### `typeId.toString(): string`

Serializes the TypeID back into its string form.

**Returns:**

- A TypeID string, with the prefix omitted only when the prefix is empty

**Example:**

```typescript
import { TypeID } from "@sdxc/typeid";

let value = TypeID.fromUUID("user", crypto.randomUUID());
let stringValue = value.toString();
```

### `TypeID.fromString<const prefix extends string>(value: string, prefix?: prefix): TypeID<prefix>`

Parses a TypeID string and optionally enforces the expected prefix.

**Parameters:**

- `value`: The incoming TypeID string
- `prefix`: Optional expected prefix to enforce during parsing

**Returns:**

- A `TypeID<prefix>` instance

**Example:**

```typescript
import { TypeID } from "@sdxc/typeid";

let value = TypeID.fromString("user_01h455vb4pex5vsknk084sn02q", "user");
```

### `TypeID.fromUUID<const prefix extends string>(prefix: prefix, uuid: UUID): TypeID<prefix>`

Builds a TypeID from an existing UUID.

**Parameters:**

- `prefix`: The prefix to apply to the TypeID
- `uuid`: The UUID to encode

**Returns:**

- A `TypeID<prefix>` instance

**Example:**

```typescript
import { TypeID } from "@sdxc/typeid";
import { generateUUID } from "@sdxc/uuid";

let value = TypeID.fromUUID("org", generateUUID());
```

### `TypeID.isValid<const prefix extends string>(value: string, prefix?: prefix): boolean`

Checks whether a string is a valid TypeID and optionally enforces a specific prefix.

**Parameters:**

- `value`: The incoming TypeID string
- `prefix`: Optional expected prefix to enforce during validation

**Returns:**

- `true` when the value is valid (and the prefix matches when provided), otherwise `false`

**Example:**

```typescript
import { TypeID } from "@sdxc/typeid";

TypeID.isValid("user_01h455vb4pex5vsknk084sn02q", "user");
// true

TypeID.isValid("user_01h455vb4pex5vsknk084sn02q", "org");
// false
```

### `typeid<prefix extends string>(prefix: prefix): (uuid: UUID) => TypeID<prefix>`

Creates a small factory for a single prefix.

**Parameters:**

- `prefix`: The prefix to lock into the returned factory

**Returns:**

- A function that accepts a UUID and returns a `TypeID<prefix>`

**Example:**

```typescript
import { typeid } from "@sdxc/typeid";
import { generateUUID } from "@sdxc/uuid";

let createInvoiceId = typeid("invoice");
let invoiceId = createInvoiceId(generateUUID());
```

### `@sdxc/typeid/errors`

The package also exports its TypeID-specific error classes from a dedicated entrypoint.

**Example:**

```typescript
import { InvalidPrefixError, TypeIdError } from "@sdxc/typeid/errors";

try {
	// ...parse or create TypeIDs
} catch (error) {
	if (error instanceof InvalidPrefixError) {
		// handle invalid prefix
	}

	if (error instanceof TypeIdError) {
		// handle any TypeID-related error
	}
}
```

## Patterns

## Pattern: Parse Route Params Early

Use `TypeID.fromString` near the edge of the application so the rest of the code receives a validated identifier.

```typescript
import { TypeID } from "@sdxc/typeid";
import type { Route } from "./+types/users.$userId";

export async function loader({ params }: Route.LoaderArgs) {
	let userId = TypeID.fromString(params.userId ?? "", "user");

	return {
		userId: userId.toUUID(),
	};
}
```

## Pattern: Create Prefix-Specific Factories

Use `typeid()` when one module creates many identifiers of the same type.

```typescript
import { typeid } from "@sdxc/typeid";
import { generateUUID } from "@sdxc/uuid";

let createUserId = typeid("user");
let createSessionId = typeid("session");

let userId = createUserId(generateUUID());
let sessionId = createSessionId(generateUUID());
```

## Pattern: Store UUIDs, Expose TypeIDs

Use TypeIDs at the boundaries of the system and plain UUIDs internally when your database already stores UUID columns.

```typescript
import { TypeID } from "@sdxc/typeid";

interface UserRecord {
	id: string;
	email: string;
}

function serializeUser(user: UserRecord) {
	return {
		id: TypeID.fromUUID("user", user.id).toString(),
		email: user.email,
	};
}
```

## Related Packages

- [`@sdxc/result`](/packages/result) - Wrap TypeID parsing in explicit success and failure values
- [`@sdxc/validate`](/packages/validate) - Validate request payloads before converting IDs into domain values
- [`@sdxc/response`](/packages/response) - Return parsed IDs from loaders and actions with typed response helpers
- [`@sdxc/uuid`](/packages/uuid) - Generate UUID values before converting them into TypeIDs

## Tips

1. **Parse at the boundary** - Convert incoming strings to `TypeID` values in loaders, actions, or request handlers instead of passing raw strings deeper into the app.
2. **Use factories for repeated prefixes** - `typeid("user")` keeps call sites short and avoids repeating prefix strings.
3. **Keep prefixes stable** - Changing a prefix changes the serialized identifier shape, which can break routes, APIs, and logs.
4. **Store UUIDs when possible** - TypeIDs are useful at the application boundary, but many databases and integrations still work best with plain UUIDs.
