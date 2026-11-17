/**
 * Runs Vesper like a visitor's browser does: every screen, the watch page and a profile switch
 * included, swaps into `main` without loading a document; My List redraws only its button's
 * frame; typing a search reloads only the results; Back returns to the last screen.
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

/** The main region a test marks to prove the document is never replaced. */
function bar(): Element {
	let element = document.querySelector("[data-main-region]");
	if (element === null) throw new Error("Vesper drew no main region");
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

		await press(
			document.querySelector('a[href="/demo/apps/vesper/title/tidewater?tab=episodes&season=2"]'),
		);
		await vi.waitFor(() =>
			expect(screenUrl()).toBe("/demo/apps/vesper/title/tidewater?tab=episodes&season=2"),
		);

		let episodes = [...document.querySelectorAll("[data-slot=episode-title]")];
		expect(episodes[0]?.textContent).toContain("Spring Tide");
		expect(performance.getEntriesByType("navigation")).toHaveLength(1);
	});

	test("adds a title to My List in place, with its toast and no history entry", async () => {
		mounted = await mountApp(vesper, "vesper", "title/signal-fire");
		let marker = bar();
		let start = navigation.currentEntry?.index ?? 0;

		let button = document.getElementById("vesper-list-icon-signal-fire");
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
		expect(mounted.requests.at(-1)).toBe(
			"POST /demo/apps/vesper/title/signal-fire/list vesper-list-icon-signal-fire",
		);
		expect(document.querySelector("[data-main-screen]")?.getAttribute("data-url")).toBe(
			"/demo/apps/vesper/title/signal-fire",
		);
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

	test("opens the watch page and comes back without loading a document", async () => {
		mounted = await mountApp(vesper, "vesper", "title/tidewater");
		let marker = bar();

		await press(document.querySelector('a[href="/demo/apps/vesper/watch/tidewater/2-3"]'));
		await vi.waitFor(() => expect(screenUrl()).toBe("/demo/apps/vesper/watch/tidewater/2-3"));
		expect(document.querySelector("[data-slot=video-player]")).not.toBeNull();
		expect(document.querySelector("[data-vesper-bar]")).toBeNull();

		await press(document.querySelector('a[href="/demo/apps/vesper/title/tidewater"]'));
		await vi.waitFor(() => expect(screenUrl()).toBe("/demo/apps/vesper/title/tidewater"));
		expect(bar()).toBe(marker);
		expect(performance.getEntriesByType("navigation")).toHaveLength(1);
	});

	test("switches profile from the picker in main, landing on home with its toast", async () => {
		mounted = await mountApp(vesper, "vesper", "profiles");

		await press(document.querySelector('button[formaction$="/profiles/theo"]'));
		await vi.waitFor(() => expect(screenUrl()).toBe("/demo/apps/vesper"));
		await vi.waitFor(() =>
			expect(document.querySelector('[data-slot="toast-item"]')?.textContent).toContain(
				"Watching as Theo",
			),
		);
		expect(mounted.requests.at(-1)).toBe("POST /demo/apps/vesper/profiles/theo main");
		expect(performance.getEntriesByType("navigation")).toHaveLength(1);
	});

	test("reloads only the results as a search is typed, keeping one history entry", async () => {
		mounted = await mountApp(vesper, "vesper", "search");
		let start = navigation.currentEntry?.index ?? 0;
		let field = document.querySelector<HTMLInputElement>('#vesper-search input[name="q"]')!;

		field.value = "halcyon";
		field.dispatchEvent(new Event("input", { bubbles: true }));
		await vi.waitFor(() => expect(location.search).toBe("?q=halcyon"));

		expect(mounted.requests.at(-1)).toBe(
			"GET /demo/apps/vesper/search?q=halcyon vesper-search-results",
		);
		expect(
			document.querySelector("#vesper-search-results, [data-search-count]")?.textContent,
		).toContain("Halcyon Station");
		expect(document.getElementById("vesper-search-status")?.textContent).toBe("1 result");
		expect(navigation.currentEntry?.index ?? 0).toBe(start);
		expect(field.isConnected).toBe(true);
	});

	test("switches a title's tab through the address without leaving the page", async () => {
		mounted = await mountApp(vesper, "vesper", "title/tidewater");
		let start = navigation.currentEntry?.index ?? 0;

		await press(document.querySelector('a[href="/demo/apps/vesper/title/tidewater?tab=details"]'));
		await vi.waitFor(() =>
			expect(screenUrl()).toBe("/demo/apps/vesper/title/tidewater?tab=details"),
		);

		expect(document.querySelector('section[aria-label="Details"]')?.textContent).toContain(
			"Maren Holt",
		);
		expect(document.querySelector('a[aria-current="page"][href$="tab=details"]')).not.toBeNull();
		expect((navigation.currentEntry?.index ?? 0) - start).toBe(1);
		expect(performance.getEntriesByType("navigation")).toHaveLength(1);
	});

	test("keeps focus on the genre chip it pressed rather than the heading", async () => {
		mounted = await mountApp(vesper, "vesper", "series");
		let chip = document.querySelector<HTMLElement>(
			'a[href="/demo/apps/vesper/series?genre=comedy"]',
		);
		chip?.focus();
		await press(chip);
		await vi.waitFor(() => expect(screenUrl()).toBe("/demo/apps/vesper/series?genre=comedy"));
		await vi.waitFor(() =>
			expect(document.activeElement?.getAttribute("href")).toBe(
				"/demo/apps/vesper/series?genre=comedy",
			),
		);
		expect(document.activeElement?.tagName).not.toBe("H1");
	});

	test("starts at the top after a profile switch posted from far down a page", async () => {
		mounted = await mountApp(vesper, "vesper", "series");
		let scroller = document.scrollingElement ?? document.documentElement;
		document.body.style.minBlockSize = "4000px";
		scroller.scrollTop = 1200;
		expect(scroller.scrollTop).toBeGreaterThan(0);

		await press(document.querySelector('form[action$="/profiles/theo"] button'));
		await vi.waitFor(() => expect(screenUrl()).toBe("/demo/apps/vesper"));
		await vi.waitFor(() => expect(scroller.scrollTop).toBe(0));
	});

	test("starts at the top after a profile switch that lands back on the page it left", async () => {
		mounted = await mountApp(vesper, "vesper", "");
		let scroller = document.scrollingElement ?? document.documentElement;
		document.body.style.minBlockSize = "6000px";
		scroller.scrollTop = 1500;
		expect(scroller.scrollTop).toBeGreaterThan(0);

		await press(document.querySelector('form[action$="/profiles/ines"] button'));
		await vi.waitFor(() =>
			expect(document.querySelector('[data-slot="toast-item"]')?.textContent).toContain(
				"Watching as Ines",
			),
		);
		await vi.waitFor(() => expect(scroller.scrollTop).toBe(0));
	});

	test("keeps the scroll where it was after a My List post on the same page", async () => {
		mounted = await mountApp(vesper, "vesper", "title/signal-fire");
		let scroller = document.scrollingElement ?? document.documentElement;
		document.body.style.minBlockSize = "6000px";
		scroller.scrollTop = 300;

		await press(document.getElementById("vesper-list-icon-signal-fire"));
		await vi.waitFor(() =>
			expect(document.querySelector('[data-slot="toast-item"]')?.textContent).toContain(
				"Signal Fire added to My List",
			),
		);
		expect(scroller.scrollTop).toBe(300);
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
