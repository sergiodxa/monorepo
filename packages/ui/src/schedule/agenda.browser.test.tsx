/**
 * Holds the agenda to its contract in a real browser: days and events keep their order, today's
 * heading is marked, rows link, open a popover or stay plain, the date gutter stacks above the
 * events in a narrow container, and a phone's page stays as wide as its screen.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterAll, afterEach, describe, expect, test } from "vitest";
import { page } from "vitest/browser";

import type { Agenda as AgendaTypes } from "./agenda.js";

import { Agenda } from "./agenda.js";

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

/** Three days: today with a link, a popover and a plain row, then two more. */
const DAYS: AgendaTypes.Day[] = [
	{
		date: "2026-11-18",
		href: "#18",
		events: [
			{ id: "a", title: "Standup", time: "9:00 – 9:15 AM", href: "#a", past: true },
			{
				id: "b",
				title: "Design review with the whole product group and the guests from marketing",
				time: "10:00 – 11:30 AM",
				color: "rebeccapurple",
				detail: "Room 4 · Ana, Bo, Cy",
				popover: <p>Review details</p>,
			},
			{ id: "c", title: "Focus", time: "2:00 – 4:00 PM", tentative: true },
		],
	},
	{ date: "2026-11-19", events: [{ id: "d", title: "Offsite", time: "All day" }] },
	{ date: "2026-11-21", events: [{ id: "e", title: "Dinner", time: "7:00 – 9:00 PM" }] },
];

/** The brand tokens an app sets, which the package leaves to it. */
const BRAND = "--ui-brand-fg: rgb(0, 90, 200); --ui-brand-bg-solid: rgb(0, 90, 200)";

/** Mounts the agenda in a box of the given width and returns its root. */
function mount(width = "40rem", days = DAYS): HTMLElement {
	mounted = render(
		<div style={`inline-size: ${width}; ${BRAND}`}>
			<Agenda
				id="upcoming"
				label="Upcoming"
				today="2026-11-18"
				locale="en-US"
				days={days}
				empty="Nothing"
			/>
		</div>,
	);
	return mounted.container.querySelector<HTMLElement>('[data-slot="agenda"]')!;
}

describe("Agenda", () => {
	test("lists each day under its heading, in order, with its events in order", () => {
		let agenda = mount();
		let days = [...agenda.querySelectorAll<HTMLElement>('[data-slot="agenda-day"]')];
		expect(days.map((day) => day.dataset.date)).toEqual(["2026-11-18", "2026-11-19", "2026-11-21"]);
		expect(days[0]!.querySelector("h3")?.textContent).toContain("Wednesday, November 18");
		expect(
			[...days[0]!.querySelectorAll<HTMLElement>('[data-slot="agenda-event"]')].map(
				(event) => event.dataset.id,
			),
		).toEqual(["a", "b", "c"]);
		expect(days[1]!.textContent).toContain("Offsite");
	});

	test("marks today's heading and colours it with the brand", () => {
		let agenda = mount();
		let current = agenda.querySelector<HTMLElement>('[aria-current="date"]')!;
		expect(current.getAttribute("href")).toBe("#18");
		let todayNumber = current.querySelector<HTMLElement>('[data-slot="agenda-day-number"]')!;
		let otherNumber = agenda.querySelector<HTMLElement>(
			'[data-date="2026-11-19"] [data-slot="agenda-day-number"]',
		)!;
		expect(getComputedStyle(todayNumber).color).toBe("rgb(0, 90, 200)");
		expect(getComputedStyle(otherNumber).color).not.toBe("rgb(0, 90, 200)");
		expect(agenda.querySelectorAll('[aria-current="date"]')).toHaveLength(1);
	});

	test("makes a row a link, a popover button, or plain text", () => {
		let agenda = mount();
		let row = (id: string) =>
			agenda.querySelector<HTMLElement>(`[data-id="${id}"] [data-slot="agenda-row"]`)!;
		expect(row("a").tagName).toBe("A");
		expect(row("a").getAttribute("href")).toBe("#a");
		expect(row("b").tagName).toBe("BUTTON");
		let popover = document.getElementById(row("b").getAttribute("popovertarget")!)!;
		expect(popover.hasAttribute("popover")).toBe(true);
		expect(popover.textContent).toBe("Review details");
		expect(row("c").tagName).toBe("DIV");
		expect(getComputedStyle(row("a")).opacity).toBe("0.6");
	});

	test("sets the date gutter beside the events when wide, and above them when narrow", () => {
		let wide = mount("40rem");
		let heading = wide.querySelector("h3")!.getBoundingClientRect();
		let events = wide.querySelector('[data-slot="agenda-events"]')!.getBoundingClientRect();
		expect(events.left).toBeGreaterThanOrEqual(heading.right);
		expect(events.top).toBeLessThan(heading.bottom);
		mounted?.cleanup();

		let narrow = mount("20rem");
		let stackedHeading = narrow.querySelector("h3")!.getBoundingClientRect();
		let stackedEvents = narrow
			.querySelector('[data-slot="agenda-events"]')!
			.getBoundingClientRect();
		expect(stackedEvents.top).toBeGreaterThanOrEqual(stackedHeading.bottom);
		expect(Math.abs(stackedEvents.left - stackedHeading.left)).toBeLessThan(8);
	});

	test("keeps the heading stuck at the top of a scrolling ancestor", async () => {
		mounted = render(
			<div style="block-size: 200px; overflow-y: auto; inline-size: 40rem" data-scroller>
				<Agenda id="upcoming" label="Upcoming" locale="en-US" days={DAYS} />
			</div>,
		);
		let scroller = mounted.container.querySelector<HTMLElement>("[data-scroller]")!;
		let heading = scroller.querySelector("h3")!;
		scroller.scrollTop = 60;
		await new Promise((resolve) => requestAnimationFrame(resolve));
		expect(heading.getBoundingClientRect().top).toBeCloseTo(
			scroller.getBoundingClientRect().top,
			0,
		);
	});

	test("shows the empty content when there are no days", () => {
		let agenda = mount("40rem", []);
		expect(agenda.querySelector("ol")).toBeNull();
		expect(agenda.querySelector('[data-slot="agenda-empty"]')?.textContent).toBe("Nothing");
	});

	test("keeps a phone's page as wide as the screen", async () => {
		await page.viewport(375, 812);
		mounted = render(<Agenda id="upcoming" label="Upcoming" locale="en-US" days={DAYS} />);
		expect(document.documentElement.scrollWidth).toBe(375);
	});
});
