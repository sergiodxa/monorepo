/**
 * Runs Hangwell like a shopper's browser does: menus and filters swap into `main` without
 * loading a document, a variant pick swaps only the buy box and keeps the page where it was,
 * a review filter swaps only the reviews, and the phone layout neither overflows nor shows the
 * wide sidebar.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterEach, describe, expect, test, vi } from "vitest";
import { page } from "vitest/browser";

import type { MountedApp } from "~/app/test/spa-harness";

import { mountApp } from "~/app/test/spa-harness";
import hangwell from "~/resources/views/demo-apps/hangwell";

import "@sdxc/ui/reset.css";
import "@sdxc/ui/theme.css";

let mounted: MountedApp | undefined;

afterEach(() => {
	mounted?.dispose();
	mounted = undefined;
});

/** Presses a link the way a shopper does, so the island claims it first. */
async function press(element: Element | null) {
	if (!(element instanceof HTMLElement)) throw new Error("Nothing to press");
	element.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
	element.click();
}

/** The address of the screen now in `main`. */
function screenUrl(): string | undefined {
	return document.querySelector<HTMLElement>("[data-main-screen]")?.dataset.url;
}

/** The main region, which a test holds on to to prove the document is never replaced. */
function region(): Element {
	let element = document.querySelector("[data-main-region]");
	if (element === null) throw new Error("Hangwell drew no main region");
	return element;
}

describe("Hangwell as a single-page app", () => {
	test("goes from home to a style and a poster in main alone", async () => {
		await page.viewport(1440, 900);
		mounted = await mountApp(hangwell, "hangwell", "");
		let marker = region();

		await press(document.querySelector('a[href="/demo/apps/hangwell/shop/botanical"]'));
		await vi.waitFor(() => expect(screenUrl()).toBe("/demo/apps/hangwell/shop/botanical"));
		expect(document.querySelector("h1")?.textContent).toBe("Botanical");
		await press(document.querySelector('a[href="/demo/apps/hangwell/p/fern-study"]'));
		await vi.waitFor(() => expect(screenUrl()).toBe("/demo/apps/hangwell/p/fern-study"));

		expect(region()).toBe(marker);
		expect(performance.getEntriesByType("navigation")).toHaveLength(1);
		await vi.waitFor(() => expect(document.title).toContain("Fern Study"));
	});

	test("swaps only the buy box when a format is picked, keeping the page's scroll", async () => {
		await page.viewport(1440, 900);
		mounted = await mountApp(hangwell, "hangwell", "p/fern-study");
		let heading = document.querySelector("#reviews-title");
		let addButton = () =>
			[...document.querySelectorAll("button")].find((button) =>
				button.textContent?.startsWith("Add to bag"),
			);
		expect(addButton()?.textContent).toContain("€161.00");
		let scroller = document.scrollingElement ?? document.documentElement;
		scroller.scrollTop = 120;
		let before = scroller.scrollTop;
		expect(before).toBeGreaterThan(0);

		await press(document.querySelector('a[data-rmx-target="hw-buy"][href*="format=print"]'));
		await vi.waitFor(() => expect(addButton()?.textContent).toContain("€56.00"));

		expect(document.querySelector("#reviews-title")).toBe(heading);
		expect(scroller.scrollTop).toBe(before);
		expect(mounted.requests.at(-1)).toMatch(/format=print.* hw-buy$/);
	});

	test("filters reviews by stars in their own frame", async () => {
		await page.viewport(1440, 900);
		mounted = await mountApp(hangwell, "hangwell", "p/fern-study");
		let buy = [...document.querySelectorAll("button")].find((button) =>
			button.textContent?.startsWith("Add to bag"),
		);

		await press(
			document.querySelector('nav[aria-label="Filter reviews by stars"] a[href*="stars=5"]'),
		);
		await vi.waitFor(() => expect(mounted?.requests.at(-1)).toMatch(/stars=5.* hw-reviews$/));
		await vi.waitFor(() =>
			expect(
				document.querySelector('nav[aria-label="Filter reviews by stars"] [aria-current]')
					?.textContent,
			).toBe("5 ★"),
		);

		expect(
			[...document.querySelectorAll("button")].find((button) =>
				button.textContent?.startsWith("Add to bag"),
			),
		).toBe(buy);
	});

	test("lays a phone out in one column with the filters in a drawer", async () => {
		await page.viewport(375, 812);
		mounted = await mountApp(hangwell, "hangwell", "shop");

		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(375);
		let sidebar = document.querySelector('aside[aria-label="Filters"]');
		expect(sidebar === null ? "none" : getComputedStyle(sidebar).display).toBe("none");
		let open = [...document.querySelectorAll("button")].find((button) =>
			button.textContent?.startsWith("Filters"),
		);
		expect(open?.getBoundingClientRect().width).toBeGreaterThan(0);
	});
});
