/**
 * Draws the chart's annotations in a real browser: a comparison series dashed and muted, a
 * threshold line at its value with its label, an annotation band across its range, and a
 * period with no data hatched at full height instead of drawn as zero, on a bar, a band, and a
 * gap in a line or area.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";

import { render } from "remix/component/test";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { page } from "vitest/browser";

import { Chart } from "./chart.js";

import "../reset.css";
import "../theme.css";

/** Twelve hours of p95 latency, current and the same hours a week before. */
const CURRENT = [180, 176, 190, 240, 320, 300, 210, 190, 185, 182, 179, 181].map((y, x) => ({
	x,
	y,
	label: `${x}:00 ${y} ms`,
}));
const PREVIOUS = CURRENT.map((point) => ({
	...point,
	y: point.y - 20,
	label: `Last week ${point.label}`,
}));

/** Mounts `node` in a host 480 pixels wide, matching the chart's coordinate space. */
function mount(node: JSX.Element, width = 480): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	for (let [name, value] of Object.entries(ROLES)) host.style.setProperty(name, value);
	document.body.appendChild(host);
	render(node, { container: host });
	return host;
}

/**
 * Light-mode role colours set on every host as plain sRGB, so contrast is computed from known
 * values whatever the theme resolves them to.
 */
const ROLES = {
	"--ui-danger-fg": "rgb(220 38 38)",
	"--ui-danger-bg-tint": "rgb(254 242 242)",
	"--ui-danger-fg-emphasis": "rgb(127 29 29)",
	"--ui-danger-border": "rgb(254 202 202)",
	"--ui-neutral-fg-muted": "rgb(113 113 122)",
	"--ui-neutral-bg-tint": "rgb(250 250 250)",
	"--ui-neutral-fg-emphasis": "rgb(24 24 27)",
	"--ui-neutral-border": "rgb(228 228 231)",
};

/** A band's label tag. */
function label(band: Element): SVGTextElement | null {
	return band.querySelector<SVGTextElement>('[data-slot="chart-band-label"]');
}

/** A computed colour's sRGB channels and alpha, each 0 to 1. */
function channels(color: string): [number, number, number, number] {
	let numbers = color.match(/[\d.]+/g)!.map(Number);
	if (color.startsWith("color(")) {
		let [r = 0, g = 0, b = 0, a = 1] = numbers;
		return [r, g, b, a];
	}
	let [r = 0, g = 0, b = 0, a = 1] = numbers;
	return [r / 255, g / 255, b / 255, a];
}

