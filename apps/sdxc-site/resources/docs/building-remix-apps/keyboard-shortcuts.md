---
title: Keyboard shortcuts
description: Bind page-wide keys with keymap(), print each hint in the reader's own key caps, list them in a shortcuts panel, and announce what a key did.
section:
    title: Building Remix apps
    order: 4
order: 11
lastUpdated: 2026-10-25
outcomes:
    - "How to bind page-wide keys with `keymap()` from one combo definition"
    - "How to print each hint in the reader's own key caps and list it in a shortcuts panel"
    - "When a key stands down and how to announce what it did"
---

An inbox someone works through all day earns keys: `j` and `k` to move between messages,
`e` to archive, `⌘K` to jump to search, and `?` to show what the keys are. This guide adds
those to a Remix v3 page with [`@sdxc/ui`](/api/ui): `keymap()` binds them, `keyComboGlyphs`
prints each hint in the reader's key caps, `ShortcutList` lays out the help panel, and an
`Announcer` tells a screen reader what each keystroke did.

```bash
npm add @sdxc/u @sdxc/ui @sdxc/user-agent remix
```

Every shortcut presses something already on the page, so the page works by `Tab` and pointer
with no script, and the keys are a faster path to the same controls.

## Write each combo once

A combo is a string such as `"mod+k"`, `"escape"`, `"?"` or `"j"`, and the same spelling
is both matched against a keystroke and printed as the hint. Keep the page's shortcuts in
one list, so the bindings and the panel read from the same place:

```typescript {% title="resources/views/inbox/shortcuts.ts" %}
export const INBOX_SHORTCUTS = [
	{ combo: "j", label: "Next message" },
	{ combo: "k", label: "Previous message" },
	{ combo: "e", label: "Archive the message" },
	{ combo: "mod+k", label: "Search the inbox" },
	{ combo: "?", label: "Show keyboard shortcuts" },
] as const;
```

`mod` is Command on Apple keyboards and Control everywhere else. A bare character names the
character typed, so `"?"` matches whatever Shift produced it, and any other combo matches
exactly the modifiers it lists, so `"mod+k"` stays quiet on `⌘⇧K`.

## Print hints in the reader's key caps

`keyComboGlyphs(combo, apple)` turns a combo into the caps to draw: `["⌘", "K"]` on a Mac and
`["Ctrl", "K"]` elsewhere. The controller reads the platform from the request, so the first
paint already shows the right glyphs, and the island receives it as a prop:

```tsx {% title="app/http/controllers/inbox.tsx" %}
import { isApplePlatform } from "@sdxc/user-agent/helpers";
import { parse } from "@sdxc/user-agent";
import { createAction } from "remix/router";

import { Messages } from "~/app/models/messages";
import { InboxPage } from "~/resources/views/inbox";
import routes from "~/routes/web";

export default createAction(routes.inbox, async (ctx) => {
	let messages = await Messages.inbox(ctx.db);
	let apple = isApplePlatform(parse(ctx.request.headers.get("user-agent") ?? ""));

	return ctx.render(<InboxPage messages={messages} apple={apple} />);
});
```

## Bind the keys

`keymap(bindings)` is a mixin that listens on the document while its host is mounted and runs
the first binding a keystroke matches. Put it on the element that wraps everything the keys act
on. The same island renders the shortcuts panel with `ShortcutList` and announces each archive:

```tsx {% title="resources/components/inbox.tsx" %}
import type { Handle } from "remix/component";

import { visuallyHidden } from "@sdxc/u/a11y";
import { vstack } from "@sdxc/u/layout";
import { Button, Input, Modal, ShortcutList } from "@sdxc/ui";
import { Announcer } from "@sdxc/ui/behaviors";
import { keymap } from "@sdxc/ui/mixins";
import { keyComboGlyphs } from "@sdxc/ui/utils";
import { clientEntry } from "remix/component";

import { INBOX_SHORTCUTS } from "~/resources/views/inbox/shortcuts";

export interface InboxMessage {
	id: string;
	subject: string;
	href: string;
	archiveHref: string;
}

export interface InboxProps {
	messages: InboxMessage[];
	apple: boolean;
}

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
browser's own search.

## Know when the keys stand down

A page-wide `j` must never swallow the letter `j` typed into a field. The keymap stands
down for a keystroke that something else owns:

- one typed into an input, textarea, select, editable element or `role="textbox"`, which
  is why `j` typed into the search field stays a `j`
- one that is part of an IME composition, mid-way through a character
- one a handler nearer the target already default-prevented, such as a list's own arrow
  keys
- one pressed inside a `<dialog>` that sits outside the keymap's host

> [!NOTE]
> Render the shortcuts panel inside the keymap's host. A modal opened elsewhere on the page
> keeps its keys to itself, while the panel, rendered inside the host, still answers them.

## List the shortcuts and announce what a key did

`ShortcutList` is a native `<dl>` pairing each action with a `<kbd>` per key, and `keys` takes
the caps `keyComboGlyphs` formats. The panel and the bindings both read `INBOX_SHORTCUTS`'
combo strings, so the printed hint follows a changed shortcut on every keyboard.

Archiving by key removes a row with no visible confirmation, so the island renders its
`Announcer`'s current message into a visually hidden `role="status"` region. `hold: 1200` keeps
each message for 1.2 seconds before moving to the next, so pressing `e` three times is heard as
three announcements in order.

## Test the hints per keyboard

The island renders on the server with the panel inside it, so one request per platform proves
each reader sees their own glyphs. `migrate()` prepares the in-memory database, as
[Test Workers apps](/docs/operations-and-testing/testing#drive-the-real-router) sets up:

```typescript {% title="app/http/controllers/inbox.test.tsx" %}
import { beforeAll, expect, test } from "vitest";

import { createWebRouter } from "~/app/initializers/router";
import { migrate } from "~/app/test/database";
import routes from "~/routes/web";

const MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15";
const WINDOWS = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

beforeAll(migrate);

async function inboxFor(userAgent: string) {
	let url = new URL(routes.inbox.href(), "https://example.com");
	let response = await createWebRouter().fetch(
		new Request(url, { headers: { "User-Agent": userAgent } }),
	);
	return response.text();
}

test("prints the search hint in the reader's key caps", async () => {
	expect(await inboxFor(MAC)).toContain("⌘");
	expect(await inboxFor(WINDOWS)).toContain("Ctrl");
});
```

## Where to go next

- [Build the interface with remix/component](/docs/building-remix-apps/interface-with-remix-ui)
  — the components, layout mixins and islands this page builds on.
- [`@sdxc/ui`](/api/ui) — `Keyboard`, `ShortcutList`, the mixins and the behaviors.
- [`@sdxc/user-agent`](/api/user-agent) — the platform and form-factor questions a request
  answers.
