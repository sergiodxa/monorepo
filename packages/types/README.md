# @pkg/types

Shared TypeScript utility types for the monorepo.

## Overview

This package provides reusable TypeScript utility types that are useful across multiple applications in the monorepo. It focuses on type-level utilities that improve type inference and reduce boilerplate when working with async functions, promises, and complex type transformations.

## Usage

### Extracting Resolved Types from Async Functions

```typescript
import type { ResolvedType } from "@pkg/types";

async function fetchUser(id: string): Promise<{ name: string; email: string }> {
	// ...
}

// Extract the resolved type without calling the function
type User = ResolvedType<typeof fetchUser>; // { name: string; email: string }
```

### Typing Component Props from Loader Data

```typescript
import type { ResolvedType } from "@pkg/types";

import type { getHttpMonitorsData } from "./query.server";

interface Props {
	httpData: ResolvedType<typeof getHttpMonitorsData>;
}

export function HttpMonitorsCard(props: Props) {
	// props.httpData is fully typed
}
```

## API

### `JSONValue`

Represents any JSON-serializable value. This includes primitives (`string`, `number`, `boolean`, `null`), arrays of JSON values, and plain objects with string keys and JSON values.

**Example:**

```typescript
import type { JSONValue } from "@pkg/types";

let obj: JSONValue = { name: "John", age: 30 };
let arr: JSONValue = [1, "two", { three: 3 }];
let str: JSONValue = "hello";
let num: JSONValue = 42;
let bool: JSONValue = true;
let nil: JSONValue = null;
```

### `ResolvedType<T>`

Extracts the resolved type from an async function's return type. Combines `Awaited` and `ReturnType` utilities to unwrap both the function return type and the Promise.

**Type Parameters:**

- `T`: An async function type `(...args: any) => Promise<any>`

**Returns:**

- The unwrapped type that the Promise resolves to

**Example:**

```typescript
import type { ResolvedType } from "@pkg/types";

async function getData(): Promise<{ items: string[] }> {
	return { items: [] };
}

type Data = ResolvedType<typeof getData>;
// Data = { items: string[] }
```

## Pattern: Typing Streamed Loader Data

When using React Router's streaming with `<Await>`, use `ResolvedType` to type the resolved data in child components.

```typescript
import type { ResolvedType } from "@pkg/types";

import type { getMonitorsData } from "./query.server";

// In the parent route
export async function loader() {
	return {
		monitorsData: getMonitorsData(), // Returns Promise, not awaited
	};
}

// In a child component that receives the resolved data
interface MonitorsTableProps {
	monitors: ResolvedType<typeof getMonitorsData>["monitors"];
}

export function MonitorsTable(props: MonitorsTableProps) {
	// props.monitors is fully typed
}
```

## Pattern: Typing Array Items from Query Results

Access nested types from query results using indexed access.

```typescript
import type { ResolvedType } from "@pkg/types";

import type { getHttpMonitorsData } from "./query.server";

// Get the type of a single monitor from the array
type Monitor = ResolvedType<typeof getHttpMonitorsData>["httpMonitors"][number];

interface MonitorRowProps {
	monitor: Monitor;
}
```

## Tips

1. **Use `import type`** - Always import types as type-only imports since they are purely type utilities with no runtime code
2. **Prefer over manual typing** - Using `ResolvedType` keeps types in sync with the actual function return type, avoiding drift when the function changes
3. **Combine with indexed access** - Use `ResolvedType<typeof fn>["property"]` to extract nested types from complex return objects
4. **Use `JSONValue` for dynamic data** - When accepting arbitrary JSON data (e.g., API responses, queue messages), use `JSONValue` instead of `unknown` for better type safety
