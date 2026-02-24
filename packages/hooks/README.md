# @pkg/hooks

Reusable React hooks for common patterns in React Router applications.

## Overview

This package provides a collection of React hooks that solve common problems in React Router applications. The hooks are designed to be small, focused, and composable.

Requires React 19+ and React Router 7+ as peer dependencies.

## Usage

```typescript
import {
  useToggle,
  useFetcherStatus,
  useClipboard,
  useValue,
  useTimeout,
  useStableReference,
} from "@pkg/hooks";

function MyComponent() {
  let [isOpen, toggle] = useToggle(false);

  return (
    <div>
      <button onClick={toggle}>{isOpen ? "Close" : "Open"}</button>
      {isOpen && <div>Content</div>}
    </div>
  );
}
```

## API

### `useToggle(initialState?: boolean): [boolean, () => void]`

A hook for managing boolean toggle state with a stable toggle function.

**Parameters:**

- `initialState`: Initial boolean value (default: `false`)

**Returns:**

- Tuple of `[state, toggle]` where `toggle` is a stable function that flips the state

**Example:**

```typescript
function Disclosure() {
  let [isExpanded, toggle] = useToggle(false);

  return (
    <div>
      <button onClick={toggle}>
        {isExpanded ? "Collapse" : "Expand"}
      </button>
      {isExpanded && <div>Expanded content</div>}
    </div>
  );
}
```

### `useClipboard(): useClipboard.Return`

A hook for reading from and writing to the system clipboard with status tracking.

**Returns:**

- Object with `status`, `data`, `read`, `write`, and `reset` functions

**Example:**

```typescript
import { useClipboard, useTimeout } from "@pkg/hooks";

function CopyButton({ text }: { text: string }) {
	let clipboard = useClipboard();

	// Auto-reset after 2 seconds when copy succeeds
	useTimeout(() => clipboard.reset(), {
		delay: 2000,
		when: clipboard.status === "success",
	});

	return (
		<button
			onClick={async () => {
				let item = new ClipboardItem({
					"text/plain": new Blob([text], { type: "text/plain" }),
				});
				await clipboard.write([item]);
			}}
			disabled={clipboard.status === "loading"}
		>
			{clipboard.status === "success" ? "Copied!" : "Copy"}
		</button>
	);
}
```

### `useCapsLockDetection(): boolean`

Detects whether the CapsLock key is currently enabled.

Uses keyboard events to track CapsLock state changes, and a one-time mousemove listener to detect the initial state before any key is pressed.

**Returns:**

- `true` if CapsLock is enabled, `false` otherwise

**Example:**

```typescript
import { useCapsLockDetection } from "@pkg/hooks";

function PasswordInput() {
  let capsLockOn = useCapsLockDetection();

  return (
    <div>
      <input type="password" />
      {capsLockOn && <span>CapsLock is on</span>}
    </div>
  );
}
```

### `useValue<T>(key: symbol, initialValue: T): [T, (newValue: T) => void]`

Share state between components without prop drilling or context.

Creates a global store keyed by a symbol that any component can subscribe to. When multiple components use the same key, they share the same state. The store is automatically cleaned up when no components are subscribed.

**Type Parameters:**

- `T`: The type of the shared state value

**Parameters:**

- `key`: A symbol to identify the shared state. Use `Symbol.for("name")` to create a consistent key across modules.
- `initialValue`: The initial value used when the store is first created. Ignored if a store for this key already exists.

**Returns:**

- Tuple of `[state, setState]` similar to `useState`

**Example:**

```typescript
import { useValue } from "@pkg/hooks";

// Define keys in a shared constants file for type safety
const KEYS = {
  counter: Symbol.for("app:counter"),
  theme: Symbol.for("app:theme"),
} as const;

// In ComponentA (e.g., in /dashboard route)
function Dashboard() {
  let [count, setCount] = useValue(KEYS.counter, 0);
  return <button onClick={() => setCount(count + 1)}>Count: {count}</button>;
}

// In ComponentB (e.g., in /settings route)
function Settings() {
  let [count, setCount] = useValue(KEYS.counter, 0);
  // Both components share the same count state
  return <div>Current count: {count}</div>;
}
```

