/**
 * Runs Pinhole like a visitor's browser does: the rail and tab bar swap screens into `main`
 * without loading a document, a story opens from the tray and Escape returns home, a profile
 * tab is a link the address keeps, and the reels page opens scrolled to the reel it names.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterEach, describe, expect, test, vi } from "vitest";

import type { MountedApp } from "~/app/test/spa-harness";

import { mountApp } from "~/app/test/spa-harness";
import pinhole from "~/resources/views/demo-apps/pinhole";
import { REELS } from "~/resources/views/demo-apps/pinhole/data";

import "@sdxc/ui/reset.css";
import "@sdxc/ui/theme.css";

let mounted: MountedApp | undefined;

afterEach(() => {
	mounted?.dispose();
	mounted = undefined;
});

/** Presses a link or button the way a visitor does, so the island claims it first. */
function press(element: Element | null) {
	if (!(element instanceof HTMLElement)) throw new Error("Nothing to press");
	element.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
	element.click();
}

/** The address of the screen now in `main`. */
function screenUrl(): string | undefined {
	return document.querySelector<HTMLElement>("[data-main-screen]")?.dataset.url;
}

describe("Pinhole as a single-page app", () => {
	test("moves from home to Explore and Reels in main alone", async () => {
		mounted = await mountApp(pinhole, "pinhole", "");
		let region = document.querySelector("[data-main-region]");

		press(document.querySelector('a[data-main-nav="explore"]'));
		await vi.waitFor(() => expect(screenUrl()).toBe("/demo/apps/pinhole/explore"));
		press(document.querySelector('a[data-main-nav="reels"]'));
		await vi.waitFor(() => expect(screenUrl()).toBe("/demo/apps/pinhole/reels"));

		expect(document.querySelector("[data-main-region]")).toBe(region);
		expect(performance.getEntriesByType("navigation")).toHaveLength(1);
		expect(mounted.requests.slice(-2)).toEqual([
			"GET /demo/apps/pinhole/explore main",
			"GET /demo/apps/pinhole/reels main",
		]);
	});

	test("opens a story from the tray full screen, and Escape returns home", async () => {
		mounted = await mountApp(pinhole, "pinhole", "");

		press(document.querySelector('nav[aria-label="Stories"] a[href$="/stories/mara.quint/1"]'));
		await vi.waitFor(() =>
			expect(document.querySelector("[data-story-ready] [data-story-active]")?.id).toBe(
				"story-mara.quint",
			),
		);
		expect(document.querySelector('nav[aria-label="Primary"]')).toBeNull();

		document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
		await vi.waitFor(() => expect(screenUrl()).toBe("/demo/apps/pinhole"));
	});

	test("switches a profile's tab through the address", async () => {
		mounted = await mountApp(pinhole, "pinhole", "u/mara.quint");

		press(document.querySelector('a[href="/demo/apps/pinhole/u/mara.quint?tab=reels"]'));

		await vi.waitFor(() => expect(screenUrl()).toBe("/demo/apps/pinhole/u/mara.quint?tab=reels"));
		expect(document.querySelector('a[aria-current="page"][href$="?tab=reels"]')).not.toBeNull();
	});

	test("opens the reels feed scrolled to the reel its address names", async () => {
		let reel = REELS[3]!;
		mounted = await mountApp(pinhole, "pinhole", `reels/${reel.id}`);
		let scroller = document.querySelector<HTMLElement>("[data-slot=reel-feed-scroller]")!;
		let item = document.getElementById(`reel-${reel.id}`)!;

		await vi.waitFor(() => expect(item.hasAttribute("data-reel-active")).toBe(true));
		expect(Math.abs(scroller.scrollTop - item.offsetTop)).toBeLessThan(2);
	});
});
