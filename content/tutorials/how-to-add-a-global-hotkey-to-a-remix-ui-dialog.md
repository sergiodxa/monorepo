---
title: How to Add a Global Hotkey to a Remix UI Dialog
excerpt: Build a Remix UI mixin that toggles a native dialog from a document-level keyboard shortcut.
tech: remix@3.0.0-beta.5
---

Command palettes, quick switchers, and help panels usually need two ways to open: a visible button and a keyboard shortcut. The button gives you a baseline path through HTML, while the shortcut gives frequent users a faster path from anywhere on the page.

In Remix v3, a `remix/ui` mixin is a good fit for this. The component can keep rendering native HTML, while the mixin attaches the document-level listener that HTML cannot express by itself. These APIs are still beta in `remix@3.0.0-beta.5`.

## Create the Hotkey Mixin

Start by creating a reusable `hotkey` mixin. It accepts a combo string like `mod+k`, tracks the host element it is attached to, and listens for `keydown` on `document`.

```ts {% path="app/mixins/hotkey.ts" %}
import type { MixinFactory, MixinHandle } from "remix/ui";

import { addEventListeners, createMixin } from "remix/ui";

const MOD_ALIASES = new Set(["mod", "ctrl", "control", "cmd", "command", "meta"]);
const ALT_ALIASES = new Set(["alt", "option"]);
const SHIFT_ALIAS = "shift";

interface ParsedCombo {
	key: string;
	mod: boolean;
	alt: boolean;
	shift: boolean;
}

function trackHostNode(handle: MixinHandle<HTMLElement>) {
	let hostNode: HTMLElement | undefined;

	handle.addEventListener("insert", (event) => {
		hostNode = event.node;
	});

	handle.addEventListener("remove", () => {
		hostNode = undefined;
	});

	return () => hostNode;
}

function parseCombo(combo: string): ParsedCombo {
	let tokens = combo
		.split("+")
		.map((token) => token.trim().toLowerCase())
		.filter((token) => token.length > 0);

	let key = tokens.at(-1) ?? "";
	let modifiers = tokens.slice(0, -1);

	return {
		key,
		mod: modifiers.some((token) => MOD_ALIASES.has(token)),
		alt: modifiers.some((token) => ALT_ALIASES.has(token)),
		shift: modifiers.includes(SHIFT_ALIAS),
	};
}

function matchesCombo(event: KeyboardEvent, combo: ParsedCombo) {
	if (event.key.toLowerCase() !== combo.key) return false;
	if ((event.ctrlKey || event.metaKey) !== combo.mod) return false;
	if (event.altKey !== combo.alt) return false;
	if (event.shiftKey !== combo.shift) return false;
	return true;
}

function isOpen(host: HTMLElement) {
	if (host instanceof HTMLDialogElement) return host.open;
	return host.matches(":popover-open");
}

function setOpen(host: HTMLElement, open: boolean) {
	if (host instanceof HTMLDialogElement) {
		if (open) host.showModal();
		else host.close();
		return;
	}

	if (!host.hasAttribute("popover")) return;

	if (open) host.showPopover();
	else host.hidePopover();
}

export let hotkey: MixinFactory<HTMLElement, [combo: string]> = createMixin<
	HTMLElement,
	[combo: string]
>((handle) => {
	let getHostNode = trackHostNode(handle);
	let parsed: ParsedCombo | undefined;

	addEventListeners(document, handle.signal, {
		keydown(event) {
			let hostNode = getHostNode();
			if (hostNode === undefined || parsed === undefined) return;
			if (event.repeat || !matchesCombo(event, parsed)) return;

			event.preventDefault();
			setOpen(hostNode, !isOpen(hostNode));
		},
	});

	return (combo) => {
		parsed = parseCombo(combo);
	};
});
```

The `trackHostNode` helper matters because the mixin setup runs before the DOM host exists. The `insert` event records the current element, and the `remove` event clears it when the element unmounts.

The combo matcher is exact. `mod+k` matches `Cmd+K` on macOS and `Ctrl+K` on Windows and Linux, but it does not match `mod+shift+k`.

## Define the Dashboard Route

Start by defining the URL in `app/routes.ts`. Remix v3 keeps the route contract here, and controllers render responses for those routes.

```ts {% path="app/routes.ts" %}
import { get, route } from "remix/routes";

export let routes = route({
	dashboard: get("/dashboard"),
});
```

This gives the app a typed `routes.dashboard` route. The next step maps that route to a controller that returns the HTML response.

## Render the Route From a Controller

Create the controller for the route and render the page with the command palette. The controller owns the route response, and the page UI stays as normal `remix/ui` JSX.

```tsx {% path="app/actions/controller.tsx" %}
import { createController } from "remix/router";

import { CommandPalette } from "../ui/command-palette";
import { routes } from "../routes";

import { render } from "./render";

export default createController(routes, {
	actions: {
		dashboard() {
			return render(
				<main>
					<header>
						<h1>Dashboard</h1>
						<p>Open the command palette with the button or the keyboard shortcut.</p>
					</header>

					<CommandPalette />
				</main>,
			);
		},
	},
});
```

The `render` helper is the app-local adapter that turns `remix/ui` JSX into an HTML `Response`. If your app already has a root controller, add the `dashboard` action there instead of creating a second root controller.

## Create the Dialog Island

Now render a small command palette as a client entry. The visible button uses Invoker Commands, so it opens the dialog without custom click handling.

