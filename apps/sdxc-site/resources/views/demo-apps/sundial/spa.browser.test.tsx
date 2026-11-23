/**
 * Runs Sundial like a visitor's browser does: views swap into `main` without loading a document,
 * a drag on the grid posts the move into `main`, the edit dialog opens as a modal from its
 * address and Escape returns to the screen, and a phone gets three days under a strip of dates.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterAll, afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { page } from "vitest/browser";

import type { MountedApp } from "~/app/test/spa-harness";

import { mountApp } from "~/app/test/spa-harness";
import sundial from "~/resources/views/demo-apps/sundial";

import "@sdxc/ui/reset.css";
import "@sdxc/ui/theme.css";

/**
 * The moment every test runs at: a Wednesday in the week the tests open with `?d=2026-11-18`.
 * Sundial seeds its calendar for the week holding today, so a pinned clock keeps the seeded
 * events in the week the tests look at on any day the suite runs.
 */
const NOW = new Date("2026-11-18T15:00:00Z");

let mounted: MountedApp | undefined;

beforeEach(() => {
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(NOW);
});

afterEach(() => {
	mounted?.dispose();
	mounted = undefined;
	vi.restoreAllMocks();
	vi.useRealTimers();
});

afterAll(async () => {
	await page.viewport(414, 896);
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

/** Sends one mouse pointer event at a position. */
function pointer(target: EventTarget, type: string, x: number, y: number): void {
	target.dispatchEvent(
		new PointerEvent(type, {
			bubbles: true,
			cancelable: true,
			clientX: x,
			clientY: y,
			pointerId: 1,
			pointerType: "mouse",
			button: 0,
		}),
	);
}

describe("Sundial as a single-page app", () => {
	test("switches views in main alone, keeping the document", async () => {
		await page.viewport(1440, 900);
		mounted = await mountApp(sundial, "sundial", "?d=2026-11-18");
		let region = document.querySelector("[data-main-region]");

		await press(
			document.querySelector(
				'nav[aria-label="Views"] a[href="/showcase/sundial/demo/month?d=2026-11-18"]',
			),
		);
		await vi.waitFor(() => expect(screenUrl()).toBe("/showcase/sundial/demo/month?d=2026-11-18"));
		expect(document.querySelector('[data-slot="month-view"]')).not.toBeNull();
		await press(
			document.querySelector(
				'nav[aria-label="Views"] a[href="/showcase/sundial/demo/agenda?d=2026-11-18"]',
			),
		);
		await vi.waitFor(() => expect(screenUrl()).toBe("/showcase/sundial/demo/agenda?d=2026-11-18"));

		expect(document.querySelector("[data-main-region]")).toBe(region);
		expect(performance.getEntriesByType("navigation")).toHaveLength(1);
	});

	test("posts a dragged event's new day and time into main", async () => {
		await page.viewport(1440, 900);
		let submit = vi.spyOn(sundial, "submit");
		mounted = await mountApp(sundial, "sundial", "?d=2026-11-18");
		let grid = document.getElementById("sundial-week")!;
		await vi.waitFor(() =>
			expect(
				grid.querySelector<HTMLElement>('[data-slot="time-grid-body"]')!.scrollTop,
			).toBeGreaterThan(0),
		);
		let block = grid.querySelector<HTMLElement>(
			'[data-slot="time-grid-event"][data-editable][data-id^="review~"]',
		)!;
		let from = block.getBoundingClientRect();
		let target = grid.querySelector<HTMLElement>(
			'[data-slot="time-grid-column"][data-date="2026-11-17"]',
		)!;
		let hour = target.getBoundingClientRect().height / 24;
		let trigger = block.querySelector('[data-slot="time-grid-trigger"]')!;
		pointer(trigger, "pointerdown", from.left + 8, from.top + 8);
		pointer(window, "pointermove", from.left + 30, from.top + 30);
		pointer(
			window,
			"pointermove",
			target.getBoundingClientRect().left + 20,
			from.top + 8 + hour * 2,
		);
		pointer(window, "pointerup", target.getBoundingClientRect().left + 20, from.top + 8 + hour * 2);

		await vi.waitFor(() => expect(submit).toHaveBeenCalled());
		let [path, form] = submit.mock.calls[0]!;
		expect(path).toBe("move");
		expect(Object.fromEntries(form)).toMatchObject({
			id: block.dataset.id,
			date: "2026-11-17",
			start: "900",
			end: "990",
			back: "?d=2026-11-18",
		});
		expect(mounted.requests.at(-1)).toBe("POST /showcase/sundial/demo/move main");
	});

	test("opens the edit dialog as a modal from its address, and Escape returns to the week", async () => {
		await page.viewport(1440, 900);
		mounted = await mountApp(sundial, "sundial", "?d=2026-11-18");
		let edit = document.querySelector<HTMLAnchorElement>('a[href*="edit=review~"]');
		await press(edit);
		await vi.waitFor(() =>
			expect(document.querySelector<HTMLDialogElement>("#sundial-event")?.matches(":modal")).toBe(
				true,
			),
		);
		expect(
			document.querySelector<HTMLInputElement>('#sundial-event input[name="title"]')?.value,
		).toBe("Roadmap review");

		document.querySelector<HTMLDialogElement>("#sundial-event")!.close();
		await vi.waitFor(() => expect(screenUrl()).toBe("/showcase/sundial/demo?d=2026-11-18"));
		expect(document.querySelector("#sundial-event")).toBeNull();
	});

	test("shows a phone three days under a strip of dates, as wide as the screen", async () => {
		await page.viewport(375, 812);
		mounted = await mountApp(sundial, "sundial", "?d=2026-11-18");
		let phone = document.querySelector<HTMLElement>("[data-sundial-phone]")!;
		await vi.waitFor(() => expect(getComputedStyle(phone).display).toBe("flex"));
		expect(
			getComputedStyle(document.querySelector<HTMLElement>("[data-sundial-wide]")!).display,
		).toBe("none");
		expect(phone.querySelectorAll('[data-slot="time-grid-column"]')).toHaveLength(3);
		expect(
			phone
				.querySelector('[data-slot="day-strip"] [aria-current="date"]')
				?.getAttribute("data-date"),
		).toBe("2026-11-18");
		expect(document.documentElement.scrollWidth).toBe(375);
	});
});