**Notes:**

- Use `Symbol.for("name")` instead of `Symbol("name")` to ensure the same symbol is used across modules
- The first component to render with a key determines the initial value; subsequent components receive the existing value
- Stores are automatically cleaned up when all subscribed components unmount
- SSR-safe: returns `initialValue` on the server to prevent hydration mismatches

### `useIsomorphicLayoutEffect`

A hook that uses `useLayoutEffect` on the client and `useEffect` on the server to avoid SSR warnings.

Use this when you need synchronous DOM measurements or mutations that must happen before the browser paints, but also need to support server-side rendering.

**Signature:**

```typescript
const useIsomorphicLayoutEffect: typeof useLayoutEffect;
```

**Example:**

```typescript
import { useIsomorphicLayoutEffect } from "@pkg/hooks";

function Tooltip({ targetRef }: { targetRef: RefObject<HTMLElement> }) {
  let [position, setPosition] = useState({ top: 0, left: 0 });

  useIsomorphicLayoutEffect(() => {
    let rect = targetRef.current.getBoundingClientRect();
    setPosition({ top: rect.bottom, left: rect.left });
  }, [targetRef]);

  return <div style={position}>Tooltip</div>;
}
```

### `useTimeout(callback: () => void, options: useTimeout.Options): () => void`

A hook that manages a timeout with conditional triggering.

**Parameters:**

- `callback`: The function to call when the timeout fires
- `options`: Configuration options
  - `delay`: The delay in milliseconds before the callback is invoked
  - `when`: Condition that controls when the timeout starts (default: `false`)

**Returns:**

- A function to manually clear the timeout

**Behavior:**

- When `when` is `false` → no timeout running
- When `when` becomes `true` → starts the timeout
- When `when` becomes `false` again (or component unmounts) → clears the timeout
- If `when` stays `true` and `delay` changes → restarts with new delay

**Example:**

```typescript
import { useClipboard, useTimeout } from "@pkg/hooks";

function CopyButton({ text }: { text: string }) {
  let clipboard = useClipboard();

  // Auto-reset after 2 seconds when copy succeeds
  useTimeout(() => clipboard.reset(), {
    delay: 2000,
    when: clipboard.status === "success",
  });

  return (
    <button
      onClick={async () => {
        let item = new ClipboardItem({
          "text/plain": new Blob([text], { type: "text/plain" }),
        });
        await clipboard.write([item]);
      }}
      disabled={clipboard.status === "loading"}
    >
      {clipboard.status === "success" ? "Copied!" : "Copy"}
    </button>
  );
}
```

**Example with manual clear:**

```typescript
import { useTimeout } from "@pkg/hooks";

function AutoSave({ isDirty }: { isDirty: boolean }) {
  let clear = useTimeout(() => save(), {
    delay: 5000,
    when: isDirty,
  });

  return (
    <div>
      {isDirty && <span>Unsaved changes</span>}
      <button onClick={clear}>Cancel auto-save</button>
    </div>
  );
}
```

### `useStableReference<T>(value: T): { readonly current: T }`

Returns a ref that always contains the latest value.

Useful for accessing the latest value inside callbacks or effects without adding the value to the dependency array, avoiding stale closures.

**Type Parameters:**

- `T`: The type of the value

**Parameters:**

- `value`: The value to keep a reference to

**Returns:**

- A ref object with the `current` property always set to the latest value

**Example:**

```typescript
import { useStableReference } from "@pkg/hooks";

function useEventListener(event: string, handler: () => void) {
	let handlerRef = useStableReference(handler);

	useEffect(() => {
		let listener = () => handlerRef.current();
		window.addEventListener(event, listener);
		return () => window.removeEventListener(event, listener);
	}, [event]); // handler not in deps, but always up-to-date via ref
}
```

