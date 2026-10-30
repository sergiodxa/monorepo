/**
 * Lays a stat strip out inside a centring band in a real browser, where a label's
 * wrapped lines only land on the figure's edge if the cell sets its own alignment,
 * and checks the display figure step and its tabular digits.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";

import { render } from "remix/component/test";
import { describe, expect, test } from "vitest";

import { StatStrip } from "./stat-strip.js";

/** Mounts a node in a `text-align: center` column of the given width, as a centred band does. */
function mountCentred(width: number, node: RemixNode): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	host.style.textAlign = "center";
	document.body.appendChild(host);
	return render(node, { container: host }).container;
}

/** A one-line label and a label long enough to wrap inside its cell. */
function strip(align?: StatStrip.Align): RemixNode {
	return (
		<StatStrip align={align}>
			<StatStrip.Item label="Uptime">99.99%</StatStrip.Item>
			<StatStrip.Item label="Usage events metered for every customer each month">
				41B
			</StatStrip.Item>
		</StatStrip>
	);
}

/** The figure's box and the boxes of every line of the label's text. */
function measure(item: Element) {
	let figure = item.querySelector('[data-slot="stat-strip-figure"]')!;
	let label = item.lastElementChild!;
	let range = document.createRange();
	range.selectNodeContents(label);
	return { figure: figure.getBoundingClientRect(), lines: [...range.getClientRects()] };
}

/** Every cell of the strip, in source order. */
function items(root: HTMLElement): Element[] {
	return [...root.querySelectorAll('[data-slot="stat-strip-item"]')];
}

describe("StatStrip alignment", () => {
	test("starts every label line at the figure's left edge inside a centred band", () => {
		let root = mountCentred(360, strip());
		let [short, wrapping] = items(root).map(measure);

		expect(wrapping!.lines.length).toBeGreaterThan(1);
		for (let cell of [short!, wrapping!]) {
			for (let line of cell.lines) expect(Math.abs(line.left - cell.figure.left)).toBeLessThan(1);
		}
	});

	test("centres the figure and every label line on one axis with align center", () => {
		let root = mountCentred(360, strip("center"));

		for (let cell of items(root).map(measure)) {
			let figureCentre = cell.figure.left + cell.figure.width / 2;
			for (let line of cell.lines) {
				expect(Math.abs(line.left + line.width / 2 - figureCentre)).toBeLessThan(1);
			}
		}
	});
});

describe("StatStrip figures", () => {
	test("draws every figure in tabular digits", () => {
		let root = mountCentred(360, strip());

		for (let item of items(root)) {
			let figure = item.querySelector('[data-slot="stat-strip-figure"]')!;
			expect(getComputedStyle(figure).fontVariantNumeric).toContain("tabular-nums");
		}
	});

	test("grows the display figure with the strip between 2.5rem and 4.5rem", () => {
		let display = (
			<StatStrip size="display">
				<StatStrip.Item label="Uptime">99.99%</StatStrip.Item>
			</StatStrip>
		);
		let size = (width: number) => {
			let figure = mountCentred(width, display).querySelector('[data-slot="stat-strip-figure"]')!;
			return Number.parseFloat(getComputedStyle(figure).fontSize);
		};

		expect(size(320)).toBe(40);
		expect(size(1400)).toBe(72);
		expect(size(800)).toBeGreaterThan(40);
		expect(size(800)).toBeLessThan(72);
	});
});
