/**
 * Holds the free/busy grid to its contract in a real browser: busy blocks sit at their minutes
 * on the track, slot bands cross every row, the selected slot is marked, the names stay in view
 * while the tracks scroll, each row is summarized for assistive tech, and a phone's page stays put.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterAll, afterEach, describe, expect, test } from "vitest";
import { page } from "vitest/browser";

import type { FreeBusy as FreeBusyTypes } from "./free-busy.js";

import { FreeBusy } from "./free-busy.js";

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

/** Every hour from 8:00 to 19:00. */
const HOURS: FreeBusyTypes.Hour[] = Array.from({ length: 12 }, (_, index) => ({
	minute: (8 + index) * 60,
	label: `${8 + index}:00`,
}));

/** Three people: one busy twice, one with a titled tentative block, one free. */
const PEOPLE: FreeBusyTypes.Person[] = [
	{
		id: "ana",
		name: "Ana",
		detail: "Lisbon · 2:00 PM local",
		busy: [
			{ start: 780, end: 870 },
			{ start: 540, end: 600 },
		],
		outside: [{ start: 1020, end: 1140 }],
	},
	{ id: "bo", name: "Bo", busy: [{ start: 660, end: 720, title: "Lunch", tentative: true }] },
	{ id: "cy", name: "Cy", busy: [] },
];

/** Two suggestions, the second chosen. */
const SLOTS: FreeBusyTypes.Slot[] = [
	{ start: 600, end: 630, label: "10:00", href: "#ten" },
	{ start: 900, end: 960, label: "15:00", href: "#three", selected: true },
];

/** The rows' strings. */
const LABELS: FreeBusyTypes.Labels = { busy: "Busy {times}", free: "Free all day" };

/** Mounts the grid in a box of the given width and returns its scroller. */
function mount(width = "60rem"): HTMLElement {
	mounted = render(
		<div style={`inline-size: ${width}; --ui-brand-bg-solid: rgb(0, 90, 200)`}>
			<FreeBusy
				label="Availability"
				start={480}
				end={1140}
				hours={HOURS}
				people={PEOPLE}
				slots={SLOTS}
				now={630}
				labels={LABELS}
			/>
		</div>,
	);
	return mounted.container.querySelector<HTMLElement>('[data-slot="free-busy"]')!;
}

describe("FreeBusy", () => {
	test("places a busy block at its minutes as a share of the track", () => {
		let grid = mount();
		let track = grid.querySelector<HTMLElement>('[data-slot="free-busy-track"][data-id="ana"]')!;
		let block = track.querySelector<HTMLElement>('[data-start="540"]')!.getBoundingClientRect();
		let box = track.getBoundingClientRect();
		expect(block.left - box.left).toBeCloseTo((box.width * 60) / 660, 0);
		expect(block.width).toBeCloseTo((box.width * 60) / 660, 0);
	});

	test("draws each slot band from the first row to the last", () => {
		let grid = mount();
		let tracks = [...grid.querySelectorAll<HTMLElement>('[data-slot="free-busy-track"]')];
		let first = tracks[0]!.getBoundingClientRect();
		let last = tracks.at(-1)!.getBoundingClientRect();
		let band = grid
			.querySelector<HTMLElement>('[data-slot="free-busy-band"]')!
			.getBoundingClientRect();
		expect(band.top).toBeLessThanOrEqual(first.top);
		expect(band.bottom).toBeGreaterThanOrEqual(last.bottom - 1);
		expect(band.left - first.left).toBeCloseTo((first.width * 120) / 660, 0);
	});

	test("marks the selected slot on its band and its link", () => {
		let grid = mount();
		let selected = grid.querySelectorAll("[data-selected]");
		expect(selected).toHaveLength(2);
		let link = grid.querySelector<HTMLAnchorElement>('a[aria-current="true"]')!;
		expect(link.getAttribute("href")).toBe("#three");
		expect(link.textContent).toBe("15:00");
		let band = grid.querySelector<HTMLElement>('[data-slot="free-busy-band"][data-selected]')!;
		expect(getComputedStyle(band).boxShadow).toContain("rgb(0, 90, 200)");
		expect(grid.querySelectorAll('a[data-slot="free-busy-slot"]')).toHaveLength(2);
	});

	test("keeps the names in view after the tracks scroll sideways", async () => {
		await page.viewport(375, 812);
		mounted = render(
			<FreeBusy
				label="Availability"
				start={480}
				end={1140}
				hours={HOURS}
				people={PEOPLE}
				slots={SLOTS}
				labels={LABELS}
			/>,
		);
		let grid = mounted.container.querySelector<HTMLElement>('[data-slot="free-busy"]')!;
		expect(grid.scrollWidth).toBeGreaterThan(grid.clientWidth);
		grid.scrollLeft = 200;
		await new Promise((resolve) => requestAnimationFrame(resolve));
		expect(grid.scrollLeft).toBe(200);
		let name = grid
			.querySelector<HTMLElement>('[data-slot="free-busy-person"]')!
			.getBoundingClientRect();
		expect(name.left).toBeCloseTo(grid.getBoundingClientRect().left, 0);
		let hit = document.elementFromPoint(name.left + 10, name.top + name.height / 2);
		expect(hit?.closest('[data-slot="free-busy-person"]')).not.toBeNull();
	});

	test("summarizes each row's busy times for assistive tech", () => {
		let grid = mount();
		let summaries = [...grid.querySelectorAll<HTMLElement>('[data-slot="free-busy-summary"]')].map(
			(summary) => summary.textContent,
		);
		expect(summaries).toEqual([
			"Busy 9:00–10:00, 13:00–14:30",
			"Busy Lunch 11:00–12:00",
			"Free all day",
		]);
		expect(grid.querySelector('[data-slot="free-busy-track"]')?.getAttribute("aria-hidden")).toBe(
			"true",
		);
	});

	test("keeps a phone's page as wide as the screen", async () => {
		await page.viewport(375, 812);
		mounted = render(
			<FreeBusy
				label="Availability"
				start={480}
				end={1140}
				hours={HOURS}
				people={PEOPLE}
				slots={SLOTS}
				labels={LABELS}
			/>,
		);
		expect(document.documentElement.scrollWidth).toBe(375);
	});
});
