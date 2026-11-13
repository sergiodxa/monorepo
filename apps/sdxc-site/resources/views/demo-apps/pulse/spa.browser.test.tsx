/**
 * Runs Pulse like a visitor's browser does and holds it to the single-page baseline: moving
 * between screens and posting forms keep the shell mounted and never load a document, links
 * add one history entry and actions none, and Back returns to the previous screen.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterEach, describe, expect, test, vi } from "vitest";

import type { MountedApp } from "~/app/test/spa-harness";

import { mountApp } from "~/app/test/spa-harness";
import pulse from "~/resources/views/demo-apps/pulse";

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
	if (element === null) throw new Error("Pulse drew no shell");
	return element;
}

/** Presses a link or button the way a visitor does, so the island claims it first. */
async function press(element: Element | null) {
	if (!(element instanceof HTMLElement)) throw new Error("Nothing to press");
	element.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
	element.click();
}

/** The address of the screen now in `main`. */
function screenUrl(): string | undefined {
	return document.querySelector<HTMLElement>("[data-main-screen]")?.dataset.url;
}

describe("Pulse as a single-page app", () => {
	test("moves between screens in main alone, one history entry each", async () => {
		mounted = await mountApp(pulse, "pulse", "services");
		let marker = shell();
		let start = navigation.currentEntry?.index ?? 0;

		await press(document.querySelector('a[data-main-nav="incidents"]'));
		await vi.waitFor(() => expect(screenUrl()).toBe("/demo/apps/pulse/incidents"));
		await press(document.querySelector('a[data-main-nav="deployments"]'));
		await vi.waitFor(() => expect(screenUrl()).toBe("/demo/apps/pulse/deployments"));

		expect(shell()).toBe(marker);
		expect(performance.getEntriesByType("navigation")).toHaveLength(1);
		expect((navigation.currentEntry?.index ?? 0) - start).toBe(2);
		expect(mounted.requests.slice(-2)).toEqual([
			"GET /demo/apps/pulse/incidents main",
			"GET /demo/apps/pulse/deployments main",
		]);
		await vi.waitFor(() => expect(document.title).toContain("Deployments"));
	});

	test("posts a row action in place with its toast and no history entry", async () => {
		mounted = await mountApp(pulse, "pulse", "services");
		let marker = shell();
		let start = navigation.currentEntry?.index ?? 0;

		let button = document.querySelector<HTMLButtonElement>('form[action$="/pause"] button');
		button?.focus();
		await press(button);
		await vi.waitFor(() =>
			expect(document.querySelector('[data-slot="toast-item"]')?.textContent).toContain(
				"Service paused",
			),
		);

		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(document.activeElement).not.toBe(document.body);
		expect(shell()).toBe(marker);
		expect(navigation.currentEntry?.index ?? 0).toBe(start);
		expect(mounted.requests.at(-1)).toMatch(/^POST \/demo\/apps\/pulse\/services\/.+\/pause main$/);
	});

	test("loads Services without reloading the page, so the shell keeps what the browser set", async () => {
		mounted = await mountApp(pulse, "pulse", "services");
		let links = [...document.querySelectorAll('[data-slot="app-shell-nav"] a')];
		for (let link of links) link.setAttribute("data-visited", "");

		await new Promise((resolve) => setTimeout(resolve, 500));

		expect(mounted.requests).toEqual([]);
		expect(links.every((link) => link.hasAttribute("data-visited"))).toBe(true);
	});

	test("goes back to the previous screen without loading a document", async () => {
		mounted = await mountApp(pulse, "pulse", "services");
		let marker = shell();

		await press(document.querySelector('a[data-main-nav="incidents"]'));
		await vi.waitFor(() => expect(screenUrl()).toBe("/demo/apps/pulse/incidents"));
		navigation.back();
		await vi.waitFor(() => expect(screenUrl()).toBe("/demo/apps/pulse/services"));

		expect(shell()).toBe(marker);
		expect(performance.getEntriesByType("navigation")).toHaveLength(1);
	});
});
