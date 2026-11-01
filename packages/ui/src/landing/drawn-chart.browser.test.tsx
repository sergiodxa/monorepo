/**
 * Lays out {@link DrawnChart} in a real browser: the bars' named list with fills in
 * proportion to their values, the line's named image with a hidden list of its values,
 * the real headline number in the text, nothing overflowing or under the pause toggle on
 * a phone, separate keyframes per series length, and a still, finished figure under reduced motion.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";
import { cdp, page } from "vitest/browser";

import { DrawnChart } from "./drawn-chart.js";

import "../reset.css";
import "../theme.css";

let mounted: RenderResult[] = [];

afterEach(async () => {
	await page.viewport(414, 896);
	await cdp().send("Emulation.setEmulatedMedia", { features: [] });
	for (let result of mounted) result.cleanup();
	mounted = [];
	document.body.innerHTML = "";
});

/** Median minutes between checks of a feed, by how often it posts. */
const SERIES: DrawnChart.Datum[] = [
	{ label: "Posts several times an hour", value: 15, display: "15 min" },
	{ label: "Posts hourly", value: 30, display: "30 min" },
	{ label: "Posts daily", value: 120, display: "2 h" },
	{ label: "Posts weekly or less", value: 240, display: "4 h" },
];

/** The headline the tests share: an integer that counts, with a suffix. */
const METRIC: DrawnChart.Metric = {
	value: 12400,
	suffix: " feeds",
	label: "Checked in the last hour across every plan and region",
};

/** Mounts `node` in a 280px column and returns its host. */
function mount(node: JSX.Element, width = 280): HTMLElement {
	let host = document.createElement("div");
	host.style.cssText = `inline-size: ${width}px; container-type: inline-size`;
	document.body.appendChild(host);
	mounted.push(render(node, { container: host }));
	return host;
}

/** A bar chart of `series` under the shared metric. */
function bars(series: readonly DrawnChart.Datum[] = SERIES) {
	return (
		<DrawnChart
			aria-label="Time between checks, by how often a feed posts"
			metric={METRIC}
			series={series}
			highlight={0}
			footnote="Median over the last 30 days"
		/>
	);
}

/** Median response time by weekday, with labels short enough to sit under a phone's plot. */
const WEEK: DrawnChart.Datum[] = [
	{ label: "Mon", value: 180, display: "180 ms" },
	{ label: "Tue", value: 160, display: "160 ms" },
	{ label: "Wed", value: 240, display: "240 ms" },
	{ label: "Thu", value: 140, display: "140 ms" },
	{ label: "Fri", value: 150, display: "150 ms" },
];

/** A line chart of `series` with no metric. */
function line(series: readonly DrawnChart.Datum[] = WEEK) {
	return (
		<DrawnChart
			variant="line"
			aria-label="Response time over the week"
			series={series}
			highlight={2}
		/>
	);
}

/** Emulates the visitor's motion preference for the rest of the test. */
async function prefersReducedMotion(): Promise<void> {
	await cdp().send("Emulation.setEmulatedMedia", {
		features: [{ name: "prefers-reduced-motion", value: "reduce" }],
	});
}

/**
 * Text drawn only for assistive technology while the figure animates: the real headline
 * number behind its counter, and the line's list of values.
 */
const VISUALLY_HIDDEN =
	"[data-slot='drawn-chart-number-text'], [data-slot='drawn-chart-line'] > ol";