**Example in custom hooks:**

```typescript
import { useStableReference } from "@pkg/hooks";

function useInterval(callback: () => void, delay: number) {
	let callbackRef = useStableReference(callback);

	useEffect(() => {
		let id = setInterval(() => callbackRef.current(), delay);
		return () => clearInterval(id);
	}, [delay]); // No need to restart interval when callback changes
}
```

### `useFetcherStatus<T extends { ok?: boolean }>(fetcher: Fetcher<T>): useFetcherStatus.FetcherStatus`

A hook that derives a simple status from a React Router fetcher's state and data.

**Type Parameters:**

- `T`: The fetcher data type, must have an optional `ok` boolean property

**Parameters:**

- `fetcher`: A React Router fetcher from `useFetcher<T>()`

**Returns:**

- `"idle"` - Fetcher is idle and has no data or data.ok is undefined
- `"loading"` - Fetcher is submitting or loading
- `"success"` - Fetcher completed and data.ok is true
- `"failure"` - Fetcher completed and data.ok is false

**Example:**

```typescript
import { useFetcher } from "react-router";
import { useFetcherStatus } from "@pkg/hooks";

function SubscribeForm() {
  let fetcher = useFetcher<{ ok: boolean; error?: string }>();
  let status = useFetcherStatus(fetcher);

  return (
    <fetcher.Form method="post" action="/api/subscribe">
      <input type="email" name="email" disabled={status === "loading"} />
      <button type="submit" disabled={status === "loading"}>
        {status === "loading" ? "Subscribing..." : "Subscribe"}
      </button>
      {status === "failure" && <p className="error">{fetcher.data?.error}</p>}
      {status === "success" && <p className="success">Subscribed!</p>}
    </fetcher.Form>
  );
}
```

### Types

Types are exported via namespaces on each hook:

```typescript
import { useFetcherStatus, useClipboard, useTimeout } from "@pkg/hooks";

// Access types via namespace
type FetcherStatus = useFetcherStatus.FetcherStatus;
type ClipboardStatus = useClipboard.Status;
type TimeoutOptions = useTimeout.Options;
```

#### `useFetcherStatus.FetcherStatus`

```typescript
type FetcherStatus = "idle" | "loading" | "success" | "failure";
```

#### `useClipboard.Status`

```typescript
type Status = "idle" | "loading" | "success" | "failure";
```

#### `useClipboard.State`

```typescript
interface State {
	status: Status;
	data: ClipboardItems | ClipboardError | null;
}
```

#### `useClipboard.Return`

```typescript
interface Return {
	status: Status;
	data: ClipboardItems | ClipboardError | null;
	read(): Promise<Result<ClipboardItems, ClipboardError>>;
	write(data: ClipboardItems): Promise<Result<null, ClipboardError>>;
	reset(): void;
}
```

#### `useTimeout.Options`

```typescript
interface Options {
	/** The delay in milliseconds before the callback is invoked. */
	delay: number;
	/**
	 * Condition that controls when the timeout starts.
	 * - When `true`, the timeout starts (or restarts if already running).
	 * - When `false`, the timeout is cleared.
	 * @default false
	 */
	when?: boolean;
}
```

## Pattern: Shared State Across Routes

Use `useValue` to share state between components in different routes without context:

