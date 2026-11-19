/**
 * Renders `RangeMonths` in a real browser: the weeks and weekday columns each month lays out, the
 * link every day carries in each selection state, the days that are never links, the band a
 * range draws, and a single month fitting a 320px phone without scrolling sideways.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";
import { userEvent } from "vitest/browser";

import { RangeMonths } from "./range-months.js";

import "../reset.css";
import "../theme.css";

/** The words read to assistive technology. */
const LABELS: RangeMonths.Labels = {
	previous: "Previous month",
	next: "Next month",
	start: "check-in",
	end: "check-out",
};

/** The tokens the band and the ends read, which an app's palette would otherwise supply. */
const TOKENS = {
	"--ui-brand-bg-solid": "rgb(30, 90, 200)",
	"--ui-brand-fg-on-solid": "rgb(255, 255, 255)",
	"--ui-brand-bg-tint-hover": "rgb(220, 230, 250)",
	"--ui-brand-bg-tint": "rgb(240, 244, 252)",
};

/** Encodes a link's selection as a query string, so a test reads back what a click selects. */
function href(next: RangeMonths.Next): string {
	return `/stay?${new URLSearchParams({ ...next })}`;
}

/** Mounts a calendar `width` pixels wide with `props` over a March 2026 default and returns its root. */
function mount(props: Partial<RangeMonths.Props> = {}, width = 800): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	for (let [name, value] of Object.entries(TOKENS)) host.style.setProperty(name, value);
	document.body.appendChild(host);
	render(
		<RangeMonths
			label="Stay dates"
			labels={LABELS}
			locale="en-US"
			month="2026-03"
			href={href}
			{...props}
		/>,
		{
			container: host,
		},
	);
	return host.querySelector<HTMLElement>("[data-slot=range-months]")!;
}

/** The query a day's link carries, or `null` when the day is not a link. */
function linkOf(root: HTMLElement, date: string): string | null {
	let link = root.querySelector(`a[data-date="${date}"]`);
	return link === null ? null : link.getAttribute("href")!.replace("/stay?", "");
}

/** A day's `<td>`. */
function cellOf(root: HTMLElement, date: string): HTMLElement {
	return root.querySelector<HTMLElement>(`[data-date="${date}"]`)!.closest("td")!;
}

afterEach(() => {
	document.body.replaceChildren();
});

