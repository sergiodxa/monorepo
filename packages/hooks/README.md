# @pkg/hooks

Reusable React hooks for common patterns in React Router applications.

## Overview

This package provides a collection of React hooks that solve common problems in React Router applications. The hooks are designed to be small, focused, and composable.

Requires React 19+ and React Router 7+ as peer dependencies.

## Usage

```typescript
import { useToggle, useFetcherStatus } from "@pkg/hooks";

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

### `useFetcherStatus<T extends { ok?: boolean }>(fetcher: Fetcher<T>): FetcherStatus`

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

#### `FetcherStatus`

```typescript
type FetcherStatus = "idle" | "loading" | "success" | "failure";
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
- [`@pkg/result`](/packages/result) - Result pattern for error handling
- [`@pkg/validate`](/packages/validate) - Form validation

## Tips

1. **`useToggle` returns a stable function** - The toggle function identity never changes, safe to use in dependency arrays
2. **`useFetcherStatus` requires `ok` property** - Your action responses should use `@pkg/response` which adds `ok: boolean` automatically
3. **Status is memoized** - `useFetcherStatus` only recalculates when fetcher state or data changes
4. **Use with `@pkg/response`** - The `ok` property discrimination works perfectly with `@pkg/response` helpers
