/**
 * Holds the year view to its contract in a real browser: twelve months with their days in the
 * right weekday columns, dots weighted by each day's count, today and the chosen day marked,
 * and the months reflowing to one column on a phone without widening the page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterAll, afterEach, describe, expect, test } from "vitest";
import { page } from "vitest/browser";

import { YearView } from "./year-view.js";

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

/** Mounts 2026 in a box of the given width. */
function mount(width = 1100): HTMLElement {
	mounted = render(
		<div style={`inline-size:${width}px`}>
			<YearView
				year={2026}
				today="2026-11-18"
				selected="2026-11-20"
				weekStartsOn={1}
				locale="en-US"
				counts={{ "2026-11-18": 5, "2026-11-19": 1, "2026-11-20": 2 }}
				dayHref={(date) => `#${date}`}
				monthHref={(month) => `#m-${month}`}
				labels={{ count: "{count} events" }}
			/>
		</div>,
	);
	return mounted.container.querySelector<HTMLElement>('[data-slot="year-view"]')!;
}

describe("YearView", () => {
	test("draws twelve months, each starting on its weekday column", () => {
		let view = mount();
		let months = view.querySelectorAll('[data-slot="year-view-month"]');
		expect(months).toHaveLength(12);
		let november = view.querySelector('[data-month="2026-11"]')!;
		let first = november.querySelector<HTMLElement>('[data-date="2026-11-01"]')!;
		let monday = november.querySelector<HTMLElement>('[data-date="2026-11-02"]')!;
		expect(first.getBoundingClientRect().left).toBeGreaterThan(monday.getBoundingClientRect().left);
		expect(november.querySelector("h3 a")?.getAttribute("href")).toBe("#m-2026-11");
	});

	test("weighs each day's dot by its count and names the count", () => {
		let view = mount();
		let day = (date: string) => view.querySelector<HTMLElement>(`[data-date="${date}"]`)!;
		expect(
			[day("2026-11-17"), day("2026-11-19"), day("2026-11-20"), day("2026-11-18")].map(
				(el) => el.dataset.weight,
			),
		).toEqual(["0", "1", "2", "3"]);
		expect(getComputedStyle(day("2026-11-18"), "::after").opacity).toBe("0.9");
		expect(day("2026-11-18").textContent).toContain("Wednesday, November 18, 2026, 5 events");
	});

	test("marks today and the chosen day", () => {
		let view = mount();
		expect(view.querySelector<HTMLElement>("[data-today]")?.dataset.date).toBe("2026-11-18");
		expect(view.querySelector<HTMLElement>('[aria-current="date"]')?.dataset.date).toBe(
			"2026-11-20",
		);
	});

	test("stacks the months in one column on a phone, as wide as the screen", async () => {
		await page.viewport(375, 812);
		let view = mount(343);
		let [jan, feb] = view.querySelectorAll<HTMLElement>('[data-slot="year-view-month"]');
		expect(feb!.getBoundingClientRect().top).toBeGreaterThan(jan!.getBoundingClientRect().bottom);
		expect(document.documentElement.scrollWidth).toBe(375);
	});
});
