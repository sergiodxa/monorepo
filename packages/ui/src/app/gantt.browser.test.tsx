/**
 * Holds the chart to its contract in a real browser: a bar starts and ends on its days, a
 * late bar runs a tail to its projection, today's line falls on today, the list column stays
 * put while the axis scrolls, and every bar's dates are written out for a screen reader.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { Gantt, ganttDay } from "./gantt.js";

import "../reset.css";
import "../theme.css";

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
});

/** The chart's strings. */
const LABELS: Gantt.Labels = {
	today: "Today",
	schedule: "{start} to {end}",
	progress: "{percent} complete",
	projected: "projected to finish {date}",
	unscheduled: "No dates",
};

/** The first day on the test axis. */
const START = "2026-09-01";

/** Mounts a chart 900px wide with an on-time, a late and an unscheduled project. */
function mount(width = 900): HTMLElement {
	mounted = render(
		<div style={`inline-size:${width}px; block-size: 400px; display: flex`}>
			<Gantt
				label="Gantt"
				start={START}
				end="2027-02-28"
				today="2026-11-12"
				labels={LABELS}
				header={<span>Projects</span>}
				style="--ui-gantt-day-width: 6px; --ui-gantt-list-width: 200px; flex: 1"
			>
				<Gantt.Group title="Q4 2026">
					<Gantt.Item
						name="Checkout"
						href="#checkout"
						start="2026-10-01"
						end="2026-11-30"
						progress={0.5}
					/>
					<Gantt.Item
						name="Search"
						start="2026-09-15"
						end="2026-10-31"
						projectedEnd="2026-11-20"
						progress={0.8}
					/>
				</Gantt.Group>
				<Gantt.Group title="Later">
					<Gantt.Item name="Billing" />
				</Gantt.Group>
			</Gantt>
		</div>,
	);
	return mounted.container.querySelector<HTMLElement>('[data-slot="gantt"]')!;
}

/** The left edge of the grid, which day 0 of the axis sits `200px` (the list) after. */
function axisOrigin(gantt: HTMLElement): number {
	return gantt.querySelector('[data-slot="gantt-grid"]')!.getBoundingClientRect().left + 200;
}

/** Days from the axis's first day to `date`. */
function offset(date: string): number {
	return ganttDay(date) - ganttDay(START);
}

describe("Gantt", () => {
	test("a bar starts on its first day and ends after its target day", () => {
		let gantt = mount();
		let bar = gantt.querySelector('[data-slot="gantt-bar"]')!.getBoundingClientRect();
		let origin = axisOrigin(gantt);

		expect(Math.abs(bar.left - (origin + offset("2026-10-01") * 6))).toBeLessThanOrEqual(1);
		expect(Math.abs(bar.width - 61 * 6)).toBeLessThanOrEqual(1);
	});

	test("a late bar runs a hatched tail to its projected day; an on-time bar has none", () => {
		let gantt = mount();
		let tails = gantt.querySelectorAll('[data-slot="gantt-late"]');
		expect(tails).toHaveLength(1);
		let tail = tails[0]!.getBoundingClientRect();
		let origin = axisOrigin(gantt);
		expect(Math.abs(tail.right - (origin + (offset("2026-11-20") + 1) * 6))).toBeLessThanOrEqual(1);
	});

	test("today's line falls in the middle of today", () => {
		let gantt = mount();
		let line = gantt.querySelector('[data-slot="gantt-today"]')!.getBoundingClientRect();
		let expected = axisOrigin(gantt) + (offset("2026-11-12") + 0.5) * 6;
		expect(Math.abs(line.left + line.width / 2 - expected)).toBeLessThanOrEqual(1);
	});

	test("rows share one height and a project with no dates draws no bar", () => {
		let gantt = mount();
		let rows = [...gantt.querySelectorAll<HTMLElement>('[data-slot="gantt-item"]')];
		expect(rows.map((row) => Math.round(row.getBoundingClientRect().height))).toEqual([44, 44, 44]);
		expect(rows[2]!.querySelector('[data-slot="gantt-bar"]')).toBeNull();
		expect(rows[2]!.textContent).toContain("No dates");
	});

	test("the list column and the axis stay put while the chart scrolls", () => {
		let gantt = mount(600);
		let name = gantt.querySelector('[data-slot="gantt-item-name"]')!;
		let axis = gantt.querySelector('[data-slot="gantt-axis"]')!;
		let before = name.getBoundingClientRect().left;
		let top = axis.getBoundingClientRect().top;

		gantt.scrollLeft = 300;
		gantt.scrollTop = 40;
		expect(gantt.scrollLeft).toBe(300);
		expect(name.getBoundingClientRect().left).toBe(before);
		expect(axis.getBoundingClientRect().top).toBe(top);
	});

	test("writes each bar's schedule, progress and projection into its row's name", () => {
		let gantt = mount();
		let [checkout, search] = gantt.querySelectorAll('[data-slot="gantt-item-name"]');
		expect(checkout!.textContent).toContain("Oct 1, 2026 to Nov 30, 2026, 50% complete");
		expect(search!.textContent).toContain("projected to finish Nov 20, 2026");
	});

	test("a phone-narrow chart narrows its list column and drops each row's meta", () => {
		mounted = render(
			<div style="inline-size: 360px; block-size: 400px; display: flex">
				<Gantt label="Gantt" start={START} end="2027-02-28" labels={LABELS} style="flex: 1">
					<Gantt.Group title="Q4 2026">
						<Gantt.Item name="Checkout" meta={<span data-testid="meta">Lead</span>} />
					</Gantt.Group>
				</Gantt>
			</div>,
		);
		let name = mounted.container.querySelector('[data-slot="gantt-item-name"]')!;
		let meta = mounted.container.querySelector('[data-testid="meta"]')!;

		expect(Math.round(name.getBoundingClientRect().width)).toBe(160);
		expect(meta.getBoundingClientRect().width).toBe(0);
	});

	test("opens scrolled so today sits a third of the way across the visible axis", async () => {
		let gantt = mount(600);
		await new Promise((resolve) => setTimeout(resolve, 100));
		let box = gantt.getBoundingClientRect();
		let line = gantt.querySelector('[data-slot="gantt-today"]')!.getBoundingClientRect();
		let list = gantt.querySelector('[data-slot="gantt-corner"]')!.getBoundingClientRect().width;
		let axis = box.width - list;

		expect(gantt.scrollLeft).toBeGreaterThan(0);
		expect(Math.abs(line.left - (box.left + list + axis / 3))).toBeLessThanOrEqual(2);
	});

	test("stays at its first day when today is already in view", async () => {
		let gantt = mount(1400);
		await new Promise((resolve) => setTimeout(resolve, 100));
		expect(gantt.scrollLeft).toBe(0);
	});

	test("labels the months across the top", () => {
		let gantt = mount();
		let months = [...gantt.querySelectorAll('[data-slot="gantt-month"]')].map(
			(month) => month.textContent,
		);
		expect(months).toEqual(["September", "October", "November", "December", "January", "February"]);
	});
});
