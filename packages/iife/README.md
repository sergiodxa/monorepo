# @sdxc/iife

Small helper to evaluate inline logic and immediately get its result back as an expression.

## Overview

`@sdxc/iife` wraps a callback and returns whatever that callback returns. It is useful when you want block-style logic in places where JavaScript expects a single expression, such as variable initialization, object properties, function arguments, or JSX.

This gives you a lightweight `do`-expression-like pattern without new syntax. Because the callback can return any value, it also works with promises when used with `await`.

## Usage

### Basic Example

```typescript
import { iife } from "@sdxc/iife";

let message = iife(() => {
	if (Math.random() > 0.5) return "heads";
	return "tails";
});
```

### Compute a Value and Assign It

Use `iife` when a variable needs multi-step logic but you still want a single expression.

```typescript
import { iife } from "@sdxc/iife";

let total = iife(() => {
	let subtotal = 120;
	let tax = subtotal * 0.1;
	let discount = subtotal > 100 ? 15 : 0;

	return subtotal + tax - discount;
});
```

### Branch in JSX

Use `iife` inside JSX when inline branching needs more than a ternary.

```tsx
import { iife } from "@sdxc/iife";

function StatusMessage({ error, isLoading }: { error: Error | null; isLoading: boolean }) {
	return (
		<section>
			{iife(() => {
				if (error) return <p role="alert">{error.message}</p>;
				if (isLoading) return <p>Loading...</p>;
				return <p>Ready</p>;
			})}
		</section>
	);
}
```

### Await Async Work Inline

`iife` does not need a separate async API. If the callback is async, it returns a promise.

```typescript
import { iife } from "@sdxc/iife";

let user = await iife(async () => {
	let response = await fetch("/api/user");
	return response.json();
});
```

### Use `try`/`catch` Without Hoisting a Variable

Without `iife`, you may need to declare an empty variable outside the `try`/`catch`, then assign the success value in `try` and an error value in `catch`.

```typescript
let result: { data: string | null; error: string | null };

try {
	let data = JSON.parse(input) as { name: string };
	result = { data: data.name, error: null };
} catch {
	result = { data: null, error: "Invalid JSON input" };
}
```

With `iife`, the whole flow stays inline and returns the final value directly.

```typescript
import { iife } from "@sdxc/iife";

let result = iife(() => {
	try {
		let data = JSON.parse(input) as { name: string };
		return { data: data.name, error: null };
	} catch {
		return { data: null, error: "Invalid JSON input" };
	}
});
```

## API

### `iife<T>(fn: () => T): T`

Runs the callback immediately and returns its result unchanged.

**Parameters:**

- `fn`: Callback with the inline logic to evaluate

**Returns:**

- Whatever value the callback returns, including promises

**Example:**

```typescript
import { iife } from "@sdxc/iife";

let variant = iife(() => {
	if (size > 10) return "large";
	return "small";
});
```

## Patterns

### Pattern: Build Object Fields Inline

Use `iife` when one property needs local branching or setup without extracting a helper.

```typescript
import { iife } from "@sdxc/iife";

let payload = {
	title: "Invoice",
	status: iife(() => {
		if (isPaid) return "paid";
		if (isOverdue) return "overdue";
		return "pending";
	}),
};
```

### Pattern: Keep Intermediate Variables Scoped

Use `iife` to avoid leaking temporary variables into the surrounding scope.

```typescript
import { iife } from "@sdxc/iife";

let slug = iife(() => {
	let normalized = title.trim().toLowerCase();
	return normalized.replaceAll(/\s+/g, "-");
});
```

## Tips

1. **Prefer `iife` for expression contexts** - It is most useful where statements are not allowed, such as JSX or inline assignments.
2. **Keep callbacks short** - If the logic grows large or is reused, extract a named function instead.
3. **Use `await` with async callbacks** - `iife(async () => ...)` returns a promise just like any other async function call.
4. **Use it to limit scope** - Temporary variables stay inside the callback instead of leaking into the outer block.