/** Whether two boxes share any area. */
function overlaps(a: DOMRect, b: DOMRect): boolean {
	return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

describe("DrawnChart", () => {
	test("lists one bar per datum under the chart's name, with the real metric in the text", () => {
		let host = mount(bars());
		let list = host.querySelector("ol")!;
		expect(list.getAttribute("aria-label")).toBe("Time between checks, by how often a feed posts");
		expect(list.children).toHaveLength(SERIES.length);
		expect(host.textContent).toContain("12,400 feeds");
		expect(host.textContent).toContain("Median over the last 30 days");
		expect(host.querySelector('[data-slot="drawn-chart-count"]')!.getAttribute("aria-hidden")).toBe(
			"true",
		);
	});

	test("draws the line as a named image with one unbroken path and a hidden list of values", () => {
		let host = mount(line());
		let svg = host.querySelector("svg")!;
		expect(svg.getAttribute("role")).toBe("img");
		expect(svg.getAttribute("aria-label")).toBe("Response time over the week");
		let path = svg.querySelector("path")!;
		expect(path.getAttribute("d")).toBe("M0 25 L25 33.33 L50 0 L75 41.67 L100 37.5");
		expect(getComputedStyle(path).vectorEffect).toBe("non-scaling-stroke");
		expect(getComputedStyle(path).strokeDasharray).toBe("none");
		expect(getComputedStyle(svg).animationName).toBe("ui-drawn-chart-line-5");
		expect(host.querySelectorAll('[data-slot="drawn-chart-point"]')).toHaveLength(WEEK.length);
		let hidden = host.querySelector('[data-slot="drawn-chart-line"] > ol')!;
		expect(hidden.children).toHaveLength(WEEK.length);
		expect(hidden.textContent).toContain("Wed: 240 ms");
		expect(hidden.getBoundingClientRect().width).toBeLessThanOrEqual(1);
	});

	test("keeps everything inside a 280px column and clear of the pause toggle across phone widths", async () => {
		let hits: string[] = [];
		for (let width = 260; width <= 420; width += 8) {
			await page.viewport(width, 900);
			for (let [kind, node] of [
				["bars", bars()],
				["line", line()],
			] as const) {
				let result = render(<div style={{ padding: "0 16px" }}>{node}</div>);
				let surface = result.$('[data-slot="drawn-chart"]')!;
				let box = surface.getBoundingClientRect();
				if (surface.scrollWidth > surface.clientWidth) hits.push(`${kind}@${width}: scroll`);
				let toggle = result.$('[data-slot="motion-loop"] > :last-child')!.getBoundingClientRect();
				let rects: DOMRect[] = [];
				let walker = document.createTreeWalker(surface, NodeFilter.SHOW_TEXT);
				while (walker.nextNode()) {
					let parent = walker.currentNode.parentElement!;
					if (parent.closest(VISUALLY_HIDDEN)) continue;
					let range = document.createRange();
					range.selectNodeContents(walker.currentNode);
					rects.push(...range.getClientRects());
				}
				let count = result.$('[data-slot="drawn-chart-count"]');
				if (count) rects.push(count.getBoundingClientRect());
				for (let rect of rects) {
					if (overlaps(rect, toggle)) hits.push(`${kind}@${width}: toggle`);
					if (rect.left < box.left - 0.5 || rect.right > box.right + 0.5) {
						hits.push(`${kind}@${width}: outside`);
					}
				}
				result.cleanup();
			}
		}
		expect(hits).toEqual([]);
		expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
	});

	test("animates series of different lengths on separate keyframes", () => {
		let four = mount(bars());
		let three = mount(bars(SERIES.slice(0, 3)));
		let firstBar = (root: HTMLElement) =>
			getComputedStyle(root.querySelector('[data-slot="drawn-chart-bar"]')!).animationName;
		expect(firstBar(four)).toBe("ui-drawn-chart-bar-4-0");
		expect(firstBar(three)).toBe("ui-drawn-chart-bar-3-0");

		let lineFour = mount(line());
		let lineThree = mount(line(WEEK.slice(0, 3)));
		let stroke = (root: HTMLElement) => getComputedStyle(root.querySelector("svg")!).animationName;
		expect(stroke(lineFour)).not.toBe(stroke(lineThree));

		let other = mount(
			<DrawnChart aria-label="Checks" metric={{ ...METRIC, value: 900 }} series={SERIES} />,
		);
		let counter = (root: HTMLElement) =>
			getComputedStyle(root.querySelector('[data-slot="drawn-chart-count"]')!, "::before")
				.animationName;
		expect(counter(other)).not.toBe(counter(four));
	});

	test("counts the metric on a pseudo-element while the real number is visually hidden", () => {
		let host = mount(bars());
		let count = host.querySelector('[data-slot="drawn-chart-count"]')!;
		let text = host.querySelector<HTMLElement>('[data-slot="drawn-chart-number-text"]')!;
		expect(getComputedStyle(count, "::before").animationName).toMatch(/^ui-drawn-chart-count-/);
		expect(text.textContent).toBe("12,400 feeds");
		expect(text.getBoundingClientRect().width).toBeLessThanOrEqual(1);
	});

	test("holds the finished figure still under reduced motion, bars in proportion to values", async () => {
		await prefersReducedMotion();
		let host = mount(bars());
		let fills = [...host.querySelectorAll<HTMLElement>('[data-slot="drawn-chart-bar"]')];
		let track = fills[0]!.parentElement!.getBoundingClientRect().width;
		for (let [index, fill] of fills.entries()) {
			expect(getComputedStyle(fill).animationName).toBe("none");
			expect(getComputedStyle(fill).transform).toBe("none");
			expect(fill.getBoundingClientRect().width).toBeCloseTo(
				(SERIES[index]!.value / 240) * track,
				0,
			);
		}
		let count = host.querySelector<HTMLElement>('[data-slot="drawn-chart-count"]')!;
		let text = host.querySelector<HTMLElement>('[data-slot="drawn-chart-number-text"]')!;
		expect(getComputedStyle(count).display).toBe("none");
		expect(text.getBoundingClientRect().width).toBeGreaterThan(40);

		let chart = mount(line());
		let plot = chart.querySelector("svg")!;
		expect(getComputedStyle(plot).animationName).toBe("none");
		expect(getComputedStyle(plot).clipPath).toBe("none");
		for (let point of chart.querySelectorAll('[data-slot="drawn-chart-point"]')) {
			expect(getComputedStyle(point).opacity).toBe("1");
		}
	});

	test("scales to an explicit max and shows a non-integer metric statically", () => {
		let host = mount(
			<DrawnChart
				aria-label="Uptime by region"
				metric={{ value: 99.98, suffix: "%", label: "Uptime over 90 days" }}
				series={[{ label: "EU", value: 50 }]}
				max={100}
			/>,
		);
		expect(host.querySelector('[data-slot="drawn-chart-count"]')).toBeNull();
		expect(host.textContent).toContain("99.98%");
		let fill = host.querySelector<HTMLElement>('[data-slot="drawn-chart-bar"]')!;
		expect(fill.style.inlineSize).toBe("50%");
	});
});
