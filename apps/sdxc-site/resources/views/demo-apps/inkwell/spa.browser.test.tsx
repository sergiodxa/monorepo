/**
 * Runs Inkwell like a visitor's browser does and holds it to the single-page baseline: moving
 * between screens swaps main alone with the sidebar kept, a settings save posts in place with
 * its toast and no history entry, and Back returns to the previous screen.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterEach, describe, expect, test, vi } from "vitest";

import type { MountedApp } from "~/app/test/spa-harness";

import { mountApp } from "~/app/test/spa-harness";
import inkwell from "~/resources/views/demo-apps/inkwell";

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
	if (element === null) throw new Error("Inkwell drew no shell");
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

describe("Inkwell as a single-page app", () => {
	test("moves between screens in main alone, one history entry each", async () => {
		mounted = await mountApp(inkwell, "inkwell", "posts");
		let marker = shell();
		let start = navigation.currentEntry?.index ?? 0;

		press(document.querySelector('a[data-main-nav="media"]'));
		await vi.waitFor(() => expect(screenUrl()).toBe("/demo/apps/inkwell/media"));
		press(document.querySelector('a[data-main-nav="settings"]'));
		await vi.waitFor(() => expect(screenUrl()).toBe("/demo/apps/inkwell/settings"));

		expect(shell()).toBe(marker);
		expect(performance.getEntriesByType("navigation")).toHaveLength(1);
		expect((navigation.currentEntry?.index ?? 0) - start).toBe(2);
		expect(mounted.requests.every((request) => request.endsWith(" main"))).toBe(true);
		expect(document.querySelector("[data-main-crumb]")?.textContent).toContain("Settings");
	});

	test("saves a settings section in place with its toast and no history entry", async () => {
		mounted = await mountApp(inkwell, "inkwell", "settings");
		let marker = shell();
		let start = navigation.currentEntry?.index ?? 0;
		let form = document
			.querySelector('input[name="section"][value="publication"]')
			?.closest("form");

		press(form?.querySelector('button[type="submit"], button:not([type])'));
		await vi.waitFor(() =>
			expect(document.querySelector('[data-slot="toast-item"]')?.textContent).toContain(
				"Settings saved",
			),
		);

		expect(shell()).toBe(marker);
		expect(navigation.currentEntry?.index ?? 0).toBe(start);
		expect(mounted.requests.at(-1)).toBe("POST /demo/apps/inkwell/settings/general main");
	});

	test("keeps focus on the page when a bulk action closes the selection bar it was in", async () => {
		mounted = await mountApp(inkwell, "inkwell", "posts");
		let row = document.querySelector<HTMLInputElement>('input[type="checkbox"][form="posts-bulk"]');
		row?.click();
		let publish = document.querySelector<HTMLButtonElement>(
			'button[form="posts-bulk"][value="publish"]',
		);
		await vi.waitFor(() => expect(publish?.checkVisibility()).toBe(true));
		publish?.focus();

		press(publish);
		await vi.waitFor(() =>
			expect(document.querySelector('[data-slot="toast-item"]')?.textContent).toContain(
				"published",
			),
		);

		await vi.waitFor(() => expect(document.activeElement).not.toBe(document.body));
		expect(document.activeElement?.checkVisibility()).toBe(true);
	});

	test("goes back to the previous screen without loading a document", async () => {
		mounted = await mountApp(inkwell, "inkwell", "posts");
		let marker = shell();

		press(document.querySelector('a[data-main-nav="media"]'));
		await vi.waitFor(() => expect(screenUrl()).toBe("/demo/apps/inkwell/media"));
		navigation.back();
		await vi.waitFor(() => expect(screenUrl()).toBe("/demo/apps/inkwell/posts"));

		expect(shell()).toBe(marker);
		expect(performance.getEntriesByType("navigation")).toHaveLength(1);
	});
});
