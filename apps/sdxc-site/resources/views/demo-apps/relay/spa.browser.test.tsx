/**
 * Runs Relay like a visitor's browser does and holds it to the single-page baseline: mailboxes,
 * conversations and contacts load into main with the sidebar kept, triage acts in place without
 * adding history, a reply redraws only the open conversation, and Back stays in the page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterEach, describe, expect, test, vi } from "vitest";

import type { MountedApp } from "~/app/test/spa-harness";

import { mountApp } from "~/app/test/spa-harness";
import relay from "~/resources/views/demo-apps/relay";

import "@sdxc/ui/reset.css";
import "@sdxc/ui/theme.css";

let mounted: MountedApp | undefined;

afterEach(() => {
	mounted?.dispose();
	mounted = undefined;
});

/** The sidebar element a test marks to prove it is never replaced. */
function shell(): Element {
	let element = document.querySelector('[data-slot="app-shell-nav"]');
	if (element === null) throw new Error("Relay drew no shell");
	return element;
}

/** Presses a link or button the way a visitor does, so the island claims it first. */
function press(element: Element | null | undefined) {
	if (!(element instanceof HTMLElement)) throw new Error("Nothing to press");
	element.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
	element.click();
}

/** The address of the screen now in `main`. */
function screenUrl(): string | undefined {
	return document.querySelector<HTMLElement>("[data-main-region] [data-main-screen]")?.dataset.url;
}

/** The text of the toasts on screen. */
function toasts(): string {
	return [...document.querySelectorAll('[data-slot="toast-item"]')]
		.map((toast) => toast.textContent)
		.join(" ");
}

describe("Relay as a single-page app", () => {
	test("opens mailboxes and contacts in main alone, one history entry each", async () => {
		mounted = await mountApp(relay, "relay", "inbox/2041");
		let marker = shell();
		let start = navigation.currentEntry?.index ?? 0;

		press(document.querySelector('a[data-main-nav="contacts"]'));
		await vi.waitFor(() => expect(screenUrl()).toBe("/demo/apps/relay/contacts"));
		press(document.querySelector('a[data-main-nav="view:inbox"]'));
		await vi.waitFor(() => expect(screenUrl()).toMatch(/^\/demo\/apps\/relay(\/inbox)?$/));

		expect(shell()).toBe(marker);
		expect(performance.getEntriesByType("navigation")).toHaveLength(1);
		expect((navigation.currentEntry?.index ?? 0) - start).toBe(2);
		expect(mounted.requests.every((request) => request.endsWith(" main"))).toBe(true);
	});

	test("archives in place with an Undo toast and no history entry", async () => {
		mounted = await mountApp(relay, "relay", "inbox/2041");
		let marker = shell();
		let start = navigation.currentEntry?.index ?? 0;

		press(document.querySelector('button[name="intent"][value="archive"]'));
		await vi.waitFor(() => expect(toasts()).toContain("archived"));

		expect(shell()).toBe(marker);
		expect(navigation.currentEntry?.index ?? 0).toBe(start);
		expect(mounted.requests.at(-1)).toMatch(/^POST \/demo\/apps\/relay\/inbox\/2041 main$/);
		expect(location.pathname).not.toBe("/demo/apps/relay/inbox/2041");
	});

	test("sends a reply through the conversation pane alone", async () => {
		mounted = await mountApp(relay, "relay", "inbox/2041");
		let list = document.querySelector("[data-split-view-item]")?.closest("ul, ol, [role='list']");
		let field = document.querySelector<HTMLTextAreaElement>('textarea[name="body"]');
		if (field === null) throw new Error("No reply field");
		field.value = "Thanks, sending it now.";

		press(field.form?.querySelector('button[type="submit"], button:not([type])'));
		await vi.waitFor(() => expect(toasts()).toContain("Reply sent"));

		expect(mounted.requests.at(-1)).toMatch(/^POST .+ relay-conversation$/);
		expect(document.querySelector("[data-split-view-item]")?.closest("ul, ol, [role='list']")).toBe(
			list,
		);
	});

	test("goes back to the previous conversation without loading a document", async () => {
		mounted = await mountApp(relay, "relay", "inbox/2041");
		let marker = shell();

		press(document.querySelector('a[data-main-nav="contacts"]'));
		await vi.waitFor(() => expect(screenUrl()).toBe("/demo/apps/relay/contacts"));
		navigation.back();
		await vi.waitFor(() => expect(screenUrl()).toBe("/demo/apps/relay/inbox/2041"));

		expect(shell()).toBe(marker);
		expect(performance.getEntriesByType("navigation")).toHaveLength(1);
	});
});
