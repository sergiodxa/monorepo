---
title: How to Open a Modal Dialog in React with the Invoker Commands API
excerpt: Use command and commandfor to open a native dialog in React without useState or dialog libraries.
tech: react@19.0.0
---

React modal dialogs often start with `useState`, refs, click handlers, and a dialog component library. That makes sense when you need animations, controlled state, nested overlays, or custom focus behavior, but it is a lot of code for a simple "open this dialog" interaction.

The Invoker Commands API lets a button trigger built-in browser actions on another element with HTML attributes. In React, you can use those attributes directly on a `button`, keep the native `dialog` element, and avoid storing open state in React at all.

## Type the Button Attributes

React passes unknown DOM attributes through to the browser, but your React types may not know about `command` and `commandfor` yet. Add a small type augmentation so TypeScript accepts the attributes in JSX.

The `StandardCommand` union includes the standard `command` values browsers understand today. The `command` attribute also accepts custom commands that start with `--`, so the type allows any `` `--${string}` `` value too:

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
}
```

This only updates the TypeScript type for React button props. It does not add runtime code, and you can remove it once your React types include these attributes.

## Render the Dialog

Start with a React component that renders the trigger and the native `dialog`. The `commandfor` value must match the `id` of the dialog:

```tsx {% path="app/components/contact-dialog.tsx" %}
import { useId } from "react";

export function ContactDialog() {
	let id = useId();
	return (
		<>
			<button type="button" command="show-modal" commandfor={id}>
				Contact Us
			</button>

			<dialog id={id}>
				<form method="post">
					<h2>Contact Us</h2>

					<label>
						Email
						<input type="email" name="email" required />
					</label>

					<label>
						Message
						<textarea name="message" required />
					</label>

					<button type="submit">Send Message</button>
				</form>
			</dialog>
		</>
	);
}
```

The `command="show-modal"` attribute tells the browser which action to run. The `commandfor={id}` attribute tells the browser which element receives that command.

There is no `useState(false)`, no `setOpen(true)`, and no ref calling `dialog.showModal()`. React renders the markup, then the browser handles the interaction when the user clicks the button.

## Add a Close Button

A modal dialog should give the user an explicit way to close it. Inside a `dialog`, a form with `method="dialog"` closes the dialog when submitted:

```tsx {% path="app/components/contact-dialog.tsx" %}
import { useId } from "react";

export function ContactDialog() {
	let id = useId();
	return (
		<>
			<button type="button" command="show-modal" commandfor={id}>
				Contact Us
			</button>

			<dialog id={id}>
				<form method="dialog">
					<button type="submit" aria-label="Close">
						Close
					</button>
				</form>

				<form method="post">
					<h2>Contact Us</h2>

					<label>
						Email
						<input type="email" name="email" required />
					</label>

					<label>
						Message
						<textarea name="message" required />
					</label>

					<button type="submit">Send Message</button>
				</form>
			</dialog>
		</>
	);
}
```

Keeping the close control inside its own `method="dialog"` form avoids mixing it with the contact form submission. The contact form can still use `method="post"`, while the close form only dismisses the dialog.

You can also use the `close` command from another invoker button if you prefer to keep open and close behavior in the same declarative pattern:

```tsx {% path="app/components/contact-dialog.tsx" %}
<button type="button" command="close" commandfor={id}>
	Close
</button>
```

Use the `method="dialog"` form when the button lives inside the dialog and should work without depending on the newer command attributes. Use the `close` command when the close control is part of the invoker pattern you are already using.

## Keep Libraries for Harder Dialogs

This pattern works well for simple modal dialogs where the browser's `dialog` behavior is enough. You do not need a complex dialog library just to open a contact form, settings panel, or confirmation message.

A dialog library is still useful when you need app-level composition, custom animation states, nested overlay coordination, or consistent styling primitives across many dialogs. The trade-off is more component state and more library code for behavior the browser may already provide.

## Final Thoughts

For simple modal dialogs, this removes the React state you would usually add only to call `showModal()` and `close()`. The button already knows the command, the dialog already knows how to open, and React only needs to render the markup.
