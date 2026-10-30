/**
 * Lays {@link Rails} out in a real browser: the rails and corner marks show from the `md`
 * container and hide on a phone, the marks centre on the rail pixels, and copy inside the
 * rails starts where a `MarketingSection` band's copy starts.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";

import { render } from "remix/component/test";
import { describe, expect, test } from "vitest";

import { MarketingSection } from "../components/marketing-section.js";

import { Rails } from "./rails.js";

import "../reset.css";

/** Mounts `node` in a `width`-pixel column attached to the document. */
function mount(width: number, node: RemixNode): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	return render(node, { container: host }).container;
}

/** A railed band with corner marks over a plain band, as a landing stacks them. */
function stacked(): RemixNode {
	return (
		<>
			<MarketingSection>
				<p data-testid="band-copy">Band copy</p>
			</MarketingSection>
			<Rails ruled marks="corners">
				<p data-testid="rails-copy">Railed copy</p>
			</Rails>
		</>
	);
}

/** The railed column of a mounted stack. */
function column(root: HTMLElement): HTMLElement {
	return root.querySelector<HTMLElement>('[data-slot="rails-column"]')!;
}

describe("Rails", () => {
	test("hides the rails and marks on a phone and keeps the full width", () => {
		let root = mount(375, stacked());
		let railed = column(root);
		let marks = root.querySelector<HTMLElement>('[data-slot="rails-marks"]')!;

		expect(getComputedStyle(railed).borderInlineStartWidth).toBe("0px");
		expect(getComputedStyle(marks).display).toBe("none");
		expect(railed.getBoundingClientRect().width).toBe(375);
		expect(root.scrollWidth).toBeLessThanOrEqual(375);
	});

	test("draws both rails and the top rule at desktop widths", () => {
		let root = mount(1280, stacked());
		let style = getComputedStyle(column(root));

		expect(style.borderInlineStartWidth).toBe("1px");
		expect(style.borderInlineEndWidth).toBe("1px");
		expect(style.borderBlockStartWidth).toBe("1px");
		expect(root.scrollWidth).toBeLessThanOrEqual(1280);
	});

	test("lines railed copy up with a neighbouring band's copy", () => {
		for (let width of [640, 1024, 1280, 1440]) {
			let root = mount(width, stacked());
			let band = root.querySelector('[data-testid="band-copy"]')!.getBoundingClientRect();
			let railed = root.querySelector('[data-testid="rails-copy"]')!.getBoundingClientRect();

			expect(railed.left, `start at ${width}px`).toBe(band.left);
			expect(railed.right, `end at ${width}px`).toBe(band.right);
		}
	});

	test("centres each corner mark on the middle of a rail pixel", () => {
		let root = mount(1280, stacked());
		let edge = column(root).getBoundingClientRect();
		let marks = [...root.querySelectorAll<HTMLElement>('[data-slot="crosshair"]')].map((mark) =>
			mark.getBoundingClientRect(),
		);

		expect(marks).toHaveLength(4);
		let [startStart, startEnd, endStart, endEnd] = marks;
		expect(startStart!.left + startStart!.width / 2).toBe(edge.left + 0.5);
		expect(startStart!.top + startStart!.height / 2).toBe(edge.top + 0.5);
		expect(startEnd!.left + startEnd!.width / 2).toBe(edge.right - 0.5);
		expect(endStart!.top + endStart!.height / 2).toBe(edge.bottom + 0.5);
		expect(endEnd!.left + endEnd!.width / 2).toBe(edge.right - 0.5);
	});
});