/** WCAG relative luminance of an opaque sRGB colour. */
function luminance(color: string): number {
	let [r, g, b] = channels(color).map((value) =>
		value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
	);
	return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** WCAG contrast ratio between two opaque colours. */
function contrast(a: string, b: string): number {
	let [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (light! + 0.05) / (dark! + 0.05);
}

/** How opaque a band's shading paints: its fill colour's alpha times its `fill-opacity`. */
function shading(rect: SVGRectElement): number {
	let style = getComputedStyle(rect);
	return channels(style.fill)[3] * Number(style.fillOpacity);
}

beforeEach(async () => {
	await page.viewport(1280, 800);
});

afterEach(() => {
	document.body.replaceChildren();
});

describe("Chart annotations", () => {
	test("draws the comparison series dashed in the muted colour", () => {
		let host = mount(
			<Chart width={480} height={200} xDomain={[0, 11]} yDomain={[0, 400]} aria-label="Latency">
				<Chart.Line points={PREVIOUS} comparison />
				<Chart.Line points={CURRENT} />
			</Chart>,
		);
		let [previous, current] = host.querySelectorAll<SVGGElement>("svg > g");
		let previousPath = getComputedStyle(previous!.querySelector("path")!);
		let currentPath = getComputedStyle(current!.querySelector("path")!);

		expect(previous!.hasAttribute("data-comparison")).toBe(true);
		expect(previousPath.strokeDasharray).toBe("4px, 4px");
		expect(currentPath.strokeDasharray).toBe("none");
		expect(getComputedStyle(previous!).color).not.toBe(getComputedStyle(current!).color);
	});

	test("draws a threshold line at its value with its label", async () => {
		let host = mount(
			<Chart width={480} height={200} xDomain={[0, 11]} yDomain={[0, 400]} aria-label="Latency">
				<Chart.Line points={CURRENT} />
				<Chart.Threshold y={300} label="SLO 300 ms" tone="warning" />
			</Chart>,
		);
		let threshold = host.querySelector<SVGGElement>('[data-slot="chart-threshold"]')!;
		let line = threshold.querySelector("line")!;

		expect(line.getAttribute("y1")).toBe("50");
		expect(line.getAttribute("x2")).toBe("480");
		expect(getComputedStyle(line).strokeDasharray).toBe("6px, 4px");
		expect(threshold.querySelector("text")?.textContent).toBe("SLO 300 ms");
		await expect.element(page.getByRole("img", { name: "SLO 300 ms" })).toBeInTheDocument();
	});

	test("shades an annotation band across its range at full height", () => {
		let host = mount(
			<Chart width={480} height={200} xDomain={[0, 12]} yDomain={[0, 400]} aria-label="Latency">
				<Chart.Band from={3} to={6} label="Incident #42" />
				<Chart.Line points={CURRENT} />
			</Chart>,
		);
		let band = host.querySelector<SVGGElement>('[data-slot="chart-band"]')!;
		let rect = band.querySelector("rect")!;
		let svg = host.querySelector("svg")!.getBoundingClientRect();
		let box = rect.getBoundingClientRect();

		expect(box.left - svg.left).toBeCloseTo(120, 0);
		expect(box.width).toBeCloseTo(120, 0);
		expect(box.height).toBeCloseTo(svg.height, 0);
		expect(label(band)?.textContent?.trim()).toBe("Incident #42");
		expect(getComputedStyle(band).pointerEvents).toBe("none");
	});

	test("hatches a bar with no data at full height instead of drawing zero", () => {
		let host = mount(
			<Chart.Bar
				width={480}
				height={200}
				domain={[0, 100]}
				aria-label="Revenue"
				series={["revenue"]}
				data={[
					{ category: "Jan", values: { revenue: { value: null, label: "Jan: no data" } } },
					{ category: "Feb", values: { revenue: { value: 40, label: "Feb: 40" } } },
				]}
			/>,
		);
		let [empty, filled] = host.querySelectorAll<SVGRectElement>("rect");
		let pattern = host.querySelector("pattern")!;

		expect(empty!.hasAttribute("data-empty")).toBe(true);
		expect(empty!.getAttribute("height")).toBe("200");
		expect(empty!.getAttribute("fill")).toBe(`url(#${pattern.id})`);
		expect(empty!.querySelector("title")?.textContent).toBe("Jan: no data");
		expect(filled!.getAttribute("height")).toBe("80");
	});

	test("leaves the hatch pattern out when every bar has data", () => {
		let host = mount(
			<Chart.Bar
				width={480}
				height={200}
				domain={[0, 100]}
				aria-label="Revenue"
				series={["revenue"]}
				data={[{ category: "Feb", values: { revenue: { value: 40, label: "Feb: 40" } } }]}
			/>,
		);
		expect(host.querySelector("pattern")).toBeNull();
	});

	test("hatches a no-data band with the pattern a bar with no data uses", () => {
		let host = mount(
			<Chart width={480} height={200} xDomain={[0, 12]} yDomain={[0, 400]} aria-label="Latency">
				<Chart.Band from={3} to={6} label="No data" variant="hatched" />
				<Chart.Band from={8} to={9} label="Incident #42" />
			</Chart>,
		);
		let [hatched, filled] = host.querySelectorAll<SVGGElement>('[data-slot="chart-band"]');
		let rect = hatched!.querySelector("rect")!;
		let pattern = host.querySelector("pattern")!;

		expect(hatched!.getAttribute("data-variant")).toBe("hatched");
		expect(rect.getAttribute("fill")).toBe(`url(#${pattern.id})`);
		let bar = mount(
			<Chart.Bar
				width={480}
				height={200}
				domain={[0, 100]}
				aria-label="Revenue"
				series={["revenue"]}
				data={[{ category: "Jan", values: { revenue: { value: null, label: "Jan: no data" } } }]}
			/>,
		);
		let barPattern = bar.querySelector("pattern")!;

		expect(pattern.outerHTML.replace(pattern.id, "")).toBe(
			barPattern.outerHTML.replace(barPattern.id, ""),
		);
		expect(rect.getBoundingClientRect().width).toBeCloseTo(120, 0);
		expect(label(hatched!)?.textContent?.trim()).toBe("No data");
		expect(host.querySelectorAll("pattern")).toHaveLength(1);
		expect(filled!.querySelector("rect")!.getAttribute("fill")).toBeNull();
	});
});

describe("Chart.Band", () => {
	test("shades its range lightly, a little stronger in dark mode", () => {
		let light = mount(
			<Chart width={480} height={200} xDomain={[0, 12]} yDomain={[0, 400]} aria-label="Latency">
				<Chart.Band from={3} to={6} label="Incident #42" />
			</Chart>,
		);
		let dark = mount(
			<Chart width={480} height={200} xDomain={[0, 12]} yDomain={[0, 400]} aria-label="Latency">
				<Chart.Band from={3} to={6} label="Incident #42" />
			</Chart>,
		);
		dark.style.colorScheme = "dark";
		let lightShade = shading(light.querySelector("rect")!);
		let darkShade = shading(dark.querySelector("rect")!);

		expect(lightShade).toBeGreaterThanOrEqual(0.06);
		expect(lightShade).toBeLessThanOrEqual(0.1);
		expect(darkShade).toBeLessThanOrEqual(0.12);
		expect(darkShade).toBeGreaterThan(lightShade);
	});

	test("marks a closed range with a dashed rule at each edge", () => {
		let host = mount(
			<Chart width={480} height={200} xDomain={[0, 12]} yDomain={[0, 400]} aria-label="Latency">
				<Chart.Band from={3} to={6} label="Incident #42" />
			</Chart>,
		);
		let start = host.querySelector<SVGLineElement>('[data-edge="start"]')!;
		let end = host.querySelector<SVGLineElement>('[data-edge="end"]')!;

		expect(start.getAttribute("x1")).toBe("120");
		expect(start.getAttribute("y2")).toBe("200");
		expect(getComputedStyle(start).strokeDasharray).not.toBe("none");
		expect(getComputedStyle(start).strokeWidth).toBe("1px");
		expect(end.getAttribute("x1")).toBe("240");
		expect(getComputedStyle(end).strokeDasharray).not.toBe("none");
	});

	test("leaves the end rule off a range still running at the end of the axis", () => {
		let host = mount(
			<Chart width={480} height={200} xDomain={[0, 12]} yDomain={[0, 400]} aria-label="Latency">
				<Chart.Band from={9} to={12} label="INC-482 Investigating" />
			</Chart>,
		);

		expect(host.querySelector('[data-edge="start"]')).not.toBeNull();
		expect(host.querySelector('[data-edge="end"]')).toBeNull();
	});

	test("sets its label in a tag readable against the tag background", () => {
		let host = mount(
			<Chart width={480} height={200} xDomain={[0, 12]} yDomain={[0, 400]} aria-label="Latency">
				<Chart.Band from={3} to={6} label="Incident #42" />
				<Chart.Band from={8} to={9} label="No data" variant="hatched" />
			</Chart>,
		);

		for (let band of host.querySelectorAll('[data-slot="chart-band"]')) {
			let text = label(band)!;
			let filter = document.getElementById(text.getAttribute("filter")!.slice(5, -1))!;
			let tint = filter.querySelector("feFlood")!;
			let background = getComputedStyle(tint).floodColor;
			let box = text.getBBox();

			expect(channels(background)[3]).toBe(1);
			expect(contrast(getComputedStyle(text).fill, background)).toBeGreaterThanOrEqual(4.5);
			expect(box.width).toBeGreaterThan(text.getComputedTextLength() * 0.99);
		}
	});

	test("keeps its label the same size however wide the chart renders", () => {
		let chart = (
			<Chart width={480} height={200} xDomain={[0, 12]} yDomain={[0, 400]} aria-label="Latency">
				<Chart.Band from={3} to={6} label="Incident #42" />
			</Chart>
		);
		let narrow = label(mount(chart, 480))!.getBoundingClientRect();
		let wide = label(mount(chart, 960))!.getBoundingClientRect();

		expect(narrow.height).toBeGreaterThan(8);
		expect(wide.height).toBeCloseTo(narrow.height, 0);
		expect(wide.width).toBeCloseTo(narrow.width, 0);
	});

	for (let viewport of [375, 1440]) {
		test(`keeps a late band's label tag inside the plot at ${viewport}px`, async () => {
			await page.viewport(viewport, 800);
			let host = mount(
				<Chart width={600} height={200} xDomain={[0, 10]} yDomain={[0, 400]} aria-label="Latency">
					<Chart.Band from={9} to={10} label="INC-482 · investigating" />
				</Chart>,
				viewport,
			);
			let plot = host.querySelector("svg")!.getBoundingClientRect();
			let tag = label(host)!.getBoundingClientRect();

			expect(tag.width).toBeGreaterThan(0);
			expect(tag.left).toBeGreaterThanOrEqual(plot.left - 0.5);
			expect(tag.right).toBeLessThanOrEqual(plot.right + 0.5);
		});

		test(`starts an early band's label tag at the band's start at ${viewport}px`, async () => {
			await page.viewport(viewport, 800);
			let host = mount(
				<Chart width={600} height={200} xDomain={[0, 10]} yDomain={[0, 400]} aria-label="Latency">
					<Chart.Band from={1} to={2} label="INC-482 · investigating" />
				</Chart>,
				viewport,
			);
			let plot = host.querySelector("svg")!.getBoundingClientRect();
			let start = host.querySelector('[data-edge="start"]')!.getBoundingClientRect();
			let tag = label(host)!.getBoundingClientRect();

			expect(tag.left).toBeGreaterThanOrEqual(start.left - 0.5);
			expect(tag.left - start.left).toBeLessThan(8);
			expect(tag.right).toBeLessThanOrEqual(plot.right + 0.5);
		});
	}

	test("draws the series over the band", () => {
		let host = mount(
			<Chart width={480} height={200} xDomain={[0, 12]} yDomain={[0, 400]} aria-label="Latency">
				<Chart.Band from={3} to={6} label="Incident #42" />
				<Chart.Line points={CURRENT} />
			</Chart>,
		);
		let band = host.querySelector('[data-slot="chart-band"]')!;
		let path = host.querySelector("path")!;

		expect(band.compareDocumentPosition(path) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
		expect(getComputedStyle(path).strokeOpacity).toBe("1");
		expect(getComputedStyle(path).opacity).toBe("1");
	});
});

/** Twelve hours of latency with no checks at 4:00 and 5:00. */
const GAPPED = CURRENT.map((point) =>
	point.x === 4 || point.x === 5 ? { ...point, y: null, label: `${point.x}:00 no data` } : point,
);

/** The `M` commands in a path's `d`, one per drawn segment. */
function moves(path: SVGPathElement): string[] {
	return path.getAttribute("d")?.match(/M [^ ]+/g) ?? [];
}

describe("Chart series with no data", () => {
	test("breaks a line at a null point instead of dropping it to zero", () => {
		let host = mount(
			<Chart width={480} height={200} xDomain={[0, 12]} yDomain={[0, 400]} aria-label="Latency">
				<Chart.Line points={GAPPED} markerCount={12} />
			</Chart>,
		);
		let path = host.querySelector("path")!;
		let d = path.getAttribute("d")!;

		expect(moves(path)).toEqual(["M 0,110", "M 240,95"]);
		expect(d).not.toContain(",200");
		expect(d).not.toContain("160,");
		expect(d).not.toContain("200,");
	});

	test("renders no focusable marker for a null point", () => {
		let host = mount(
			<Chart width={480} height={200} xDomain={[0, 12]} yDomain={[0, 400]} aria-label="Latency">
				<Chart.Line points={GAPPED} markerCount={12} />
			</Chart>,
		);
		let titles = [...host.querySelectorAll("circle > title")].map((title) => title.textContent);

		expect(titles).toContain("3:00 240 ms");
		expect(titles).toContain("6:00 210 ms");
		expect(titles).not.toContain("4:00 no data");
		expect(titles).not.toContain("5:00 no data");
		for (let circle of host.querySelectorAll("circle")) {
			expect(circle.getAttribute("cy")).not.toBe("200");
		}
	});

	test("closes each run of an area down to its baseline on its own", () => {
		let host = mount(
			<Chart width={480} height={200} xDomain={[0, 12]} yDomain={[0, 400]} aria-label="Latency">
				<Chart.Area points={GAPPED} />
			</Chart>,
		);
		let path = host.querySelector("path")!;

		expect(moves(path)).toEqual(["M 0,110", "M 240,95"]);
		expect(path.getAttribute("d")!.match(/Z/g)).toHaveLength(2);
		expect(path.getAttribute("d")).not.toContain("160,");
	});
});
