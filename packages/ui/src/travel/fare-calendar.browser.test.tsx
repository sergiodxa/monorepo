/**
 * Renders `FareCalendar` in a real browser: the month grid opens on the chosen weekday, days with
 * fares are links named by date, fare and "cheapest", days without flights are plain text, and the
 * strip scrolls inside a 320px column without widening the page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import type { FareCalendar as FareCalendarTypes } from "./fare-calendar.js";

import { FareCalendar } from "./fare-calendar.js";

import "../reset.css";
import "@sdxc/u/theme.css";
import "../theme.css";

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
	document.body.replaceChildren();
});

/** Fares for March 2026: the 10th and 17th are cheapest, the 20th is dear, the 4th has no flights. */
const FARES: Record<string, FareCalendarTypes.Fare | undefined> = Object.fromEntries(
	Array.from({ length: 31 }, (_, index) => {
		let date = `2026-03-${String(index + 1).padStart(2, "0")}`;
		if (date === "2026-03-04") return [date, undefined];
		if (date === "2026-03-10" || date === "2026-03-17")
			return [date, { amount: "$89", level: "low" }];
		if (date === "2026-03-20") return [date, { amount: "$412", level: "high" }];
		return [date, { amount: "$164", level: "mid" }];
	}),
);

/** The words every calendar here reads. */
const LABELS: FareCalendarTypes.Labels = {
	previous: "Previous month",
	next: "Next month",
	cheapest: "cheapest",
	noFlights: "no flights",
};

/** Mounts a calendar in a host `width` pixels wide and returns the host. */
function mount(width: number, props: Partial<FareCalendarTypes.Props> = {}): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	mounted = render(
		<FareCalendar
			month="2026-03"
			fares={FARES}
			selected="2026-03-14"
			today="2026-03-02"
			href={(day) => `/flights?depart=${day}`}
			prevHref="/flights?month=2026-02"
			nextHref="/flights?month=2026-04"
			locale="en-US"
			label="Departure dates"
			labels={LABELS}
			{...props}
		/>,
		{ container: host },
	);
	return host;
}

/** The accessible name a day link carries, read from its text with aria-hidden parts left out. */
function spokenName(element: Element): string {
	let clone = element.cloneNode(true) as Element;
	for (let hidden of clone.querySelectorAll("[aria-hidden=true]")) hidden.remove();
	return clone.textContent ?? "";
}

describe("FareCalendar", () => {
	test("draws March 2026 as weeks opening on the chosen weekday", () => {
		let host = mount(400, { weekStartsOn: 1 });
		let weekdays = [...host.querySelectorAll("thead th")].map((cell) => cell.textContent);
		expect(weekdays).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
		let rows = host.querySelectorAll("tbody tr");
		expect(rows).toHaveLength(6);
		for (let row of rows) expect(row.children).toHaveLength(7);
		let first = rows[0]!.children;
		expect(first[6]?.querySelector("[data-date]")?.getAttribute("data-date")).toBe("2026-03-01");
		expect(first[0]?.querySelector("[data-date]")).toBeNull();
		expect(host.querySelector("h2, h3, h4, [data-slot=heading]")?.textContent).toBe("March 2026");
	});

	test("starts on Sunday by default", () => {
		let host = mount(400);
		expect(host.querySelector("thead th")?.textContent).toBe("Sun");
		expect(host.querySelectorAll("tbody tr")).toHaveLength(5);
	});

	test("links each day with flights and the previous and next months", () => {
		let host = mount(400);
		let links = host.querySelectorAll<HTMLAnchorElement>("a[data-date]");
		expect(links).toHaveLength(30);
		expect(host.querySelector<HTMLAnchorElement>("a[data-date='2026-03-09']")?.href).toContain(
			"/flights?depart=2026-03-09",
		);
		expect(host.querySelector("[aria-label='Previous month']")?.getAttribute("href")).toBe(
			"/flights?month=2026-02",
		);
		expect(host.querySelector("[aria-label='Next month']")?.getAttribute("href")).toBe(
			"/flights?month=2026-04",
		);
		expect(host.querySelector("a[data-date='2026-03-14']")?.getAttribute("aria-current")).toBe(
			"page",
		);
		expect(host.querySelector("a[data-date='2026-03-02']")?.getAttribute("aria-current")).toBe(
			"date",
		);
	});

	test("marks the cheapest days and names them so", () => {
		let host = mount(400);
		let cheap = host.querySelector("a[data-date='2026-03-10']")!;
		let mid = host.querySelector("a[data-date='2026-03-11']")!;
		expect(spokenName(cheap)).toBe("Tuesday, March 10, 2026, $89, cheapest");
		expect(spokenName(mid)).toBe("Wednesday, March 11, 2026, $164");
		expect(cheap.querySelector("[data-slot=fare-calendar-marker]")).not.toBeNull();
		expect(mid.querySelector("[data-slot=fare-calendar-marker]")).toBeNull();
		document.documentElement.style.setProperty("--ui-color-success-50", "rgb(230, 250, 235)");
		expect(getComputedStyle(cheap).backgroundColor).toBe("rgb(230, 250, 235)");
		expect(getComputedStyle(mid).backgroundColor).toBe("rgba(0, 0, 0, 0)");
		document.documentElement.style.removeProperty("--ui-color-success-50");
		let amount = (element: Element) =>
			getComputedStyle(element.querySelector("[data-slot=fare-calendar-amount]")!).fontWeight;
		expect(Number(amount(cheap))).toBeGreaterThan(Number(amount(mid)));
		expect(host.querySelectorAll("[data-level=low]")).toHaveLength(2);
	});

	test("leaves a day without flights as text named by its date", () => {
		let host = mount(400);
		let empty = host.querySelector("[data-date='2026-03-04']")!;
		expect(empty.tagName).toBe("SPAN");
		expect(empty.closest("a")).toBeNull();
		expect(spokenName(empty)).toBe("Wednesday, March 4, 2026, no flights");
	});

	test("fits a 320px column", () => {
		let host = mount(320);
		let calendar = host.querySelector<HTMLElement>("[data-slot=fare-calendar]")!;
		expect(calendar.scrollWidth).toBeLessThanOrEqual(320);
		expect(host.querySelector("table")!.getBoundingClientRect().width).toBeLessThanOrEqual(320);
	});

	test("draws the strip as a row that scrolls inside 320px without widening the page", () => {
		let days = Array.from(
			{ length: 9 },
			(_, index) => `2026-03-${String(index + 6).padStart(2, "0")}`,
		);
		let host = mount(320, { variant: "strip", days, selected: "2026-03-10" });
		let nav = host.querySelector<HTMLElement>("nav[aria-label='Departure dates']")!;
		let strip = nav.querySelector<HTMLElement>("[data-slot=fare-calendar-strip]")!;
		expect(strip.querySelectorAll("li")).toHaveLength(9);
		expect(nav.getBoundingClientRect().width).toBeLessThanOrEqual(320);
		expect(strip.scrollWidth).toBeGreaterThan(strip.clientWidth);
		expect(getComputedStyle(strip).overflowX).toBe("auto");
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
		let tops = new Set(
			[...strip.querySelectorAll("li")].map((item) => Math.round(item.getBoundingClientRect().top)),
		);
		expect(tops.size).toBe(1);
		let selected = strip.querySelector("a[aria-current=page]")!;
		expect(selected.getAttribute("data-date")).toBe("2026-03-10");
		expect(spokenName(selected)).toBe("Tuesday, March 10, 2026, $89, cheapest");
		expect(nav.querySelector("table")).toBeNull();
	});
});