```tsx {% path="app/ui/command-palette.tsx" %}
import { clientEntry } from "remix/ui";

export let CommandPalette = clientEntry(import.meta.url, function CommandPalette(handle) {
	return () => (
		<>
			<button type="button" commandfor={handle.id} command="show-modal">
				Open Command Palette
			</button>

			<dialog id={handle.id} aria-labelledby={`${handle.id}-title`}>
				<header>
					<h2 id={`${handle.id}-title`}>Command Palette</h2>
					<p>Search for an action to run.</p>
				</header>

				<label>
					<span>Search Commands</span>
					<input name="query" placeholder="Search commands..." />
				</label>

				<ul>
					<li>New Project</li>
					<li>Invite Teammate</li>
					<li>Open Settings</li>
				</ul>

				<button type="button" commandfor={handle.id} command="close">
					Close
				</button>
			</dialog>
		</>
	);
});
```

This works before adding the shortcut. The browser owns the dialog's open state, and both buttons target the same `id` through native commands.

`handle.id` gives this component instance a unique DOM ID, so you do not need a module-level constant like `command-palette`. If the page renders two command palettes, each button still targets its own dialog.

The client entry is still needed because the shortcut listens on `document`. Without JavaScript, the visible button remains the baseline way to open the dialog.

## Attach the Mixin

Import the mixin and pass it through the dialog's `mix` prop. The host stays a normal `<dialog>`, but it now responds to the global shortcut.

```tsx {% path="app/ui/command-palette.tsx" %}
import { clientEntry } from "remix/ui";

import { hotkey } from "../mixins/hotkey";

export let CommandPalette = clientEntry(import.meta.url, function CommandPalette(handle) {
	return () => (
		<>
			<button type="button" commandfor={handle.id} command="show-modal">
				Open Command Palette
			</button>

			<dialog id={handle.id} aria-labelledby={`${handle.id}-title`} mix={hotkey("mod+k")}>
				<header>
					<h2 id={`${handle.id}-title`}>Command Palette</h2>
					<p>Search for an action to run.</p>
				</header>

				<label>
					<span>Search Commands</span>
					<input name="query" placeholder="Search commands..." />
				</label>

				<ul>
					<li>New Project</li>
					<li>Invite Teammate</li>
					<li>Open Settings</li>
				</ul>

				<button type="button" commandfor={handle.id} command="close">
					Close
				</button>
			</dialog>
		</>
	);
});
```

When the user presses `Cmd+K` or `Ctrl+K`, the mixin prevents the browser default and toggles the dialog. If the dialog is closed, it calls `showModal()`. If the dialog is open, it calls `close()`.

Repeated `keydown` events are ignored, so holding the shortcut down does not rapidly open and close the dialog.

## Combine It With Styling

The `mix` prop can receive an array, so the shortcut can live next to styling mixins. This keeps the behavior and presentation on the same host.

```tsx {% path="app/ui/command-palette.tsx" %}
import { clientEntry, css } from "remix/ui";

import { hotkey } from "../mixins/hotkey";

export let CommandPalette = clientEntry(import.meta.url, function CommandPalette(handle) {
	return () => (
		<dialog
			id={handle.id}
			aria-labelledby={`${handle.id}-title`}
			mix={[
				hotkey("mod+k"),
				css({
					padding: "1rem",
					maxInlineSize: "40rem",
					borderRadius: "1rem",
				}),
			]}
		>
			<h2 id={`${handle.id}-title`}>Command Palette</h2>
			<p>Search for an action to run.</p>
		</dialog>
	);
});
```

The order is not important here because `hotkey` attaches behavior and `css` emits styles. If two styling mixins set the same property, then normal CSS ordering rules still apply.

## Use a Different Combo

The combo parser accepts a `+`-joined list of modifiers followed by the trigger key. Modifier names are case-insensitive, and `option` is treated the same as `alt`.

```tsx {% path="app/ui/command-palette.tsx" %}
// ... previous code

<dialog id={handle.id} aria-labelledby={`${handle.id}-title`} mix={hotkey("mod+shift+p")}>
	{/* dialog content */}
</dialog>
```

Use `mod` when the shortcut should feel native across desktop platforms. Use `ctrl`, `cmd`, or `meta` only when the product requirement needs that exact modifier.

## Target a Popover Instead

The same mixin also works with any element that has the `popover` attribute. In that case it calls `showPopover()` and `hidePopover()` instead of the dialog methods.

```tsx {% path="app/ui/help-popover.tsx" %}
import { clientEntry } from "remix/ui";

import { hotkey } from "../mixins/hotkey";

export let HelpPopover = clientEntry(import.meta.url, function HelpPopover(handle) {
	return () => (
		<>
			<button type="button" popovertarget={handle.id}>
				Show Shortcuts
			</button>

			<div id={handle.id} popover="manual" mix={hotkey("mod+/")}>
				<h2>Keyboard Shortcuts</h2>
				<p>Press Cmd+/ or Ctrl+/ to toggle this help panel.</p>
			</div>
		</>
	);
});
```

This is the same contract as the dialog example: keep a visible declarative trigger, then add the keyboard shortcut as a faster path to the same native open state.

## Final Thoughts

The `hotkey` mixin is a small adapter between a document-level keyboard shortcut and the platform's native open APIs. It works best when the host already has a no-JavaScript trigger through Invoker Commands or the Popover API.

You can extend this further by moving the combo into a prop, adding command filtering inside the dialog, or pairing the popover with a full shortcut reference.
