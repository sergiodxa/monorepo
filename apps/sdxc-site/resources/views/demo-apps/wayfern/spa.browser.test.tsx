/**
 * Runs Wayfern like a visitor's browser does: searching, filtering and opening a stay swap into
 * `main` without loading a document; a listing and its pin light each other; picking dates in
 * the search bar fills the form in place, and on a listing re-prices the booking card.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterEach, describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";

import type { MountedApp } from "~/app/test/spa-harness";

import { mountApp } from "~/app/test/spa-harness";
import wayfern from "~/resources/views/demo-apps/wayfern";

import { findStay } from "./data";
import { addDays, today } from "./days";
import { firstOpening } from "./pricing";

import "@sdxc/ui/reset.css";
import "@sdxc/ui/theme.css";

let mounted: MountedApp | undefined;

afterEach(() => {
	mounted?.dispose();
	mounted = undefined;
});

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

/** The main region, which a test keeps hold of to prove the document is never replaced. */
function region(): Element {
	let element = document.querySelector("[data-main-region]");
	if (element === null) throw new Error("Wayfern drew no main region");
	return element;
}

describe("Wayfern as a single-page app", () => {
	test("goes from home to a place's results and a stay in main alone", async () => {
		await page.viewport(1280, 900);
		mounted = await mountApp(wayfern, "wayfern", "");
		let marker = region();

		await press(document.querySelector('a[href="/demo/apps/wayfern/s?where=furnas"]'));
		await vi.waitFor(() => expect(screenUrl()).toBe("/demo/apps/wayfern/s?where=furnas"));
		expect(document.querySelector("h1")?.textContent).toBe("3 stays in Furnas");
		await press(document.querySelector('[data-stay="the-canopy"] h2 a'));
		await vi.waitFor(() => expect(screenUrl()).toBe("/demo/apps/wayfern/stay/the-canopy"));

		expect(region()).toBe(marker);
		expect(performance.getEntriesByType("navigation")).toHaveLength(1);
		await vi.waitFor(() => expect(document.title).toContain("The Canopy"));
	});

	test("keeps filters in the address and lights a stay's pin while its card is hovered", async () => {
		await page.viewport(1280, 900);
		mounted = await mountApp(wayfern, "wayfern", "s?where=furnas");

		await press(document.querySelector('a[href="/demo/apps/wayfern/s?where=furnas&type=cabin"]'));
		await vi.waitFor(() =>
			expect(screenUrl()).toBe("/demo/apps/wayfern/s?where=furnas&type=cabin"),
		);
		let cards = [...document.querySelectorAll("[data-stay]")].map((card) =>
			card.getAttribute("data-stay"),
		);
		expect(cards.sort((a, b) => (a ?? "").localeCompare(b ?? ""))).toEqual([
			"mossback-lodge",
			"pinecone-a-frame",
		]);

		let card = () => document.querySelector<HTMLElement>('[data-stay="pinecone-a-frame"] h2 a')!;
		let pin = () =>
			document.querySelector('[data-slot=map-marker][data-map-key="pinecone-a-frame"]');
		await vi.waitFor(() => expect(document.querySelector("[data-map-key]")).not.toBeNull());
		await vi.waitFor(
			async () => {
				await userEvent.unhover(card(), { timeout: 1000 });
				await userEvent.hover(card(), { timeout: 1000 });
				expect(pin()?.hasAttribute("data-highlighted")).toBe(true);
			},
			{ timeout: 10_000, interval: 100 },
		);
		expect(document.querySelector('[data-map-key="mossback-lodge"][data-highlighted]')).toBeNull();
	});

	test("picks dates in the search bar's calendar without leaving home", async () => {
		await page.viewport(1280, 900);
		mounted = await mountApp(wayfern, "wayfern", "");
		let start = addDays(today(), 10);
		let end = addDays(today(), 13);
		let requests = mounted.requests.length;

		await press(document.querySelector('[popovertarget="hero-dates-panel"]'));
		await press(document.querySelector(`#hero-dates-panel a[data-date="${start}"]`));
		await vi.waitFor(() =>
			expect(document.querySelector<HTMLInputElement>("#hero-dates-checkin")?.value).toBe(start),
		);
		await press(document.querySelector(`#hero-dates-panel a[data-date="${end}"]`));
		await vi.waitFor(() =>
			expect(document.querySelector<HTMLInputElement>("#hero-dates-checkout")?.value).toBe(end),
		);
		expect(mounted.requests.length).toBe(requests);
		expect(document.querySelector("#hero-dates-panel")?.textContent).toContain("3 nights");
	});

	test("re-prices the booking card from the listing's calendar, then reserves", async () => {
		await page.viewport(1280, 900);
		let stay = findStay("the-canopy")!;
		let open = firstOpening(stay, addDays(today(), 20), 3)!;
		mounted = await mountApp(wayfern, "wayfern", "stay/the-canopy");

		await press(document.querySelector(`#availability a[data-date="${open.start}"]`));
		await vi.waitFor(() => expect(screenUrl()).toContain(`checkin=${open.start}`));
		await press(document.querySelector(`#availability a[data-date="${open.end}"]`));
		await vi.waitFor(() => expect(screenUrl()).toContain(`checkout=${open.end}`));

		let total = () =>
			document.querySelector<HTMLOutputElement>("#wayfern-booking output[name=total]");
		await vi.waitFor(() => expect(total()?.textContent).toMatch(/^\$[\d,.]+$/));
		await press(document.querySelector("#wayfern-booking button[formaction]"));
		await vi.waitFor(() =>
			expect(screenUrl()).toMatch(/\/demo\/apps\/wayfern\/book\/the-canopy\?/),
		);
		expect(document.querySelector("h1")?.textContent).toBe("Confirm and pay");
		expect(document.querySelectorAll('input[name="card"][type="radio"]')).toHaveLength(3);
	});

	test("picks both flights, a fare and seats, then reaches passengers, all in main", async () => {
		await page.viewport(1280, 900);
		let depart = addDays(today(), 30);
		mounted = await mountApp(
			wayfern,
			"wayfern",
			`flights?from=SRL&to=MRW&depart=${depart}&return=${addDays(depart, 5)}`,
		);
		let marker = region();

		await press(document.querySelector("#flight-results ~ ol a[aria-label^='Select']"));
		await vi.waitFor(() => expect(document.querySelector("h1")?.textContent).toContain("Return"));
		await press(document.querySelector("#flight-results ~ ol a[aria-label^='Select']"));
		await vi.waitFor(() => expect(document.querySelector("h1")?.textContent).toBe("Your flights"));
		await press(document.querySelector('a[href*="/flights/fares?"]'));
		await vi.waitFor(() =>
			expect(document.querySelector("h1")?.textContent).toBe("Choose your fare"),
		);
		await press(document.querySelector("form[action$='/flights/seats'] button[type=submit]"));
		await vi.waitFor(() => expect(document.querySelector("h1")?.textContent).toBe("Pick a seat"));
		for (
			let step = 0;
			step < 6 && document.querySelector("h1")?.textContent === "Pick a seat";
			step++
		) {
			let seat = document.querySelector<HTMLInputElement>(
				"input[name=seat][type=radio]:not(:disabled)",
			)!;
			seat.click();
			let before = screenUrl();
			await press(document.querySelector("form[action$='/flights/seats'] button[type=submit]"));
			await vi.waitFor(() => expect(screenUrl()).not.toBe(before));
		}
		await vi.waitFor(() =>
			expect(document.querySelector("h1")?.textContent).toBe("Passengers and payment"),
		);
		expect(region()).toBe(marker);
		expect(performance.getEntriesByType("navigation")).toHaveLength(1);
		expect(document.querySelectorAll("input[name=card]")).toHaveLength(3);
	});

	test("switches between the list and the map on a phone", async () => {
		await page.viewport(390, 844);
		mounted = await mountApp(wayfern, "wayfern", "s");

		await press(document.querySelector('a[href="/demo/apps/wayfern/s?view=map"]'));
		await vi.waitFor(() => expect(screenUrl()).toBe("/demo/apps/wayfern/s?view=map"));
		let map = document.querySelector('aside[aria-label="Map"]')!;
		expect(map.getBoundingClientRect().height).toBeGreaterThan(400);
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(390);
	});
});
