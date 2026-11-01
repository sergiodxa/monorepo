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
function mount(node: JSX.Element): HTMLElement {
	let host = document.createElement("div");
	host.style.width = "480px";
	document.body.appendChild(host);
	render(node, { container: host });
	return host;
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
		expect(Number(getComputedStyle(rect).fillOpacity)).toBeCloseTo(0.1, 2);
		expect(band.querySelector("text")?.textContent).toBe("Incident #42");
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
		expect(hatched!.querySelector("text")?.textContent).toBe("No data");
		expect(host.querySelectorAll("pattern")).toHaveLength(1);
		expect(filled!.querySelector("rect")!.getAttribute("fill")).toBeNull();
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
