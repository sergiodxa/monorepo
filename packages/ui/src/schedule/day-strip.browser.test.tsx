/**
 * Holds the day strip to its contract in a real browser: it scrolls inside its own box without
 * widening a phone's page, marks the current day and today, links the days that lead somewhere,
 * names each day in full for assistive tech, and brings the current day into view.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterAll, afterEach, describe, expect, test } from "vitest";
import { page } from "vitest/browser";

import type { DayStrip as DayStripTypes } from "./day-strip.js";

import { DayStrip } from "./day-strip.js";
import { dayStripScroll } from "./mixins/day-strip-scroll.js";

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

/** Every day of November 2026, the 25th current and the 3rd without a link. */
const DAYS: DayStripTypes.Day[] = Array.from({ length: 30 }, (_, index) => {
	let date = `2026-11-${String(index + 1).padStart(2, "0")}`;
	return {
		date,
		href: index === 2 ? undefined : `#${date}`,
		current: index === 24,
		note: index % 3 === 0 ? <span>•</span> : undefined,
		label: index % 3 === 0 ? "1 event" : undefined,
	};
});

/** Mounts the strip and returns its scroller. */
function mount(): HTMLElement {
	mounted = render(
		<DayStrip label="November 2026" today="2026-11-18" locale="en-US" days={DAYS} />,
	);
	return mounted.container.querySelector<HTMLElement>('[data-slot="day-strip"]')!;
}

describe("DayStrip", () => {
	test("scrolls inside its own box on a phone, leaving the page as wide as the screen", async () => {
		await page.viewport(375, 812);
		let strip = mount();
		expect(strip.scrollWidth).toBeGreaterThan(strip.clientWidth);
		expect(document.documentElement.scrollWidth).toBe(375);
	});

	test("marks the current day and today, and links only the days given an address", () => {
		let strip = mount();
		let current = strip.querySelector<HTMLElement>('[aria-current="date"]')!;
		expect(current.dataset.date).toBe("2026-11-25");
		expect(strip.querySelector<HTMLElement>("[data-today]")?.dataset.date).toBe("2026-11-18");
		expect(strip.querySelector('[data-date="2026-11-03"]')?.tagName).toBe("SPAN");
		expect(strip.querySelector('[data-date="2026-11-04"]')?.getAttribute("href")).toBe(
			"#2026-11-04",
		);
	});

	test("names each day in full with what its note means", () => {
		let strip = mount();
		let day = strip.querySelector<HTMLElement>('[data-date="2026-11-01"]')!;
		expect(day.textContent).toContain("Sunday, November 1, 2026, 1 event");
		expect(getComputedStyle(day).inlineSize).toBe("48px");
	});

	test("brings the current day into view once laid out", async () => {
		await page.viewport(375, 812);
		mounted = render(
			<div>
				<DayStrip label="November 2026" locale="en-US" days={DAYS} />
				<span hidden mix={[dayStripScroll()]} />
			</div>,
		);
		let strip = mounted.container.querySelector<HTMLElement>('[data-slot="day-strip"]')!;
		strip.appendChild(mounted.container.querySelector("span[hidden]:last-child")!);
		await expect.poll(() => strip.scrollLeft).toBeGreaterThan(0);
		let current = strip
			.querySelector<HTMLElement>('[aria-current="date"]')!
			.getBoundingClientRect();
		let box = strip.getBoundingClientRect();
		expect(current.left).toBeGreaterThanOrEqual(box.left);
		expect(current.right).toBeLessThanOrEqual(box.right);
	});
});
