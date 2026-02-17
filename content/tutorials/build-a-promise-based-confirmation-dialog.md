---
title: How to Build a Promise-Based Confirmation Dialog
excerpt: Create a confirm() function that returns a Promise, making confirmation dialogs as simple as await confirm().
tech: react@19.0.0 react-aria-components@1.0.0
---

When building applications, you often need to ask users for confirmation before performing destructive actions like deleting a record or canceling a subscription. The native `window.confirm()` works, but it's ugly, blocks the main thread, and can't be styled to match your app's design.

The challenge is creating a custom confirmation dialog that's as simple to use as the native one. Ideally, you want to call `await confirm("Delete this item?")` and get back `true` or `false`. This requires a way to trigger a dialog from anywhere in your code and wait for the user's response, all without prop drilling or complex state management.

## Create the Global State Store

Start by defining the state structure and creating a simple store with subscribers. This store will hold the dialog's open state, title, options, and a resolve function to fulfill the Promise:

```ts {% path="app/components/confirm.ts" %}
interface ConfirmState {
	isOpen: boolean;
	title: string;
	options: confirm.Options;
	resolve: ((value: boolean) => void) | null;
}

let state: ConfirmState = {
	isOpen: false,
	title: "",
	options: {},
	resolve: null,
};

let listeners = new Set<() => void>();

function notify() {
	for (let listener of listeners) {
		listener();
	}
}

function subscribe(listener: () => void) {
	listeners.add(listener);
	return () => listeners.delete(listener);
}

function getSnapshot() {
	return state;
}
```

This is a minimal external store pattern. The `listeners` set holds functions that React will call when the state changes, and `notify` triggers all of them. The `subscribe` and `getSnapshot` functions are the API that `useSyncExternalStore` expects.

## Define the Options Type

Create a namespace for the options type. This keeps the types organized and allows for easy extension. If you're unfamiliar with this pattern, see [Simplify Component Imports with TypeScript Namespaces](/tutorials/simplify-component-imports-with-typescript-namespaces):

```ts {% path="app/components/confirm.ts" %}
export namespace confirm {
	export interface Options {
		/** Description text shown below the title */
		description?: string;
		/** Text for the confirm button. Defaults to "Confirm" */
		confirmLabel?: string;
		/** Text for the cancel button. Defaults to "Cancel" */
		cancelLabel?: string;
		/** Color for the confirm button. Defaults to "danger" */
		color?: "primary" | "danger" | "neutral";
	}
}
```

The namespace pattern lets you export both the function and its types under the same name, so consumers can use `confirm.Options` for typing.

## Build the confirm Function

The core of this pattern is a function that returns a Promise. When called, it updates the global state and stores the Promise's resolve function:

```ts {% path="app/components/confirm.ts" %}
export function confirm(title: string, options: confirm.Options = {}): Promise<boolean> {
	return new Promise((resolve) => {
		state = {
			isOpen: true,
			title,
			options,
			resolve,
		};
		notify();
	});
}
```

When you call `confirm("Delete this item?")`, it creates a new Promise, stores the `resolve` function in the state, sets `isOpen` to `true`, and notifies all subscribers. The Promise won't resolve until the user clicks a button.

## Handle the Dialog Close

Create a function that closes the dialog and resolves the Promise with the user's choice:

```ts {% path="app/components/confirm.ts" %}
function handleClose(confirmed: boolean) {
	let { resolve } = state;
	state = {
		isOpen: false,
		title: "",
		options: {},
		resolve: null,
	};
	notify();
	resolve?.(confirmed);
}
```

This function resets the state, notifies subscribers to close the dialog, and then calls `resolve` with `true` or `false`. The order matters: we reset state first so the dialog closes, then resolve the Promise.

## Create the ConfirmDialog Component

Build a React component that subscribes to the store and renders the dialog. Use `useSyncExternalStore` to connect React to the external state:

```tsx {% path="app/components/confirm.tsx" %}
import { useEffect, useState, useSyncExternalStore } from "react";
import { AlertDialog } from "./alert-dialog";
import { Button } from "./button";

export function ConfirmDialog() {
	let { isOpen, title, options } = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
	let [mounted, setMounted] = useState(false);

	useEffect(() => {
		if (isOpen) setMounted(true);
	}, [isOpen]);

	if (!mounted) return null;

	let { description, confirmLabel = "Confirm", cancelLabel = "Cancel", color = "danger" } = options;

	return (
		<AlertDialog.Content isOpen={isOpen} onOpenChange={(open) => !open && handleClose(false)}>
			<AlertDialog>
				<AlertDialog.Header>
					<AlertDialog.Title>{title}</AlertDialog.Title>
					{description && <AlertDialog.Description>{description}</AlertDialog.Description>}
				</AlertDialog.Header>

				<AlertDialog.Footer>
					<Button variant="outline" color="neutral" onPress={() => handleClose(false)}>
						{cancelLabel}
					</Button>
					<Button color={color} onPress={() => handleClose(true)}>
						{confirmLabel}
					</Button>
				</AlertDialog.Footer>
			</AlertDialog>
		</AlertDialog.Content>
	);
}
```

The `mounted` state prevents the dialog from rendering until it's been opened at least once. This avoids unnecessary DOM nodes and ensures the close animation works correctly. The `onOpenChange` handler catches when the user presses Escape or clicks outside the dialog. The `AlertDialog` component here uses [React Aria Components](/articles/building-accessible-ui-with-react-aria-components) for built-in accessibility.

## Add the Component to Your App Root

Place the `ConfirmDialog` component once at the root of your application, similar to how you'd place a toast container:

```tsx {% path="app/root.tsx" %}
import { Outlet } from "react-router";
import { ConfirmDialog } from "~/components/confirm";
import { Toaster } from "~/components/toaster";

export default function App() {
	return (
		<>
			<Outlet />
			<Toaster />
			<ConfirmDialog />
		</>
	);
}
```

The component renders nothing until `confirm()` is called, so there's no performance cost to including it.

## Use the confirm Function

Now you can use `confirm()` anywhere in your application. It works great with event handlers and async functions:

```tsx {% path="app/routes/posts.$postId.tsx" %}
import { confirm } from "~/components/confirm";

export default function PostPage() {
	async function handleDelete() {
		let confirmed = await confirm("Delete this post?", {
			description: "This action cannot be undone.",
			confirmLabel: "Delete",
			cancelLabel: "Keep",
			color: "danger",
		});

		if (confirmed) {
			await deletePost();
		}
	}

	return (
		<article>
			<h1>My Post</h1>
			<button onClick={handleDelete}>Delete</button>
		</article>
	);
}
```

The code reads naturally: ask for confirmation, and if the user confirms, delete the post. No state management, no callbacks, no prop drilling. You can style the button colors using a [semantic color system with React Context](/tutorials/create-a-color-system-with-react-context) to ensure consistent styling across your confirmation dialogs.

## Final Thoughts

This pattern works because it separates the dialog's UI from its trigger. The `confirm()` function is a pure imperative API that returns a Promise, while the `ConfirmDialog` component handles rendering. The external store bridges them together.

You can extend this pattern to support multiple dialogs, custom content, or even form inputs. The key insight is that Promises and external stores let you build imperative APIs that integrate cleanly with React's declarative model.
