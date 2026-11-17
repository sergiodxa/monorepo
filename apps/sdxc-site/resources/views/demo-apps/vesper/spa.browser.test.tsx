/**
 * Runs Vesper like a visitor's browser does: moving between screens and adding a title to
 * My List keep the top bar mounted and never load a document, the nav follows the screen in
 * main, Back returns to the last screen, and each shelf's paging buttons appear and step.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterEach, describe, expect, test, vi } from "vitest";

import type { MountedApp } from "~/app/test/spa-harness";

import { mountApp } from "~/app/test/spa-harness";
import vesper from "~/resources/views/demo-apps/vesper";

import "@sdxc/ui/reset.css";
import "@sdxc/ui/theme.css";

let mounted: MountedApp | undefined;

afterEach(() => {
	mounted?.dispose();
	mounted = undefined;
});

/** The top bar a test marks to prove it is never replaced. */
function bar(): Element {
	let element = document.querySelector("[data-vesper-bar]");
	if (element === null) throw new Error("Vesper drew no top bar");
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

describe("Vesper as a single-page app", () => {
	test("moves from home to a catalogue and a title in main alone, marking the nav", async () => {
		mounted = await mountApp(vesper, "vesper", "");
		let marker = bar();
		let start = navigation.currentEntry?.index ?? 0;

		await press(document.querySelector('nav[aria-label="Primary"] a[data-main-nav="series"]'));
		await vi.waitFor(() => expect(screenUrl()).toBe("/demo/apps/vesper/series"));
		await press(document.querySelector('a[href="/demo/apps/vesper/title/tidewater"]'));
		await vi.waitFor(() => expect(screenUrl()).toBe("/demo/apps/vesper/title/tidewater"));

		expect(bar()).toBe(marker);
		expect(performance.getEntriesByType("navigation")).toHaveLength(1);
		expect((navigation.currentEntry?.index ?? 0) - start).toBe(2);
		expect(mounted.requests.slice(-2)).toEqual([
			"GET /demo/apps/vesper/series main",
			"GET /demo/apps/vesper/title/tidewater main",
		]);
		await vi.waitFor(() => expect(document.title).toContain("Tidewater"));
		let current = [...document.querySelectorAll('[data-main-nav][aria-current="page"]')];
		expect(current.map((link) => link.getAttribute("data-main-nav"))).toContain("series");
	});

	test("picks a season through the address without leaving the title", async () => {
		mounted = await mountApp(vesper, "vesper", "title/tidewater");

		await press(document.querySelector('a[href="/demo/apps/vesper/title/tidewater?season=2"]'));
		await vi.waitFor(() => expect(screenUrl()).toBe("/demo/apps/vesper/title/tidewater?season=2"));

		let episodes = [...document.querySelectorAll("[data-slot=episode-title]")];
		expect(episodes[0]?.textContent).toContain("Spring Tide");
		expect(performance.getEntriesByType("navigation")).toHaveLength(1);
	});

	test("adds a title to My List in place, with its toast and no history entry", async () => {
		mounted = await mountApp(vesper, "vesper", "title/signal-fire");
		let marker = bar();
		let start = navigation.currentEntry?.index ?? 0;

		let button = document.getElementById("vesper-list-signal-fire");
		expect(button?.getAttribute("aria-pressed")).toBe("false");
		button?.focus();
		await press(button);
		await vi.waitFor(() =>
			expect(document.querySelector('[data-slot="toast-item"]')?.textContent).toContain(
				"Signal Fire added to My List",
			),
		);

		expect(bar()).toBe(marker);
		expect(navigation.currentEntry?.index ?? 0).toBe(start);
		expect(mounted.requests.at(-1)).toBe("POST /demo/apps/vesper/title/signal-fire/list main");
	});

	test("goes back to the previous screen without loading a document", async () => {
		mounted = await mountApp(vesper, "vesper", "my-list");
		let marker = bar();

		await press(document.querySelector('nav[aria-label="Primary"] a[data-main-nav="films"]'));
		await vi.waitFor(() => expect(screenUrl()).toBe("/demo/apps/vesper/films"));
		navigation.back();
		await vi.waitFor(() => expect(screenUrl()).toBe("/demo/apps/vesper/my-list"));

		expect(bar()).toBe(marker);
		expect(performance.getEntriesByType("navigation")).toHaveLength(1);
	});

	test("reveals each shelf's paging buttons once the island runs", async () => {
		mounted = await mountApp(vesper, "vesper", "");

		await vi.waitFor(() =>
			expect(document.querySelector<HTMLButtonElement>("[data-video-shelf-step='1']")?.hidden).toBe(
				false,
			),
		);
		let shelves = document.querySelectorAll("[data-slot=video-shelf]");
		expect(shelves.length).toBeGreaterThan(5);
	});
});
