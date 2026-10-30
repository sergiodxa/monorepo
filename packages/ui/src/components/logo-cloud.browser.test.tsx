/**
 * Lays the {@link LogoCloud} wall variants out in a real browser: tiles hold each mark on
 * a tinted 3:2 cell with no short last row, the ruled grid closes its outer frame, the
 * marquee scrolls the marks, and `--logo-scale` stands one mark taller.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { LogoSentence } from "../patterns/logo-sentence.js";

import { LogoCloud } from "./logo-cloud.js";

import "../reset.css";
import "../theme.css";

/** Six square marks, each a sized inline SVG with an accessible name. */
function marks(count = 6): JSX.Element[] {
	return Array.from({ length: count }, (_, index) => (
		<svg key={index} viewBox="0 0 80 24" role="img" aria-label={`Mark ${index + 1}`}>
			<rect width="80" height="24" fill="currentColor" />
		</svg>
	));
}

/** Mounts `node` in a host `width` pixels wide, with the ink and hairline tokens the walls read, and returns the host. */
function mount(node: JSX.Element, width: number): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	host.style.setProperty("--ui-neutral-fg-emphasis", "rgb(17 17 17)");
	host.style.setProperty("--ui-marketing-hairline", "rgb(0 0 0 / 0.08)");
	document.body.appendChild(host);
	render(node, { container: host });
	return host;
}

/** The cells of a cloud, grouped into rows by their top edge. */
function rows(host: HTMLElement): DOMRect[][] {
	let cells = [...host.querySelectorAll('[data-slot="logo-cloud-marks"] > *')].map((cell) =>
		cell.getBoundingClientRect(),
	);
	let byTop = new Map<number, DOMRect[]>();
	for (let cell of cells)
		byTop.set(Math.round(cell.top), [...(byTop.get(Math.round(cell.top)) ?? []), cell]);
	return [...byTop.values()];
}

afterEach(() => {
	document.body.replaceChildren();
});

describe("LogoCloud tiles", () => {
	test("puts every mark on a tinted 3:2 tile, six to a row at 1024px", () => {
		let host = mount(<LogoCloud layout="tiles">{marks()}</LogoCloud>, 1024);
		let [row] = rows(host);
		let tile = host.querySelector<Element>('[data-slot="logo-cloud-marks"] > *')!;

		expect(row).toHaveLength(6);
		expect(row![0]!.width / row![0]!.height).toBeCloseTo(1.5, 1);
		expect(getComputedStyle(tile).backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
	});

	test("leaves no short last row for six marks on a phone", () => {
		let host = mount(<LogoCloud layout="tiles">{marks()}</LogoCloud>, 360);
		let grouped = rows(host);

		expect(grouped.map((row) => row.length)).toEqual([2, 2, 2]);
		expect(host.scrollWidth).toBeLessThanOrEqual(360);
	});
});

describe("LogoCloud ruled", () => {
	test("frames the grid with an outer hairline", () => {
		let host = mount(<LogoCloud layout="ruled">{marks()}</LogoCloud>, 1024);
		let grid = host.querySelector<HTMLElement>('[data-slot="logo-cloud-marks"]')!;

		expect(getComputedStyle(grid).boxShadow).toContain("inset");
	});
});

describe("LogoCloud marquee", () => {
	test("scrolls the marks on a doubled track at the logo height", () => {
		let host = mount(<LogoCloud layout="marquee">{marks()}</LogoCloud>, 800);
		let track = host.querySelector<HTMLElement>('[data-slot="marquee-track"]')!;
		let mark = host.querySelector<Element>('[data-slot="marquee-group"] > svg')!;

		expect(getComputedStyle(track).animationName).toBe("ui-marquee-scroll");
		expect(host.querySelectorAll('[data-slot="marquee-group"]')).toHaveLength(2);
		expect(mark.getBoundingClientRect().height).toBe(28);
	});
});

describe("--logo-scale", () => {
	test("stands one mark taller than its neighbours", () => {
		let host = mount(
			<LogoCloud>
				<svg viewBox="0 0 24 24" aria-label="Glyph" style="--logo-scale: 1.5">
					<rect width="24" height="24" />
				</svg>
				<svg viewBox="0 0 80 24" aria-label="Wordmark">
					<rect width="80" height="24" />
				</svg>
			</LogoCloud>,
			600,
		);
		let [glyph, wordmark] = host.querySelectorAll("svg");

		expect(glyph!.getBoundingClientRect().height).toBe(
			wordmark!.getBoundingClientRect().height * 1.5,
		);
	});
});

describe("LogoSentence", () => {
	test("sets marks inline at 0.8em on the text's line", () => {
		let host = mount(<LogoSentence>Trusted by {marks(1)} and 2,000 teams.</LogoSentence>, 1024);
		let sentence = host.querySelector<HTMLElement>('[data-slot="logo-sentence"]')!;
		let mark = sentence.querySelector("svg")!;
		let fontSize = parseFloat(getComputedStyle(sentence).fontSize);

		expect(fontSize).toBe(28);
		expect(mark.getBoundingClientRect().height).toBeCloseTo(fontSize * 0.8, 0);
		expect(sentence.getClientRects()).toHaveLength(1);
	});
});
