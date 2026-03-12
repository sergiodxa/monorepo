# @pkg/uuid

Type-safe UUID helpers for validation, assertion, and generation.

## Overview

`@pkg/uuid` provides a small set of primitives for working with UUID values as domain identifiers. It includes a branded `UUID` type, a runtime guard (`isUUID`), an assertion helper (`assertUUID`), and a generation helper (`generateUUID`).

The package is intentionally minimal so it can be used across loaders, actions, services, and shared libraries without pulling in extra dependencies. It relies on the platform `crypto.randomUUID()` API and the standard UUID string format.

## Usage

### Basic Example

```typescript
import { assertUUID, generateUUID, isUUID } from "@pkg/uuid";

let id = generateUUID();

if (isUUID(id)) {
	// id is narrowed to UUID
}

let input = "550e8400-e29b-41d4-a716-446655440000";
assertUUID(input);

// input is now typed as UUID
let userId = input;
```

### Validate Request Parameters

```typescript
import { assertUUID } from "@pkg/uuid";
import type { Route } from "./+types/users.$userId";

export async function loader({ params }: Route.LoaderArgs) {
	let userId = params.userId ?? "";
	assertUUID(userId);

	return { userId };
}
```

## API

### `UUID`

Branded string type for validated UUID values.

```typescript
type UUID = string & { __brand: "UUID" };
```

### `isUUID(value: string): value is UUID`

Checks whether a string matches the UUID format.

**Parameters:**

- `value`: The string to validate

**Returns:**

- `true` when the string is a UUID; otherwise `false`

**Example:**

```typescript
import { isUUID } from "@pkg/uuid";

let value = "550e8400-e29b-41d4-a716-446655440000";

if (isUUID(value)) {
	// value is UUID
}
```

### `assertUUID(value: string): asserts value is UUID`

Asserts that a string is a UUID and narrows its type.

**Parameters:**

- `value`: The string to validate

**Returns:**

- No return value; throws `TypeError` when invalid

**Example:**

```typescript
import { assertUUID } from "@pkg/uuid";

let value = "550e8400-e29b-41d4-a716-446655440000";
assertUUID(value);

// value is UUID
```

### `generateUUID(): UUID`

Generates a new UUID using `crypto.randomUUID()`.

**Returns:**

- A newly generated UUID value

**Example:**

```typescript
import { generateUUID } from "@pkg/uuid";

let id = generateUUID();
```

## Patterns

## Pattern: Validate at the Application Boundary

Validate route params, form values, or API inputs early so deeper layers receive typed IDs.

```typescript
import { assertUUID } from "@pkg/uuid";

interface UserInput {
	userId: string;
}

function parseInput(input: UserInput) {
	assertUUID(input.userId);

	return {
		userId: input.userId,
	};
}
```

## Pattern: Use Type Guards for Conditional Flows

Use `isUUID` when invalid values should be handled without exceptions.

```typescript
import { isUUID } from "@pkg/uuid";
import { err, ok, type Result } from "@pkg/result";

function parseUserId(value: string): Result<{ userId: string }, { message: string }> {
	if (!isUUID(value)) {
		return err({ message: "Invalid user id" });
	}

	return ok({ userId: value });
}
```

## Related Packages

- [`@pkg/result`](/packages/result) - Represent validation outcomes as explicit success and failure values
- [`@pkg/validate`](/packages/validate) - Validate request payloads before narrowing IDs to UUID
- [`@pkg/typeid`](/packages/typeid) - Build prefixed identifiers from UUID values

## Tips

1. **Validate early** - Narrow values to `UUID` near the edge of the system to reduce repeated checks in downstream code.
2. **Use `assertUUID` for required IDs** - Assertions keep function signatures simple when invalid data should fail fast.
3. **Use `isUUID` for recoverable flows** - Guards are better when invalid input should return a typed error instead of throwing.
4. **Keep identifiers as UUID in domain logic** - Normalize once, then pass typed IDs through services and repositories.
