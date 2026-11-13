/**
 * Runs the contribution graph in a real browser: a year as a grid table with month and weekday
 * headers, a named cell per day tinted by level tokens in both themes, weeks starting on the
 * locale's first day, one shared tooltip, arrow-key navigation, and a phone box that opens on
 * the current week without scrolling the page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";

import { renderToString } from "remix/component/server";
import { render } from "remix/component/test";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { page, userEvent } from "vitest/browser";

import { ContributionGraph, contributionLevel, weekStartFor } from "./contribution-graph.js";

import "../reset.css";
import "../theme.css";

/** Lightness of each palette step, so every tone the theme reads resolves to a real colour. */
const STEPS: Record<number, number> = {
	50: 0.97,
	100: 0.94,
	200: 0.88,
	300: 0.8,
	400: 0.7,
	500: 0.62,
	600: 0.55,
	700: 0.48,
	800: 0.4,
	900: 0.32,
	950: 0.24,
};

/** Hue and chroma per tone, as an app's palette would set them. */
const HUES: Record<string, [hue: number, chroma: number]> = {
	brand: [75, 0.13],
	neutral: [75, 0.008],
	success: [150, 0.15],
	warning: [85, 0.16],
	danger: [25, 0.2],
};

/** English strings, plural on the day's count. */
const LABELS: ContributionGraph.Labels = {
	caption: "4,015 contributions in the last year",
	day: (count, date) =>
		`${count === 0 ? "No" : count} ${count === 1 ? "contribution" : "contributions"} on ${date}`,
	less: "Less",
	more: "More",
};

/** A year ending Friday, Nov 13, 2026. */
const START = "2025-11-14";
const END = "2026-11-13";

/** A count on most days: one of each level across the first week, then a repeating rhythm. */
const DAYS: ContributionGraph.Day[] = [
	{ date: "2025-11-14", count: 0 },
	{ date: "2025-11-15", count: 1 },
	{ date: "2025-11-16", count: 4 },
	{ date: "2025-11-17", count: 8 },
	{ date: "2025-11-18", count: 12 },
	{ date: "2026-11-03", count: 12 },
	{ date: "2026-11-13", count: 3 },
];

/** Mounts `node` in a host `width` pixels wide and returns the host. */
function mount(node: JSX.Element, width = 900): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	host.style.paddingTop = "3rem";
	document.body.appendChild(host);
	render(node, { container: host });
	return host;
}

/** The graph with the shared fixtures, in `locale`. */
function graph(props: Partial<ContributionGraph.Props> = {}): JSX.Element {
	return (
		<ContributionGraph
			days={DAYS}
			start={START}
			end={END}
			locale="en-US"
			labels={LABELS}
			{...props}
		/>
	);
}

/** The focusable day for `date`. */
function day(host: HTMLElement, date: string): HTMLElement {
	let element = host.querySelector<HTMLElement>(
		`[data-slot="contribution-graph-day"][data-date="${date}"]`,
	);
	if (!element) throw new Error(`missing day ${date}`);
	return element;
}

/** A cell's resolved background colour. */
function fill(element: Element): string {
	return getComputedStyle(element).backgroundColor;
}

beforeEach(async () => {
	await page.viewport(1280, 800);
	for (let [tone, [hue, chroma]] of Object.entries(HUES)) {
		for (let [step, lightness] of Object.entries(STEPS)) {
			document.documentElement.style.setProperty(
				`--ui-color-${tone}-${step}`,
				`oklch(${lightness} ${chroma} ${hue})`,
			);
		}
	}
});

afterEach(() => {
	document.documentElement.removeAttribute("style");
	document.documentElement.className = "";
	for (let open of document.querySelectorAll(":popover-open")) (open as HTMLElement).hidePopover();
	document.body.replaceChildren();
});

