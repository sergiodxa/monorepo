/**
 * Holds the roadmap to its contract in a real browser: a bar starts and ends on its days, a
 * late bar runs a tail to its projection, today's line falls on today, the list column stays
 * put while the axis scrolls, and every bar's dates are written out for a screen reader.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { Roadmap, roadmapDay } from "./roadmap.js";

import "../reset.css";
import "../theme.css";

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
});

/** The roadmap's strings. */
const LABELS: Roadmap.Labels = {
	today: "Today",
	schedule: "{start} to {end}",
	progress: "{percent} complete",
	projected: "projected to finish {date}",
	unscheduled: "No dates",
};

/** The first day on the test axis. */
const START = "2026-09-01";

/** Mounts a roadmap 900px wide with an on-time, a late and an unscheduled project. */
function mount(width = 900): HTMLElement {
	mounted = render(
		<div style={`inline-size:${width}px; block-size: 400px; display: flex`}>
			<Roadmap
				label="Roadmap"
				start={START}
				end="2027-02-28"
				today="2026-11-12"
				labels={LABELS}
				header={<span>Projects</span>}
				style="--ui-roadmap-day-width: 6px; --ui-roadmap-list-width: 200px; flex: 1"
			>
				<Roadmap.Group title="Q4 2026">
					<Roadmap.Item
						name="Checkout"
						href="#checkout"
						start="2026-10-01"
						end="2026-11-30"
						progress={0.5}
					/>
					<Roadmap.Item
						name="Search"
						start="2026-09-15"
						end="2026-10-31"
						projectedEnd="2026-11-20"
						progress={0.8}
					/>
				</Roadmap.Group>
				<Roadmap.Group title="Later">
					<Roadmap.Item name="Billing" />
				</Roadmap.Group>
			</Roadmap>
		</div>,
	);
	return mounted.container.querySelector<HTMLElement>('[data-slot="roadmap"]')!;
}

/** The left edge of the grid, which day 0 of the axis sits `200px` (the list) after. */
function axisOrigin(roadmap: HTMLElement): number {
	return roadmap.querySelector('[data-slot="roadmap-grid"]')!.getBoundingClientRect().left + 200;
}

/** Days from the axis's first day to `date`. */
function offset(date: string): number {
	return roadmapDay(date) - roadmapDay(START);
}

describe("Roadmap", () => {
	test("a bar starts on its first day and ends after its target day", () => {
		let roadmap = mount();
		let bar = roadmap.querySelector('[data-slot="roadmap-bar"]')!.getBoundingClientRect();
		let origin = axisOrigin(roadmap);

		expect(Math.abs(bar.left - (origin + offset("2026-10-01") * 6))).toBeLessThanOrEqual(1);
		expect(Math.abs(bar.width - 61 * 6)).toBeLessThanOrEqual(1);
	});

	test("a late bar runs a hatched tail to its projected day; an on-time bar has none", () => {
		let roadmap = mount();
		let tails = roadmap.querySelectorAll('[data-slot="roadmap-late"]');
		expect(tails).toHaveLength(1);
		let tail = tails[0]!.getBoundingClientRect();
		let origin = axisOrigin(roadmap);
		expect(Math.abs(tail.right - (origin + (offset("2026-11-20") + 1) * 6))).toBeLessThanOrEqual(1);
	});

	test("today's line falls in the middle of today", () => {
		let roadmap = mount();
		let line = roadmap.querySelector('[data-slot="roadmap-today"]')!.getBoundingClientRect();
		let expected = axisOrigin(roadmap) + (offset("2026-11-12") + 0.5) * 6;
		expect(Math.abs(line.left + line.width / 2 - expected)).toBeLessThanOrEqual(1);
	});

	test("rows share one height and a project with no dates draws no bar", () => {
		let roadmap = mount();
		let rows = [...roadmap.querySelectorAll<HTMLElement>('[data-slot="roadmap-item"]')];
		expect(rows.map((row) => Math.round(row.getBoundingClientRect().height))).toEqual([44, 44, 44]);
		expect(rows[2]!.querySelector('[data-slot="roadmap-bar"]')).toBeNull();
		expect(rows[2]!.textContent).toContain("No dates");
	});

	test("the list column and the axis stay put while the roadmap scrolls", () => {
		let roadmap = mount(600);
		let name = roadmap.querySelector('[data-slot="roadmap-item-name"]')!;
		let axis = roadmap.querySelector('[data-slot="roadmap-axis"]')!;
		let before = name.getBoundingClientRect().left;
		let top = axis.getBoundingClientRect().top;

		roadmap.scrollLeft = 300;
		roadmap.scrollTop = 40;
		expect(roadmap.scrollLeft).toBe(300);
		expect(name.getBoundingClientRect().left).toBe(before);
		expect(axis.getBoundingClientRect().top).toBe(top);
	});

	test("writes each bar's schedule, progress and projection into its row's name", () => {
		let roadmap = mount();
		let [checkout, search] = roadmap.querySelectorAll('[data-slot="roadmap-item-name"]');
		expect(checkout!.textContent).toContain("Oct 1, 2026 to Nov 30, 2026, 50% complete");
		expect(search!.textContent).toContain("projected to finish Nov 20, 2026");
	});

	test("a phone-narrow roadmap narrows its list column and drops each row's meta", () => {
		mounted = render(
			<div style="inline-size: 360px; block-size: 400px; display: flex">
				<Roadmap label="Roadmap" start={START} end="2027-02-28" labels={LABELS} style="flex: 1">
					<Roadmap.Group title="Q4 2026">
						<Roadmap.Item name="Checkout" meta={<span data-testid="meta">Lead</span>} />
					</Roadmap.Group>
				</Roadmap>
			</div>,
		);
		let name = mounted.container.querySelector('[data-slot="roadmap-item-name"]')!;
		let meta = mounted.container.querySelector('[data-testid="meta"]')!;

		expect(Math.round(name.getBoundingClientRect().width)).toBe(160);
		expect(meta.getBoundingClientRect().width).toBe(0);
	});

	test("labels the months across the top", () => {
		let roadmap = mount();
		let months = [...roadmap.querySelectorAll('[data-slot="roadmap-month"]')].map(
			(month) => month.textContent,
		);
		expect(months).toEqual(["September", "October", "November", "December", "January", "February"]);
	});
});
