/**
 * Lays {@link ProductFrame} out in a real browser: the chrome gives its title and URL the room
 * they need, and a `designWidth` body keeps a desktop composition on a phone, cropped under a
 * fade or scaled down, without truncating anything inside or widening the page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";

import { render } from "remix/component/test";
import { describe, expect, test } from "vitest";

import { ProductFrame } from "./product-frame.js";

import "../reset.css";

/**
 * Mounts `node` in an inline-size container of `width` pixels attached to the document, as a
 * marketing band holds its media.
 *
 * @param node The frame to render.
 * @param width The container width in pixels.
 * @returns The host element.
 */
function mount(node: RemixNode, width: number): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	host.style.containerType = "inline-size";
	document.body.appendChild(host);
	render(node, { container: host });
	return host;
}

/**
 * A desktop dashboard row: four single-line cells that ellipsize once squeezed under 200px.
 *
 * @returns The staged sample.
 */
function dashboard(): RemixNode {
	let cell = {
		flex: "1 1 0",
		minWidth: "0",
		overflow: "hidden",
		textOverflow: "ellipsis",
		whiteSpace: "nowrap",
	};
	return (
		<div style={{ display: "flex", gap: "16px", padding: "16px" }}>
			<span style={cell}>Monthly revenue $482,190</span>
			<span style={cell}>Metered events 1.94B</span>
			<span style={cell}>Sundial Labs $4,212.36</span>
			<span style={cell}>request.completed · count</span>
		</div>
	);
}

/**
 * Lists the text-bearing elements under `root` whose content overflows their box.
 *
 * @param root The subtree to scan.
 * @returns The truncated elements' text.
 */
function truncated(root: Element): string[] {
	return [...root.querySelectorAll<HTMLElement>("*")]
		.filter((element) => element.children.length === 0 && element.textContent?.trim())
		.filter((element) => element.scrollWidth > element.clientWidth)
		.map((element) => element.textContent ?? "");
}

/**
 * The element in `host` carrying `data-slot="<slot>"`.
 *
 * @param host The mounted host.
 * @param slot The slot name.
 * @returns The slot's element.
 */
function slot(host: HTMLElement, slot: string): HTMLElement {
	return host.querySelector<HTMLElement>(`[data-slot="${slot}"]`)!;
}

describe("ProductFrame chrome", () => {
	test("shows the whole title and URL when the frame has room for both", () => {
		let host = mount(
			<ProductFrame lights title="Monitors" url="keel · Acme Cloud">
				<p>Body</p>
			</ProductFrame>,
			700,
		);

		expect(truncated(slot(host, "product-frame-chrome"))).toEqual([]);
	});

	test("ellipsizes a long URL at its cap and gives the title the rest of the bar", () => {
		let host = mount(
			<ProductFrame lights title="Monitors" url="status.example.com/very/long/path/to/a/page">
				<p>Body</p>
			</ProductFrame>,
			375,
		);
		let chrome = slot(host, "product-frame-chrome");
		let [title, url] = [...chrome.querySelectorAll<HTMLElement>(":scope > span")];

		expect(url!.scrollWidth).toBeGreaterThan(url!.clientWidth);
		expect(url!.getBoundingClientRect().width).toBeLessThan(chrome.clientWidth * 0.6);
		expect(title!.scrollWidth).toBeLessThanOrEqual(title!.clientWidth);
	});
});

describe("ProductFrame designWidth", () => {
	test("crops a desktop composition on a phone instead of truncating it", () => {
		let host = mount(
			<ProductFrame stage="backdrop" lights title="Revenue" designWidth="56rem">
				{dashboard()}
			</ProductFrame>,
			343,
		);
		let stage = slot(host, "product-frame-stage");
		let frame = slot(host, "product-frame");
		let body = slot(host, "product-frame-body");
		let canvas = slot(host, "product-frame-canvas");

		expect(canvas.getBoundingClientRect().width).toBe(56 * 16);
		expect(truncated(body)).toEqual([]);
		expect(getComputedStyle(canvas).maskImage).toContain("linear-gradient");
		expect(host.scrollWidth).toBeLessThanOrEqual(host.clientWidth);
		expect(stage.scrollWidth).toBeLessThanOrEqual(stage.clientWidth);
		expect(getComputedStyle(stage).paddingInlineStart).toBe("12px");
		expect(frame.getBoundingClientRect().width).toBe(343 - 24);
	});

	test("scales a desktop composition down to the body with fit scale", () => {
		let host = mount(
			<ProductFrame lights title="Revenue" designWidth="56rem" fit="scale">
				{dashboard()}
			</ProductFrame>,
			343,
		);
		let body = slot(host, "product-frame-body");
		let canvas = slot(host, "product-frame-canvas");

		expect(Math.round(canvas.getBoundingClientRect().width)).toBe(body.clientWidth);
		expect(truncated(body)).toEqual([]);
		expect(getComputedStyle(canvas).maskImage).toBe("none");
		expect(host.scrollWidth).toBeLessThanOrEqual(host.clientWidth);
	});

	test("fills a body wider than the design width without a fade", () => {
		let host = mount(
			<ProductFrame lights title="Revenue" designWidth="56rem">
				{dashboard()}
			</ProductFrame>,
			1200,
		);
		let body = slot(host, "product-frame-body");
		let canvas = slot(host, "product-frame-canvas");

		expect(canvas.getBoundingClientRect().width).toBe(body.clientWidth);
		expect(getComputedStyle(canvas).maskImage).toBe("none");
	});
});
