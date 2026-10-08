---
title: Keyboard shortcuts
description: Bind page-wide keys with keymap(), print each hint in the reader's own key caps, list them in a shortcuts panel, and announce what a key did.
section:
    title: Building Remix apps
    order: 3
order: 11
lastUpdated: 2026-10-08
---

An inbox someone works through all day earns keys: `j` and `k` to move between messages,
`e` to archive, `⌘K` to jump to search, and `?` to show what the keys are. This guide adds
those to a Remix v3 page with [`@sdxc/ui`](/api/ui): the `keymap()` mixin binds them, the
key-combo helpers print each hint in the glyphs of the keyboard in front of the reader,
`ShortcutList` lays out the help panel, and an `Announcer` tells a screen reader what each
keystroke did.

```bash
npm add remix @sdxc/ui @sdxc/u @sdxc/user-agent
```

Every shortcut presses something already on the page. Each message is a link and each has
an Archive button inside a form, so the page works by `Tab` and pointer with no script, and
the keys are a faster path to the same controls.

## Write each combo once

A combo is a string such as `"mod+k"`, `"escape"`, `"?"` or `"j"`, and the same spelling
is both matched against a keystroke and printed as the hint. Keep the page's shortcuts in
one list, so the bindings and the panel read from the same place:

```typescript {% title="app/inbox/shortcuts.ts" %}
export const INBOX_SHORTCUTS = [
	{ combo: "j", label: "Next message" },
	{ combo: "k", label: "Previous message" },
	{ combo: "e", label: "Archive the message" },
	{ combo: "mod+k", label: "Search the inbox" },
	{ combo: "?", label: "Show keyboard shortcuts" },
] as const;
```

`mod` is Command on Apple keyboards and Control everywhere else, which is what most
shortcuts mean. `ctrl` and `cmd` each name only their own key, for the rare binding that
really is Control on a Mac. A bare character names the character typed, so `"?"` matches
whatever Shift produced it, `"J"` and `"j"` are two different bindings, and a character
combo never fires while Control, Alt or Command is held. Any other combo matches exactly
the modifiers it lists, so `"mod+k"` stays quiet on `⌘⇧K`.

## Print hints in the reader's key caps

`keyComboGlyphs(combo, apple)` turns a combo into the caps to draw, in press order:
`["⌘", "K"]` on a Mac and `["Ctrl", "K"]` elsewhere. Which keyboard the reader has is in
the request, so the controller answers it once and the first paint already shows the right
glyphs:

```tsx {% title="app/http/controllers/inbox.tsx" %}
import { isApplePlatform } from "@sdxc/user-agent/helpers";
import { parse } from "@sdxc/user-agent";
import { createAction } from "remix/router";

import { Messages } from "~/app/data/messages";
import { InboxPage } from "~/resources/views/inbox";
import routes from "~/routes/web";

export default createAction(routes.inbox, async (ctx) => {
	let messages = await Messages.inbox(ctx.db);
	let apple = isApplePlatform(parse(ctx.request.headers.get("user-agent") ?? ""));

	return ctx.render(<InboxPage messages={messages} apple={apple} />);
});
```

The answer travels to the island as a prop, so hydration keeps the same glyphs the server
drew.

## Bind the keys

`keymap(bindings)` is a mixin: it listens on the document for as long as its host is
mounted, and runs the first binding a keystroke matches. Put it on the element that wraps
everything the keys act on. The island holding the list is that element here:

```tsx {% title="resources/components/inbox.tsx" %}
import type { Handle } from "remix/component";

import { visuallyHidden } from "@sdxc/u/a11y";
import { vstack } from "@sdxc/u/layout";
import { Button, Input, Modal, ShortcutList } from "@sdxc/ui";
import { Announcer } from "@sdxc/ui/behaviors";
import { keymap } from "@sdxc/ui/mixins";
import { keyComboGlyphs } from "@sdxc/ui/utils";
import { clientEntry } from "remix/component";

import { INBOX_SHORTCUTS } from "~/app/inbox/shortcuts";

export type InboxMessage = {
	id: string;
	subject: string;
	href: string;
	archiveHref: string;
};

export type InboxProps = { messages: InboxMessage[]; apple: boolean };

export const Inbox = clientEntry(
	"/resources/components/inbox.tsx#Inbox",
	function Inbox(handle: Handle<InboxProps>) {
		let messages = handle.props.messages;
		let announcer = new Announcer({ hold: 1200 });
		announcer.addEventListener("change", () => handle.update(), {
			signal: handle.signal,
		});

		function rows() {
			return Array.from(
				document.querySelectorAll<HTMLAnchorElement>("[data-message] > a"),
			);
		}

		function move(step: number) {
			let links = rows();
			let index = links.findIndex((link) => link === document.activeElement);
			let next = Math.min(Math.max(index + step, 0), links.length - 1);
			links[next]?.focus();
		}

		async function archive() {
			let row = document.activeElement?.closest<HTMLElement>("[data-message]");
			let form = row?.querySelector("form");
			let message = messages.find((item) => item.id === row?.dataset.message);
			if (!form || !message) return;

			let response = await fetch(form.action, {
				method: "POST",
				body: new FormData(form),
			});
			if (!response.ok) return;

			messages = messages.filter((item) => item.id !== message.id);
			announcer.announce(`Archived “${message.subject}”`);
		}

		let bindings = {
			j: () => move(1),
			k: () => move(-1),
			e: () => void archive(),
			"mod+k": () =>
				document.querySelector<HTMLInputElement>("#search")?.focus(),
			"?": () =>
				document.querySelector<HTMLDialogElement>("#shortcuts")?.showModal(),
		};

		return () => (
			<div mix={[vstack({ gap: 4 }), keymap(bindings)]}>
				<Input
					id="search"
					type="search"
					name="q"
					aria-label="Search the inbox"
				/>
				<ul>
					{messages.map((message) => (
						<li key={message.id} data-message={message.id}>
							<a href={message.href}>{message.subject}</a>
							<form method="post" action={message.archiveHref}>
								<Button type="submit" variant="ghost" size="sm">
									Archive
								</Button>
							</form>
						</li>
					))}
				</ul>
				<Button
					type="button"
					variant="outline"
					commandfor="shortcuts"
					command="show-modal"
				>
					Keyboard shortcuts
				</Button>
				<Modal id="shortcuts" aria-labelledby="shortcuts-title">
					<Modal.Header>
						<Modal.Title id="shortcuts-title">
							Keyboard shortcuts
						</Modal.Title>
					</Modal.Header>
					<ShortcutList>
						{INBOX_SHORTCUTS.map((shortcut) => (
							<ShortcutList.Item
								key={shortcut.combo}
								keys={keyComboGlyphs(
									shortcut.combo,
									handle.props.apple,
								)}
							>
								{shortcut.label}
							</ShortcutList.Item>
						))}
					</ShortcutList>
					<Modal.Close commandfor="shortcuts" aria-label="Close" />
				</Modal>
				<div role="status" aria-live="polite" mix={[visuallyHidden()]}>
					{announcer.current?.text ?? ""}
				</div>
			</div>
		);
	},
);
```

