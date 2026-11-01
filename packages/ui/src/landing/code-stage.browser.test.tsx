/**
 * Lays {@link CodeStage} out in a real browser: tab indentation beside numbered lines,
 * gutter contrast and alignment, the 40px title row on the code's column, token colors,
 * long lines scrolling inside the panel, radio file tabs, and its height beside taller copy.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { CodeStage } from "./code-stage.js";

import "../theme.css";

/** Every surface the stage draws. */
const VARIANTS: CodeStage.Variant[] = ["code", "terminal", "slab"];

/** Hosts mounted by a test, removed after it so layout never leaks between cases. */
let hosts: HTMLElement[] = [];

afterEach(() => {
	for (let host of hosts) host.remove();
	hosts = [];
});

/** Mounts `node` in a column `width` pixels wide, dark when `dark` is set. */
function mount(node: RemixNode, width = 720, dark = false): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	if (dark) {
		host.className = "dark";
		host.style.colorScheme = "dark";
	}
	document.body.appendChild(host);
	hosts.push(host);
	return render(node, { container: host }).container;
}

/** The stage element inside a mounted root. */
function stage(root: HTMLElement): HTMLElement {
	return root.querySelector<HTMLElement>('[data-slot="code-stage"]')!;
}

/** Left edge of the glyph at `offset` in the first text node under `element`. */
function glyphLeft(element: Element, offset: number): number {
	let walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
	let node = walker.nextNode()!;
	let range = document.createRange();
	range.setStart(node, offset);
	range.setEnd(node, offset + 1);
	return range.getBoundingClientRect().left;
}

/** Left edge of the first non-whitespace glyph anywhere under `element`. */
function inkLeft(element: Element): number {
	let walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
	for (let node = walker.nextNode(); node; node = walker.nextNode()) {
		let offset = node.textContent!.search(/\S/);
		if (offset < 0) continue;
		let range = document.createRange();
		range.setStart(node, offset);
		range.setEnd(node, offset + 1);
		return range.getBoundingClientRect().left;
	}
	return Number.NaN;
}

/** Width of one glyph of the first text node under `element`. */
function glyphWidth(element: Element): number {
	let walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
	let node = walker.nextNode()!;
	let range = document.createRange();
	range.setStart(node, 0);
	range.setEnd(node, 1);
	return range.getBoundingClientRect().width;
}

/** The sRGB channels left after painting `layers` bottom to top on a one-pixel canvas. */
function composite(layers: string[]): [number, number, number] {
	let canvas = document.createElement("canvas");
	canvas.width = 1;
	canvas.height = 1;
	let context = canvas.getContext("2d")!;
	context.fillStyle = "white";
	context.fillRect(0, 0, 1, 1);
	for (let layer of layers) {
		context.fillStyle = layer;
		context.fillRect(0, 0, 1, 1);
	}
	let [r, g, b] = context.getImageData(0, 0, 1, 1).data;
	return [r!, g!, b!];
}