describe("ContributionGraph", () => {
	test("is a grid table with a caption, month and weekday headers, and one named cell per day", async () => {
		let host = mount(graph());
		let table = host.querySelector("table")!;

		await expect
			.element(page.getByRole("grid", { name: "4,015 contributions in the last year" }))
			.toBeInTheDocument();
		expect(host.querySelectorAll("td[data-level]")).toHaveLength(365);
		expect(table.tBodies[0]!.rows).toHaveLength(7);

		let months = [...table.tHead!.querySelectorAll("th")].map((th) => th.textContent);
		expect(months).toContain("Jan");
		expect(months.at(-1)).toBe("Nov");

		let rowHeaders = [...table.querySelectorAll<HTMLElement>('th[scope="row"] > span')];
		expect(rowHeaders.map((span) => span.textContent)).toEqual([
			"Sun",
			"Mon",
			"Tue",
			"Wed",
			"Thu",
			"Fri",
			"Sat",
		]);
		let shown = rowHeaders.filter((span) => span.getBoundingClientRect().width > 1);
		expect(shown.map((span) => span.textContent)).toEqual(["Mon", "Wed", "Fri"]);

		expect(day(host, "2026-11-03").getAttribute("aria-label")).toBe(
			"12 contributions on Tuesday, Nov 3",
		);
		expect(day(host, "2025-11-15").getAttribute("aria-label")).toBe(
			"1 contribution on Saturday, Nov 15",
		);
		await expect.element(page.getByText("Less")).toBeVisible();
		await expect.element(page.getByText("More")).toBeVisible();
	});

	test("puts each day at the level its count reaches, by default or given thresholds", () => {
		expect([0, 1, 3, 4, 7, 8, 11, 12, 99].map((count) => contributionLevel(count))).toEqual([
			0, 1, 1, 2, 2, 3, 3, 4, 4,
		]);
		expect(contributionLevel(5, [0, 2, 10, 20, 30])).toBe(1);

		let host = mount(graph());
		let levels = ["2025-11-14", "2025-11-15", "2025-11-16", "2025-11-17", "2025-11-18"].map(
			(date) => day(host, date).dataset.level,
		);
		expect(levels).toEqual(["0", "1", "2", "3", "4"]);

		let custom = mount(graph({ levels: [0, 5, 10, 20, 40] }));
		expect(day(custom, "2025-11-18").dataset.level).toBe("2");
	});

	for (let mode of ["light", "dark"] as const) {
		test(`tints the five levels from the accent in ${mode}`, () => {
			if (mode === "dark") document.documentElement.className = "dark";
			let host = mount(graph());
			let fills = ["2025-11-14", "2025-11-15", "2025-11-16", "2025-11-17", "2025-11-18"].map(
				(date) => fill(day(host, date)),
			);
			let probe = document.createElement("span");
			probe.style.backgroundColor = "var(--ui-brand-bg-solid)";
			host.appendChild(probe);

			expect(new Set(fills).size).toBe(5);
			expect(fills[4]).toBe(fill(probe));
			let swatches = [
				...host.querySelectorAll('[data-slot="contribution-graph-legend"] [data-level]'),
			];
			expect(swatches.map(fill)).toEqual(fills);
		});
	}

	test("draws the empty level apart in light and dark", () => {
		let light = fill(day(mount(graph()), "2025-11-14"));
		document.body.replaceChildren();
		document.documentElement.className = "dark";
		let dark = fill(day(mount(graph()), "2025-11-14"));

		expect(dark).not.toBe(light);
	});

	test("takes a theme's own --graph-level-N tokens", () => {
		let host = mount(graph());
		host.style.setProperty("--graph-level-2", "rgb(1, 2, 3)");

		expect(fill(day(host, "2025-11-16"))).toBe("rgb(1, 2, 3)");
	});

	test("starts weeks on the locale's first day, or on the one given", () => {
		expect(weekStartFor("en-US")).toBe(0);
		expect(weekStartFor("en-GB")).toBe(1);

		let monday = mount(graph({ locale: "en-GB" }));
		let first = monday.querySelector<HTMLElement>('tbody th[scope="row"] > span')!;
		expect(first.textContent).toBe("Mon");

		let saturday = mount(graph({ weekStart: 6 }));
		expect(saturday.querySelector('tbody th[scope="row"] > span')!.textContent).toBe("Sat");
	});

	test("gives every day a title in the server markup, for visitors without script", async () => {
		let html = await renderToString(graph());
		let markup = new DOMParser().parseFromString(html, "text/html");
		let tuesday = markup.querySelector('[data-date="2026-11-03"]')!;

		expect(tuesday.getAttribute("title")).toBe("12 contributions on Tuesday, Nov 3");
		expect(
			markup.querySelectorAll('[data-slot="contribution-graph-day"][tabindex="0"]'),
		).toHaveLength(1);
		expect(markup.querySelector('[tabindex="0"]')!.getAttribute("data-date")).toBe(END);
	});

	test("links each day when href is given", () => {
		let host = mount(graph({ href: (date) => `/activity?date=${date}` }));
		let link = day(host, "2026-11-03");

		expect(link.tagName).toBe("A");
		expect(link.getAttribute("href")).toBe("/activity?date=2026-11-03");
		expect(link.parentElement!.dataset.level).toBe("4");
	});

	test("shows one shared tooltip over the hovered or focused day", async () => {
		let host = mount(graph());
		let tooltip = host.querySelector<HTMLElement>('[data-slot="contribution-graph-tooltip"]')!;

		expect(host.querySelectorAll('[role="tooltip"]')).toHaveLength(1);
		expect(day(host, "2026-11-03").hasAttribute("title")).toBe(false);

		await userEvent.hover(day(host, "2026-11-03"));
		expect(tooltip.matches(":popover-open")).toBe(true);
		expect(tooltip.textContent).toBe("12 contributions on Tuesday, Nov 3");
		let cell = day(host, "2026-11-03").getBoundingClientRect();
		let tip = tooltip.getBoundingClientRect();
		expect(tip.bottom).toBeLessThanOrEqual(cell.top + 0.5);
		expect(Math.abs((tip.left + tip.right) / 2 - (cell.left + cell.right) / 2)).toBeLessThan(2);

		day(host, END).focus();
		expect(tooltip.textContent).toBe("3 contributions on Friday, Nov 13");
		await userEvent.keyboard("{Escape}");
		expect(tooltip.matches(":popover-open")).toBe(false);
	});

	test("moves one Tab stop through the days with the arrows, Home and End", async () => {
		let host = mount(graph());
		let last = day(host, END);

		expect(last.tabIndex).toBe(0);
		expect(
			host.querySelectorAll('[data-slot="contribution-graph-day"][tabindex="0"]'),
		).toHaveLength(1);
		last.focus();

		await userEvent.keyboard("{ArrowLeft}");
		expect(document.activeElement).toBe(day(host, "2026-11-06"));
		await userEvent.keyboard("{ArrowUp}");
		expect(document.activeElement).toBe(day(host, "2026-11-05"));
		await userEvent.keyboard("{ArrowRight}");
		expect(document.activeElement).toBe(day(host, "2026-11-12"));
		await userEvent.keyboard("{ArrowDown}");
		expect(document.activeElement).toBe(day(host, END));
		await userEvent.keyboard("{ArrowRight}");
		expect(document.activeElement).toBe(day(host, END));
		await userEvent.keyboard("{ArrowDown}");
		expect(document.activeElement).toBe(day(host, END));

		await userEvent.keyboard("{Home}");
		expect(document.activeElement).toBe(day(host, "2025-11-14"));
		await userEvent.keyboard("{End}");
		expect(document.activeElement).toBe(day(host, END));
		await userEvent.keyboard("{Control>}{Home}{/Control}");
		expect(document.activeElement).toBe(day(host, START));
		expect((document.activeElement as HTMLElement).tabIndex).toBe(0);
		expect(last.tabIndex).toBe(-1);
	});

	test("scrolls inside its own box on a 375px phone, opening on the current week", async () => {
		await page.viewport(375, 812);
		let host = mount(graph(), 343);
		let scroller = host.querySelector<HTMLElement>('[data-slot="contribution-graph-scroller"]')!;

		expect(scroller.scrollWidth).toBeGreaterThan(scroller.clientWidth);
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(375);
		let box = scroller.getBoundingClientRect();
		let today = day(host, END).getBoundingClientRect();
		expect(today.right).toBeLessThanOrEqual(box.right);
		expect(today.left).toBeGreaterThanOrEqual(box.left);
		let weekdays = host.querySelector('tbody th[scope="row"]')!.getBoundingClientRect();
		expect(weekdays.left).toBeGreaterThanOrEqual(box.left - 0.5);
	});

	test("keeps a graph that fits at the start of a wide box", () => {
		let host = mount(graph(), 1100);
		let scroller = host.querySelector<HTMLElement>('[data-slot="contribution-graph-scroller"]')!;
		let table = host.querySelector("table")!;

		expect(scroller.scrollWidth).toBeLessThanOrEqual(scroller.clientWidth);
		expect(table.getBoundingClientRect().left - scroller.getBoundingClientRect().left).toBeLessThan(
			1,
		);
	});
});