```typescript
import { useValue } from "@pkg/hooks";

// keys.ts - Define keys in a shared file
export const KEYS = {
  selectedItems: Symbol.for("app:selectedItems"),
  sidebarOpen: Symbol.for("app:sidebarOpen"),
} as const;

// routes/products.tsx
function ProductList() {
  let [selectedIds, setSelectedIds] = useValue<Set<string>>(
    KEYS.selectedItems,
    new Set()
  );

  function toggleSelection(id: string) {
    let next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }

  return (
    <ul>
      {products.map((p) => (
        <li key={p.id}>
          <input
            type="checkbox"
            checked={selectedIds.has(p.id)}
            onChange={() => toggleSelection(p.id)}
          />
          {p.name}
        </li>
      ))}
    </ul>
  );
}

// routes/cart.tsx - Different route, same state
function CartSummary() {
  let [selectedIds] = useValue<Set<string>>(KEYS.selectedItems, new Set());
  return <div>Selected items: {selectedIds.size}</div>;
}
```

## Pattern: Form with Status Feedback

Combine `useFetcherStatus` with `@pkg/response` for complete form handling:

```typescript
// Route action
import { ok, badRequest } from "@pkg/response";
import { validate } from "@pkg/validate";
import { isFailure } from "@pkg/result";

export async function action({ request }: Route.ActionArgs) {
  let result = await validate(request, schema);
  if (isFailure(result)) {
    return badRequest({ error: "Invalid input" });
  }
  await saveData(result.data);
  return ok({ message: "Saved!" });
}

// Component
import { useFetcher } from "react-router";
import { useFetcherStatus } from "@pkg/hooks";

function SaveForm() {
  let fetcher = useFetcher<{ ok: boolean; error?: string; message?: string }>();
  let status = useFetcherStatus(fetcher);

  return (
    <fetcher.Form method="post">
      <input name="data" disabled={status === "loading"} />
      <button disabled={status === "loading"}>
        {status === "loading" ? "Saving..." : "Save"}
      </button>
      {status === "failure" && <p>{fetcher.data?.error}</p>}
      {status === "success" && <p>{fetcher.data?.message}</p>}
    </fetcher.Form>
  );
}
```

## Pattern: Toggle with Animation

Use `useToggle` with CSS transitions:

```typescript
import { useToggle } from "@pkg/hooks";
import { cn } from "@pkg/cn";

function AnimatedPanel() {
  let [isVisible, toggle] = useToggle(false);

  return (
    <div>
      <button onClick={toggle}>Toggle Panel</button>
      <div
        className={cn(
          "transition-all duration-300",
          isVisible ? "opacity-100 max-h-96" : "opacity-0 max-h-0 overflow-hidden"
        )}
      >
        <div className="p-4">Panel content</div>
      </div>
    </div>
  );
}
```

## Pattern: Multiple Toggles

Create multiple independent toggle states:

```typescript
import { useToggle } from "@pkg/hooks";

function Settings() {
  let [notificationsEnabled, toggleNotifications] = useToggle(true);
  let [darkMode, toggleDarkMode] = useToggle(false);
  let [compactView, toggleCompactView] = useToggle(false);

  return (
    <div>
      <label>
        <input
          type="checkbox"
          checked={notificationsEnabled}
          onChange={toggleNotifications}
        />
        Enable notifications
      </label>
      <label>
        <input type="checkbox" checked={darkMode} onChange={toggleDarkMode} />
        Dark mode
      </label>
      <label>
        <input
          type="checkbox"
          checked={compactView}
          onChange={toggleCompactView}
        />
        Compact view
      </label>
    </div>
  );
}
```

## Related Packages

- [`@pkg/response`](/packages/response) - HTTP response helpers with `ok` boolean
- [`@pkg/result`](/packages/result) - Result pattern for error handling (used by `useClipboard`)
- [`@pkg/validate`](/packages/validate) - Form validation

## Tips

1. **`useToggle` returns a stable function** - The toggle function identity never changes, safe to use in dependency arrays
2. **`useFetcherStatus` requires `ok` property** - Your action responses should use `@pkg/response` which adds `ok: boolean` automatically
3. **Status is memoized** - `useFetcherStatus` only recalculates when fetcher state or data changes
4. **Use with `@pkg/response`** - The `ok` property discrimination works perfectly with `@pkg/response` helpers