/** WCAG relative luminance of an sRGB color. */
function luminance([r, g, b]: [number, number, number]): number {
	let [lr, lg, lb] = [r, g, b].map((channel) => {
		let c = channel / 255;
		return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * lr! + 0.7152 * lg! + 0.0722 * lb!;
}

/** WCAG contrast ratio between two painted colors. */
function contrast(a: [number, number, number], b: [number, number, number]): number {
	let [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (high! + 0.05) / (low! + 0.05);
}

/** Twelve lines, so the gutter has to hold a two-digit number. */
const TWELVE_LINES = Array.from({ length: 12 }, (_, index) => `line ${index + 1}`).join("\n");

describe("CodeStage in a browser", () => {
	test("indents a tab-led numbered line a full tab width from the code column", () => {
		let source = "if (ready) {\n\tstart();\n}";
		let root = mount(<CodeStage lineNumbers>{source}</CodeStage>);
		let [first, second] = [...root.querySelectorAll("[data-code]")];
		let indent = glyphLeft(second!, 1) - glyphLeft(first!, 0);

		expect(indent).toBeCloseTo(glyphWidth(first!) * 4, 0);
		expect(root.querySelector("pre")!.textContent).toBe(source);
		expect(root.querySelector("pre")!.innerText).toBe(source);
	});

	test("indents a tab-led highlighted line the same way", () => {
		let root = mount(
			<CodeStage language="ts" lineNumbers>
				{"let a = {\n\tb: 1,\n};"}
			</CodeStage>,
		);
		let [first, second] = [...root.querySelectorAll("[data-code]")];

		expect(second!.querySelector(".token")).not.toBeNull();
		expect(inkLeft(second!) - inkLeft(first!)).toBeCloseTo(glyphWidth(first!) * 4, 0);
	});

	for (let dark of [false, true]) {
		for (let variant of VARIANTS) {
			test(`draws gutter numbers at 4.5:1 behind a hairline on ${variant} (${dark ? "dark" : "light"})`, () => {
				let root = mount(
					<CodeStage variant={variant} lineNumbers>
						{TWELVE_LINES}
					</CodeStage>,
					720,
					dark,
				);
				let host = stage(root);
				let pre = root.querySelector("pre")!;
				let lines = [...root.querySelectorAll("[data-line]")];
				let number = getComputedStyle(lines[0]!, "::before");
				let panel = [
					getComputedStyle(host.parentElement!).backgroundColor,
					getComputedStyle(host).backgroundColor,
					getComputedStyle(pre).backgroundColor,
				];

				expect(
					contrast(composite([...panel, number.color]), composite(panel)),
				).toBeGreaterThanOrEqual(4.5);
				expect(number.borderInlineEndStyle).toBe("solid");
				expect(number.borderInlineEndWidth).toBe("1px");
				expect(Number.parseFloat(number.paddingInlineEnd)).toBeGreaterThanOrEqual(6);
				expect(number.textAlign).toBe("end");
				expect(getComputedStyle(lines[11]!, "::before").width).toBe(number.width);
			});
		}
	}

	for (let variant of VARIANTS) {
		test(`centres a 12px title in a 40px header on the code column (${variant})`, () => {
			let root = mount(
				<>
					<CodeStage variant={variant} title="track-usage.ts">
						{"let plain = true;"}
					</CodeStage>
					<CodeStage variant={variant} title="track-usage.ts" lineNumbers>
						{TWELVE_LINES}
					</CodeStage>
				</>,
			);
			let [plain, numbered] = [...root.querySelectorAll<HTMLElement>('[data-slot="code-stage"]')];

			for (let element of [plain!, numbered!]) {
				let header = element
					.querySelector('[data-slot="code-stage-header"]')!
					.getBoundingClientRect();
				let title = element.querySelector('[data-slot="code-stage-title"]')!;
				let box = title.getBoundingClientRect();

				expect(header.height).toBe(40);
				expect(Math.abs(box.top + box.height / 2 - (header.top + header.height / 2))).toBeLessThan(
					1.5,
				);
				expect(getComputedStyle(title).fontSize).toBe("12px");
				expect(getComputedStyle(element.querySelector("pre")!).fontSize).toBe("13px");
			}

			let plainCode = plain!.querySelector("pre")!;
			expect(
				Math.abs(
					glyphLeft(plainCode, 0) -
						glyphLeft(plain!.querySelector('[data-slot="code-stage-title"]')!, 0),
				),
			).toBeLessThan(1);
			let numberedCode = numbered!.querySelector("[data-code]")!;
			expect(
				Math.abs(
					glyphLeft(numberedCode, 0) -
						glyphLeft(numbered!.querySelector('[data-slot="code-stage-title"]')!, 0),
				),
			).toBeLessThan(1);
		});
	}

	test("colors tokens without the highlight stylesheet, dark palette on a slab", () => {
		let root = mount(
			<>
				<CodeStage language="ts">{"let a = 1;"}</CodeStage>
				<CodeStage variant="slab" language="ts">
					{"let a = 1;"}
				</CodeStage>
			</>,
		);
		let [card, slab] = [...root.querySelectorAll(".token.keyword")];

		expect(getComputedStyle(card!).color).toBe("rgb(215, 58, 73)");
		expect(getComputedStyle(slab!).color).toBe("rgb(255, 123, 114)");
	});

	test("scrolls a long line inside the panel at 375px, never the page", () => {
		let root = mount(
			<CodeStage title="long.ts" lineNumbers>
				{`let url = "${"https://api.example.com/".repeat(8)}";`}
			</CodeStage>,
			375,
		);
		let host = stage(root);
		let pre = host.querySelector("pre")!;

		expect(host.scrollWidth).toBeLessThanOrEqual(375);
		expect(host.getBoundingClientRect().width).toBeLessThanOrEqual(375);
		expect(pre.scrollWidth).toBeGreaterThan(pre.clientWidth);
	});

	test("keeps a long line inside a grid column at 375px", () => {
		let root = mount(
			<div style={{ display: "grid", gridTemplateColumns: "1fr" }}>
				<CodeStage>{`let url = "${"https://api.example.com/".repeat(8)}";`}</CodeStage>
			</div>,
			375,
		);

		expect(stage(root).getBoundingClientRect().width).toBeLessThanOrEqual(375);
	});

	test("switches file tabs through the radio group without changing height", async () => {
		let root = mount(
			<CodeStage
				name="files"
				lineNumbers
				tabs={[
					{ label: "worker.ts", content: "export default {\n\tfetch() {},\n};", language: "ts" },
					{ label: "wrangler.jsonc", content: '{ "name": "app" }', language: "jsonc" },
				]}
			/>,
		);
		let host = stage(root);
		let [first, second] = [...host.querySelectorAll<HTMLElement>('[data-slot="code-stage-panel"]')];
		let [firstTab, secondTab] = [
			...host.querySelectorAll<HTMLElement>('[data-slot="code-stage-tab"]'),
		];
		let height = host.getBoundingClientRect().height;

		expect(getComputedStyle(first!).visibility).toBe("visible");
		expect(getComputedStyle(second!).visibility).toBe("hidden");
		expect(getComputedStyle(firstTab!).fontSize).toBe("14px");
		expect(getComputedStyle(firstTab!).backgroundColor).not.toBe(
			getComputedStyle(secondTab!).backgroundColor,
		);
		expect(
			host.querySelector('[data-slot="code-stage-header"]')!.getBoundingClientRect().height,
		).toBe(40);

		secondTab!.click();
		await new Promise((resolve) => requestAnimationFrame(resolve));

		expect(getComputedStyle(first!).visibility).toBe("hidden");
		expect(getComputedStyle(second!).visibility).toBe("visible");
		expect(host.getBoundingClientRect().height).toBe(height);
		expect(first!.getBoundingClientRect().top).toBe(second!.getBoundingClientRect().top);
	});

	test("takes its content's height at the top of a taller split row", () => {
		let root = mount(
			<div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
				<div style={{ height: "600px" }}>Copy</div>
				<CodeStage title="short.ts">{"let a = 1;"}</CodeStage>
			</div>,
			900,
		);
		let host = stage(root).getBoundingClientRect();
		let copy = root.querySelector("div > div")!.getBoundingClientRect();

		expect(host.height).toBeLessThan(200);
		expect(host.top).toBe(copy.top);
	});
});
