/**
 * Holds the month view to its contract in a real browser: whole weeks from the one holding the
 * 1st, bars across the days a multi-day event covers, a "+N more" link once a day overflows,
 * today marked, and dots in place of titles on a narrow container without widening the page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterAll, afterEach, describe, expect, test } from "vitest";
import { page } from "vitest/browser";

import type { MonthView as MonthViewTypes } from "./month-view.js";

import { MonthView } from "./month-view.js";

import "../reset.css";
import "../theme.css";

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
});

afterAll(async () => {
	await page.viewport(414, 896);
});

/** A trip across a week boundary, a busy Wednesday, and a quiet Friday. */
const EVENTS: MonthViewTypes.Event[] = [
	{ id: "trip", start: "2026-11-13", end: "2026-11-16", title: "Lisbon trip", color: "teal" },
	{ id: "e1", start: "2026-11-18", time: "9 AM", title: "Standup" },
	{ id: "e2", start: "2026-11-18", time: "11 AM", title: "Design review" },
	{ id: "e3", start: "2026-11-18", time: "2 PM", title: "1:1 with Mara" },
	{ id: "e4", start: "2026-11-18", time: "4 PM", title: "Launch prep" },
	{ id: "e5", start: "2026-11-20", time: "10 AM", title: "Dentist", href: "#dentist" },
	{ id: "e6", start: "2026-11-24", time: "1 PM", title: "Roadmap review" },
];

/** Mounts November 2026 in a box of the given width, filling `height` pixels when given. */
function mount(width = 900, height?: number): HTMLElement {
	mounted = render(
		<div
			style={`inline-size:${width}px${height === undefined ? "" : `; block-size:${height}px; display:flex; flex-direction:column`}`}
		>
			<MonthView
				id="nov"
				month="2026-11"
				today="2026-11-18"
				locale="en-US"
				events={EVENTS}
				dayHref={(date) => `#${date}`}
				labels={{ more: "+{count} more", count: "{count} events" }}
				style="flex: 1 1 auto"
			/>
		</div>,
	);
	return mounted.container.querySelector<HTMLElement>('[data-slot="month-view"]')!;
}

describe("MonthView", () => {
	test("lays November 2026 out in five Sunday-first weeks", () => {
		let view = mount();
		let weeks = view.querySelectorAll('[data-slot="month-view-week"]');
		expect(weeks).toHaveLength(5);
		expect(weeks[0]?.querySelector<HTMLElement>("[data-date]")?.dataset.date).toBe("2026-11-01");
		expect(weeks[4]?.querySelectorAll("[data-date]")[6]?.getAttribute("data-date")).toBe(
			"2026-12-05",
		);
	});

	test("draws a multi-day event as a bar in each week it covers", () => {
		let view = mount();
		let bars = [...view.querySelectorAll<HTMLElement>('[data-slot="month-view-bar"]')];
		expect(bars).toHaveLength(2);
		let friday = view.querySelector('[data-date="2026-11-13"]')!.getBoundingClientRect();
		let saturday = view.querySelector('[data-date="2026-11-14"]')!.getBoundingClientRect();
		let first = bars[0]!.getBoundingClientRect();
		expect(first.left).toBeCloseTo(friday.left, -1);
		expect(first.right).toBeCloseTo(saturday.right, -1);
	});

	test("lists a day's events up to the cap, then links the rest", () => {
		let view = mount();
		let wednesday = view.querySelectorAll('[data-slot="month-view-entries"]')[17]!;
		expect(wednesday.querySelectorAll('[data-slot="month-view-entry"]')).toHaveLength(2);
		let more = wednesday.querySelector<HTMLAnchorElement>('[data-slot="month-view-more"]')!;
		expect(more.textContent).toBe("+2 more");
		expect(more.getAttribute("href")).toBe("#2026-11-18");
	});

	test("lists a week's events right under its day numbers when no bar crosses it", () => {
		let view = mount(900, 900);
		let first = view.querySelectorAll('[data-slot="month-view-week"]')[3]!;
		let number = first.querySelector('[data-slot="month-view-number"]')!.getBoundingClientRect();
		let entries = first
			.querySelectorAll('[data-slot="month-view-entries"]')[2]!
			.getBoundingClientRect();
		expect(entries.top - number.bottom).toBeLessThan(12);
	});

	test("marks today and names each day with its count", () => {
		let view = mount();
		let today = view.querySelector<HTMLElement>('[aria-current="date"]')!;
		expect(today.getAttribute("href")).toBe("#2026-11-18");
		expect(today.textContent).toContain("Wednesday, November 18, 2026, 4 events");
	});

	test("shows dots without titles on a phone, keeping the page as wide as the screen", async () => {
		await page.viewport(375, 812);
		let view = mount(343);
		let title = view.querySelector<HTMLElement>('[aria-label="10 AM Dentist"] span:last-child')!;
		expect(title.getBoundingClientRect().width).toBeLessThanOrEqual(1);
		expect(document.documentElement.scrollWidth).toBe(375);
	});
});
