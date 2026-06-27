---
title: How to Prevent a Modal Dialog from Closing with request-close in React
excerpt: Use request-close to let a dialog cancel closing before React handles the final result.
tech: react@19.0.0
---

The `close` command closes a `dialog` immediately. That is fine for simple dismiss buttons, but sometimes the dialog needs a chance to say no before closing.

That is what `request-close` is for. It asks the browser to dismiss the dialog, fires a `cancel` event first, and only closes the dialog if that event is not prevented.

## Type the Command Attribute

React may not include the new `command` and `commandfor` button attributes in your installed types yet. Add the same augmentation from the basic dialog tutorial, with `request-close` included in the standard command values:

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

The standard commands cover the built in browser behaviors. The custom command shape, `` `--${string}` ``, keeps the type open for app specific commands too.

## Render a Dialog with request-close

Start with a native `dialog` and use `request-close` for the cancel button. This gives the dialog a chance to intercept the close request before the browser dismisses it:

```tsx {% path="app/components/settings-dialog.tsx" %}
import { useId } from "react";

export function SettingsDialog() {
	let id = useId();

	return (
		<>
			<button type="button" command="show-modal" commandfor={id}>
				Edit Settings
			</button>

			<dialog id={id}>
				<form method="dialog">
					<h2>Edit Settings</h2>

					<label>
						Display Name
						<input name="displayName" defaultValue="Sergio" />
					</label>

					<button type="button" command="request-close" commandfor={id}>
						Cancel
					</button>

					<button type="submit" value="save">
						Save
					</button>
				</form>
			</dialog>
		</>
	);
}
```

The cancel button does not call `close` directly. It uses `request-close`, which behaves like calling `dialog.requestClose()` from JavaScript.

If nothing prevents the `cancel` event, the dialog closes. If something prevents it, the dialog stays open.

## Prevent the Close Request

Now add an `onCancel` handler to decide whether the dialog can close. This example keeps the dialog open unless the user checks a confirmation checkbox:

```tsx {% path="app/components/settings-dialog.tsx" %}
import { useId } from "react";

export function SettingsDialog() {
	let id = useId();

	return (
		<>
			<button type="button" command="show-modal" commandfor={id}>
				Edit Settings
			</button>

			<dialog
				id={id}
				onCancel={(event) => {
					let form = event.currentTarget.querySelector("form");
					let input = form?.elements.namedItem("discardChanges");

					if (!(input instanceof HTMLInputElement)) return;
					if (input.checked) return;

					event.preventDefault();
				}}
			>
				<form method="dialog">
					<h2>Edit Settings</h2>

					<label>
						Display Name
						<input name="displayName" defaultValue="Sergio" />
					</label>

					<label>
						<input type="checkbox" name="discardChanges" />
						Discard my changes
					</label>

					<button type="button" command="request-close" commandfor={id}>
						Cancel
					</button>

					<button type="submit" value="save">
						Save
					</button>
				</form>
			</dialog>
		</>
	);
}
```

The `cancel` event is the important part. Calling `event.preventDefault()` stops the dialog from closing, so the user stays in the modal.

The `close` command cannot do this. Once a button invokes `close`, the browser closes the dialog without giving your code a cancellable step first.

## Read the Dialog Return Value

When a `request-close` button has a `value`, the browser uses that value as the dialog's `returnValue` if the dialog closes. You can read that value in `onClose`:

```tsx {% path="app/components/settings-dialog.tsx" %}
import { useId } from "react";

export namespace SettingsDialog {
	export type Decision = "discard" | "save";

	export interface Props {
		onDecision(decision: Decision): void;
	}
}

export function SettingsDialog({ onDecision }: SettingsDialog.Props) {
	let id = useId();

	return (
		<>
			<button type="button" command="show-modal" commandfor={id}>
				Edit Settings
			</button>

			<dialog
				id={id}
				onCancel={(event) => {
					let form = event.currentTarget.querySelector("form");
					let input = form?.elements.namedItem("discardChanges");

					if (!(input instanceof HTMLInputElement)) return;
					if (input.checked) return;

					event.preventDefault();
				}}
				onClose={(event) => {
					let decision = event.currentTarget.returnValue;
					if (decision === "discard" || decision === "save") onDecision(decision);
				}}
			>
				<form method="dialog">
					<h2>Edit Settings</h2>

					<label>
						Display Name
						<input name="displayName" defaultValue="Sergio" />
					</label>

					<label>
						<input type="checkbox" name="discardChanges" />
						Discard my changes
					</label>

					<button type="button" command="request-close" commandfor={id} value="discard">
						Cancel
					</button>

					<button type="submit" value="save">
						Save
					</button>
				</form>
			</dialog>
		</>
	);
}
```

Now the cancel button requests a close with `value="discard"`. If `onCancel` allows the close, `onClose` receives a dialog whose `returnValue` is `"discard"`.

The save button still uses the normal `method="dialog"` form behavior. Submitting that button closes the dialog and sets `returnValue` to `"save"`.

## Choose the Right Command

Use `close` when the button should always dismiss the dialog. It is the direct path.

Use `request-close` when the dialog needs a cancellable close request. It gives you the same escape hatch the browser uses for the Escape key: listen for `cancel`, then call `preventDefault()` when the dialog should stay open.

## Final Thoughts

The `request-close` command is useful when closing a dialog is a decision, not just a dismissal. It keeps the trigger declarative, but still gives the dialog one chance to block the close before `onClose` runs.
