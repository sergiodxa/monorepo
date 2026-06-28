---
title: How to Build a User Menu in React with Invoker Popover Commands
excerpt: Use show-popover, hide-popover, and toggle-popover to build a React user menu without state.
tech: react@19.0.0 tailwindcss@4.0.0
---

A navbar user menu usually starts with a small piece of React state: click the avatar, set `open` to `true`, render the menu, then close it when the user picks an option. That works, but the browser already has a primitive for this interaction: the Popover API.

The Invoker Commands API lets a button control a popover with `show-popover`, `hide-popover`, and `toggle-popover`. For a user menu, that means React can render the button and the menu while the browser owns the open and closed state.

## Type the Popover Attributes

React may not include the latest command and popover attributes in your installed types yet. Add a small type augmentation so TypeScript accepts the attributes in JSX:

```ts {% path="app/types/react-command-attributes.d.ts" %}
import "react";

declare module "react" {
	type StandardCommand =
		| "show-modal"
		| "close"
		| "request-close"
		| "show-popover"
		| "hide-popover"
		| "toggle-popover";

	interface ButtonHTMLAttributes<T> {
		command?: StandardCommand | `--${string}`;
		commandfor?: string;
	}

	interface HTMLAttributes<T> {
		popover?: "auto" | "manual" | "";
	}
}
```

The `StandardCommand` union includes the built in commands browsers understand. The `command` attribute also accepts custom commands that start with `--`, so the type keeps that escape hatch.

## Toggle the User Menu

Start with the common navbar shape: an avatar button and a menu with account actions. The button uses `toggle-popover` and points at the popover by ID:

```tsx {% path="app/components/user-menu.tsx" %}
import { useId } from "react";

export function UserMenu() {
	let menuId = useId();

	return (
		<nav aria-label="User">
			<button type="button" command="toggle-popover" commandfor={menuId} aria-label="User menu">
				<img src="https://github.com/sergiodxa.png" alt="" width="40" height="40" />
			</button>

			<div id={menuId} popover="auto">
				<p>Sergio Xalambrí</p>
				<a href="/settings">Settings</a>
				<a href="/billing">Billing</a>
				<form method="post" action="/logout">
					<button type="submit">Sign Out</button>
				</form>
			</div>
		</nav>
	);
}
```

The `popover="auto"` attribute makes the menu a popover. Auto popovers close when the user clicks outside, presses Escape, or opens another auto popover.

There is no `useState`, no document click listener, and no effect to close the menu on Escape. The button toggles the popover, and the browser handles the common dismissal behavior.

## Add Minimal Styling

The Popover API controls visibility, not visual design. For a navbar menu, you only need enough styling to place the popover near the avatar and make the menu items easy to scan:

```tsx {% path="app/components/user-menu.tsx" %}
import { useId } from "react";

export function UserMenu() {
	let menuId = useId();

	return (
		<nav aria-label="User">
			<button
				type="button"
				command="toggle-popover"
				commandfor={menuId}
				aria-label="User menu"
				className="rounded-full"
			>
				<img
					src="https://github.com/sergiodxa.png"
					alt=""
					width="40"
					height="40"
					className="rounded-full"
				/>
			</button>

			<div id={menuId} popover="auto" className="fixed top-16 right-4 m-0 w-48 border bg-white p-2">
				<p className="px-2 py-1">Sergio Xalambrí</p>
				<a href="/settings" className="block px-2 py-1">
					Settings
				</a>
				<a href="/billing" className="block px-2 py-1">
					Billing
				</a>
				<form method="post" action="/logout">
					<button type="submit" className="px-2 py-1">
						Sign Out
					</button>
				</form>
			</div>
		</nav>
	);
}
```

The important classes are the positioning utilities on the popover: `fixed`, `top-16`, `right-4`, and `m-0`. The rest gives the menu a width, border, background, and enough spacing to read the items.

## Hide the Menu After an Action

Sometimes a menu contains a button that performs an action without navigating. In that case, run your custom action in `onClick` and close the popover declaratively with `hide-popover`:

```tsx {% path="app/components/user-menu.tsx" %}
<div id={menuId} popover="auto" className="fixed top-16 right-4 m-0 w-48 border bg-white p-2">
	<p className="px-2 py-1">Sergio Xalambrí</p>
	<a href="/settings" className="block px-2 py-1">
		Settings
	</a>
	<a href="/billing" className="block px-2 py-1">
		Billing
	</a>

	<button
		type="button"
		command="hide-popover"
		commandfor={menuId}
		className="px-2 py-1"
		onClick={() => {
			startSwitchAccountFlow();
		}}
	>
		Switch Account
	</button>

	<form method="post" action="/logout">
		<button type="submit" className="px-2 py-1">
			Sign Out
		</button>
	</form>
</div>
```

The `onClick` handler runs your application logic. The `hide-popover` command only hides the popover after the button is activated.

This keeps the responsibilities separate: React handles the custom action, and the browser handles the popover state.

## Show the Menu Explicitly

The avatar should usually use `toggle-popover`, because users expect the same button to open and close the menu. You can still use `show-popover` when a control should only open it:

```tsx {% path="app/components/user-menu.tsx" %}
<button type="button" command="show-popover" commandfor={menuId}>
	Show Account Options
</button>
```

If the popover is already open, `show-popover` does nothing. This is useful for controls that should reveal the menu without also acting as a close button.

For the avatar menu, the final shape usually combines all three commands: `toggle-popover` on the avatar, `hide-popover` for dismiss actions inside the menu, and `show-popover` only for controls that should never close the menu.

## Final Thoughts

Popover commands let React skip the usual state wiring for a simple dropdown menu. The trigger points at the popover, the command says what should happen, and the browser handles the open state.

Use a dialog or menu library when you need a richer accessibility pattern, custom keyboard navigation, or overlay coordination across the app. For a small avatar menu with links and buttons, `popover` plus invoker commands can be enough.
