/**
 * Draws the sparkline in a real browser: it fills any row width while the stroke keeps its
 * width and the last-point dot stays round, gaps break the line, and the graphic carries the
 * trend summary as its accessible name and description.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";

import { render } from "remix/component/test";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { page } from "vitest/browser";

import { Sparkline } from "./sparkline.js";

import "../reset.css";
import "../theme.css";

const LATENCY = [180, 176, 190, 210, 205, 230, 262];

/** Mounts `node` in a host `width` pixels wide and returns the host. */
function mount(node: JSX.Element, width = 320): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
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

describe("Sparkline", () => {
	for (let width of [160, 640]) {
		test(`stretches to a ${width}px row without thickening the stroke or the dot`, () => {
			let host = mount(<Sparkline values={LATENCY} label="p95 latency, rising" />, width);
			let svg = host.querySelector("svg")!;
			let line = host.querySelector<SVGPathElement>('[data-slot="sparkline-line"]')!;
			let dot = host.querySelector<HTMLElement>('[data-slot="sparkline-dot"]')!;

			expect(svg.getBoundingClientRect().width).toBeCloseTo(width, 0);
			expect(svg.getAttribute("preserveAspectRatio")).toBe("none");
			expect(getComputedStyle(line).vectorEffect).toBe("non-scaling-stroke");
			expect(getComputedStyle(line).strokeWidth).toBe("1.5px");

			let box = dot.getBoundingClientRect();
			expect(box.width).toBeCloseTo(6, 0);
			expect(box.height).toBeCloseTo(box.width, 1);
			expect(box.left + box.width / 2).toBeCloseTo(svg.getBoundingClientRect().right, 0);
		});
	}

	test("names the graphic with the trend summary and describes it", async () => {
		mount(
			<Sparkline
				values={LATENCY}
				label="p95 latency, rising"
				description="180 ms to 262 ms over 7 days"
			/>,
		);

		let image = page.getByRole("img", { name: "p95 latency, rising" });
		await expect.element(image).toBeInTheDocument();
		await expect.element(image).toHaveAccessibleDescription("180 ms to 262 ms over 7 days");
	});

	test("breaks the line at a missing sample instead of dropping to zero", () => {
		let host = mount(<Sparkline values={[4, 5, null, 6, 7]} label="Checks" area />);

		expect(host.querySelectorAll('[data-slot="sparkline-line"]')).toHaveLength(2);
		expect(host.querySelectorAll('[data-slot="sparkline-area"]')).toHaveLength(2);
	});

	test("omits the dot when the latest sample is missing", () => {
		let host = mount(<Sparkline values={[4, 5, null]} label="Checks" />);
		expect(host.querySelector('[data-slot="sparkline-dot"]')).toBeNull();
	});

	test("sets a state word beside the line in the tone's colour", () => {
		let host = mount(
			<Sparkline values={LATENCY} label="Latency" tone="danger" state="Escalating" />,
		);
		let state = host.querySelector<HTMLElement>('[data-slot="sparkline-state"]')!;
		let plot = host.querySelector<HTMLElement>('[data-slot="sparkline-plot"]')!;

		expect(state.textContent).toBe("Escalating");
		expect(state.getBoundingClientRect().left).toBeGreaterThanOrEqual(
			plot.getBoundingClientRect().right,
		);
		let probe = document.createElement("span");
		probe.style.color = "var(--ui-danger-fg)";
		host.appendChild(probe);
		expect(getComputedStyle(state).color).toBe(getComputedStyle(probe).color);
	});
});