describe("RangeMonths", () => {
	test("lays out each month's weeks with every day once", () => {
		let root = mount({ months: 2 });
		let months = root.querySelectorAll("[data-slot=range-months-month]");
		expect(months).toHaveLength(2);
		expect(months[0]?.querySelectorAll("tbody tr")).toHaveLength(5);
		expect(months[0]?.querySelectorAll("[data-date]")).toHaveLength(31);
		expect(months[1]?.querySelectorAll("[data-date]")).toHaveLength(30);
		expect(months[0]?.querySelector("table")?.getAttribute("aria-label")).toBe("March 2026");
		expect(months[1]?.querySelector("h2, h3, h4, h5, h6, h1")?.textContent).toBe("April 2026");
		let firstRow = [...months[0]!.querySelectorAll("tbody tr:first-child td")];
		expect(firstRow.findIndex((cell) => cell.querySelector("[data-date]") !== null)).toBe(0);
	});

	test("orders the weekday columns from weekStartsOn", () => {
		let sunday = mount({ months: 1 });
		expect([...sunday.querySelectorAll("th")].map((cell) => cell.textContent)).toEqual([
			"Sun",
			"Mon",
			"Tue",
			"Wed",
			"Thu",
			"Fri",
			"Sat",
		]);
		document.body.replaceChildren();
		let monday = mount({ months: 1, weekStartsOn: 1 });
		expect(monday.querySelector("th")?.textContent).toBe("Mon");
		expect(monday.querySelectorAll("tbody tr:first-child td")[6]?.textContent).toBe("1");
	});

	test("links each day to a new start when nothing is chosen", () => {
		let root = mount();
		expect(linkOf(root, "2026-03-10")).toBe("month=2026-03&start=2026-03-10");
	});

	test("links a later day to the end and an earlier one to a new start once a start is chosen", () => {
		let root = mount({ start: "2026-03-10" });
		expect(linkOf(root, "2026-03-14")).toBe("month=2026-03&start=2026-03-10&end=2026-03-14");
		expect(linkOf(root, "2026-03-08")).toBe("month=2026-03&start=2026-03-08");
		expect(linkOf(root, "2026-03-10")).toBe("month=2026-03&start=2026-03-10");
	});

	test("restarts at the clicked day once both ends are chosen", () => {
		let root = mount({ start: "2026-03-10", end: "2026-03-14" });
		expect(linkOf(root, "2026-03-20")).toBe("month=2026-03&start=2026-03-20");
	});

	test("links each day as the start alone in single mode, with no band", () => {
		let root = mount({ single: true, start: "2026-03-10", end: "2026-03-14" });
		expect(linkOf(root, "2026-03-20")).toBe("month=2026-03&start=2026-03-20");
		expect(cellOf(root, "2026-03-10").dataset.range).toBe("only");
		expect(cellOf(root, "2026-03-12").dataset.range).toBeUndefined();
	});

	test("keeps the selection on the month links and hides previous before min's month", () => {
		let root = mount({ start: "2026-03-10", end: "2026-03-14", min: "2026-03-05" });
		expect(root.querySelector("[data-slot=range-months-previous]")).toBeNull();
		expect(root.querySelector("[data-slot=range-months-next]")?.getAttribute("href")).toBe(
			"/stay?month=2026-04&start=2026-03-10&end=2026-03-14",
		);
		document.body.replaceChildren();
		let later = mount({ month: "2026-04", min: "2026-03-05", max: "2026-05-20" });
		expect(later.querySelector("[data-slot=range-months-previous]")?.getAttribute("href")).toBe(
			"/stay?month=2026-03",
		);
		expect(later.querySelector("[data-slot=range-months-next]")).toBeNull();
	});

	test("draws unavailable days and days before min as text, not links", () => {
		let root = mount({
			min: "2026-03-05",
			isUnavailable: (date) => date === "2026-03-12",
		});
		expect(linkOf(root, "2026-03-04")).toBeNull();
		expect(cellOf(root, "2026-03-04").getAttribute("aria-disabled")).toBe("true");
		expect(linkOf(root, "2026-03-12")).toBeNull();
		expect(cellOf(root, "2026-03-12").hasAttribute("data-unavailable")).toBe(true);
		let number = cellOf(root, "2026-03-12").querySelector("[data-slot=range-months-number]")!;
		expect(getComputedStyle(number).textDecorationLine).toContain("line-through");
		expect(linkOf(root, "2026-03-05")).not.toBeNull();
	});

	test("ends a pending range before the first unavailable day after its start", () => {
		let root = mount({
			start: "2026-03-10",
			isUnavailable: (date) => date === "2026-03-15",
		});
		expect(linkOf(root, "2026-03-14")).toBe("month=2026-03&start=2026-03-10&end=2026-03-14");
		expect(cellOf(root, "2026-03-14").hasAttribute("data-pending")).toBe(true);
		expect(linkOf(root, "2026-03-16")).toBeNull();
		expect(linkOf(root, "2026-04-02")).toBeNull();
		expect(linkOf(root, "2026-03-05")).toBe("month=2026-03&start=2026-03-05");
	});

	test("marks today with aria-current", () => {
		let root = mount({ today: "2026-03-18" });
		expect(root.querySelector("[aria-current=date]")?.getAttribute("data-date")).toBe("2026-03-18");
		expect(root.querySelectorAll("[aria-current]")).toHaveLength(1);
	});

	test("draws a chosen range as one band from its start to its end", () => {
		let root = mount({ start: "2026-03-30", end: "2026-04-03" });
		expect(cellOf(root, "2026-03-30").dataset.range).toBe("start");
		expect(cellOf(root, "2026-03-31").dataset.range).toBe("middle");
		expect(cellOf(root, "2026-04-02").dataset.range).toBe("middle");
		expect(cellOf(root, "2026-04-03").dataset.range).toBe("end");
		expect(cellOf(root, "2026-03-29").dataset.range).toBeUndefined();
		expect(root.querySelector('a[data-date="2026-03-30"]')?.getAttribute("aria-label")).toBe(
			"Monday, March 30, 2026, check-in",
		);
		let start = cellOf(root, "2026-03-30").getBoundingClientRect();
		let next = cellOf(root, "2026-03-31").getBoundingClientRect();
		expect(next.left - start.right).toBe(0);
		let solid = getComputedStyle(root.querySelector('a[data-date="2026-03-30"]')!).backgroundColor;
		let plain = getComputedStyle(root.querySelector('a[data-date="2026-03-20"]')!).backgroundColor;
		expect(solid).toBe("rgb(30, 90, 200)");
		expect(plain).not.toBe(solid);
		expect(getComputedStyle(cellOf(root, "2026-03-31")).backgroundColor).toBe("rgb(220, 230, 250)");
	});

	test("puts the caller's note under each day", () => {
		let root = mount({ months: 1, dayNote: (date) => `$${Number(date.slice(8))}0` });
		expect(
			root.querySelector('[data-date="2026-03-07"] [data-slot=range-months-note]')?.textContent,
		).toBe("$70");
	});

	test("fits one month inside a 320px phone without scrolling sideways", () => {
		let root = mount({ months: 1, dayNote: () => "$120" }, 320);
		expect(root.scrollWidth).toBeLessThanOrEqual(320);
		expect(root.getBoundingClientRect().width).toBeLessThanOrEqual(320);
		let day = root.querySelector('a[data-date="2026-03-10"]')!.getBoundingClientRect();
		expect(day.width).toBeGreaterThanOrEqual(40);
		expect(day.height).toBeGreaterThanOrEqual(40);
	});

	test("sets two months side by side when wide and one per row when narrow", () => {
		let tops = (root: HTMLElement) =>
			new Set(
				[...root.querySelectorAll("[data-slot=range-months-month]")].map((month) =>
					Math.round(month.getBoundingClientRect().top),
				),
			).size;
		expect(tops(mount({}, 800))).toBe(1);
		document.body.replaceChildren();
		expect(tops(mount({}, 400))).toBe(2);
	});

	test("previews the pending range up to the hovered day across rows", async () => {
		let root = mount({ start: "2026-03-05" });
		let preview = "rgb(240, 244, 252)";
		await userEvent.hover(root.querySelector('a[data-date="2026-03-10"]')!);
		expect(getComputedStyle(cellOf(root, "2026-03-06")).backgroundColor).toBe(preview);
		expect(getComputedStyle(cellOf(root, "2026-03-09")).backgroundColor).toBe(preview);
		expect(getComputedStyle(cellOf(root, "2026-03-10")).backgroundColor).toBe(preview);
		expect(getComputedStyle(cellOf(root, "2026-03-11")).backgroundColor).not.toBe(preview);
		expect(getComputedStyle(cellOf(root, "2026-03-04")).backgroundColor).not.toBe(preview);
	});
});
