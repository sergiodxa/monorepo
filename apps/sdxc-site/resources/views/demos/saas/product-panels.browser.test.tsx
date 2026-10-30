/**
 * Lays Keel's product screens out in a real browser at a phone's frame width: every meter
 * identifier and customer name shows in full, and the columns of the meter list and the
 * invoice table line up from row to row at a desktop width.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { MetersPanel } from "~/resources/views/demos/saas/product-panels";
import { RevenueBoard } from "~/resources/views/demos/saas/revenue-board";

import "@sdxc/ui/reset.css";
import "@sdxc/ui/theme.css";

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
});

/** Mounts `node` in a `width`-pixel column and returns that column. */
function mount(width: number, node: RemixNode): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	mounted = render(node, { container: host });
	return host;
}

/** Every leaf element whose text is cut, by an ellipsis or by its own box. */
function clipped(root: HTMLElement): string[] {
	return [...root.querySelectorAll<HTMLElement>("span")]
		.filter((element) => element.children.length === 0 && element.textContent?.trim())
		.filter((element) => element.scrollWidth > element.clientWidth + 1)
		.map((element) => element.textContent ?? "");
}

describe("Keel product screens", () => {
	test("show every meter identifier and customer name in full on a phone", () => {
		let meters = mount(343, <MetersPanel />);
		expect(meters.textContent).toContain("request.completed · count");
		expect(clipped(meters)).toEqual([]);

		let board = mount(343, <RevenueBoard />);
		expect(board.textContent).toContain("Sundial Labs");
		expect(clipped(board)).toEqual([]);
	});

	test("line the meter sparklines and the invoice amounts up from row to row", () => {
		let meters = mount(640, <MetersPanel />);
		let sparklines = [...meters.querySelectorAll("li svg")].map(
			(svg) => svg.getBoundingClientRect().left,
		);
		expect(sparklines).toHaveLength(4);
		expect(new Set(sparklines).size).toBe(1);

		let board = mount(960, <RevenueBoard />);
		let amounts = [...board.querySelectorAll<HTMLElement>("span")]
			.filter((element) => /^\$[\d,]+\.\d\d$/.test(element.textContent ?? ""))
			.map((element) => element.getBoundingClientRect().right);
		expect(amounts).toHaveLength(4);
		expect(new Set(amounts).size).toBe(1);
	});
});