A matched keystroke is default-prevented, so `⌘K` focuses the search field instead of the
browser's own address bar search. The latest map passed is the one a keystroke runs, so a
binding can read state set up in the component, and the mixin attaches its listener once
the host is in a document: on the server it renders nothing extra.

## Where the keys stand down

A page-wide `j` must never swallow the letter `j` typed into a field. The keymap stands
down for a keystroke that something else owns:

- one typed into an input, textarea, select, editable element or `role="textbox"`, which
  is why `j` typed into the search field stays a `j`
- one that is part of an IME composition, mid-way through a character
- one a handler nearer the target already default-prevented, such as a list's own arrow
  keys
- one pressed inside a `<dialog>` that sits outside the keymap's host

The last rule is the reason to put the shortcuts panel inside the island. A modal opened
elsewhere on the page keeps its keys to itself, while the panel, rendered inside the host,
still answers them. `Escape` closes it through the native `<dialog>`, and the Keyboard
shortcuts button opens the same panel by pointer.

For a single combo that only opens or closes one dialog or popover, `hotkey(combo)` on that
element is enough: `<dialog mix={[hotkey("mod+k")]}>` toggles it from anywhere on the
page.

## List the shortcuts

`ShortcutList` is a native `<dl>` in two columns: each `ShortcutList.Item` pairs the action
with a `<kbd>` per key, and every key run lines up on the right edge, so the panel reads
down one line. `keys` takes the caps already formatted, which is where `keyComboGlyphs`
fits; a combo with nothing to translate, such as `"?"`, prints as written.

The panel draws from `INBOX_SHORTCUTS` and the bindings name the same combo strings, so
changing a shortcut is one edit to the list and one to the binding beside it, and the
printed hint follows on every keyboard.

## Announce what a key did

Archiving by key removes a row with no visible confirmation, and a screen reader hears
nothing at all. The island owns an `Announcer` and renders its current message into a
visually hidden `role="status"` region. `hold: 1200` keeps each message current for 1.2
seconds and then moves to the next on its own, so pressing `e` three times in a row is
heard as three separate announcements in order. Without `hold`, the queue moves only when
your code calls `next()` or `dismiss(id)`.

`announce(text, "assertive")` moves a message ahead of the polite ones already queued, for
something the person has to hear now, such as a failed archive.

## Bind outside a component

Where the bindings come from a `ref` callback or plain script, `bindKeymap` takes the same
map and follows the same stand-down rules:

```typescript {% title="app/browser/shortcuts.ts" %}
import { bindKeymap } from "@sdxc/ui/mixins";

export function bindReaderKeys(scope: Element, signal: AbortSignal) {
	bindKeymap(
		document,
		{
			n: () =>
				document.querySelector<HTMLAnchorElement>("a[rel=next]")?.click(),
			p: () =>
				document.querySelector<HTMLAnchorElement>("a[rel=prev]")?.click(),
		},
		{ signal, scope },
	);
}
```

Aborting `signal` removes the listener. `scope` plays the host's part: a dialog inside it
answers the bindings, and every other dialog keeps its keys.

To match a combo in a handler of your own, `matchesKeyCombo(event, "mod+enter")` answers
whether a keystroke is exactly that combo, and `isTypingTarget(event.target)` whether it
was aimed at a field.

## Where to go next

- [Build the interface with remix/component](/docs/building-remix-apps/interface-with-remix-ui)
  — the components, layout mixins and islands this page builds on.
- [`@sdxc/ui`](/api/ui) — `Keyboard`, `ShortcutList`, the mixins and the behaviors.
- [`@sdxc/user-agent`](/api/user-agent) — the platform and form-factor questions a request
  answers.
