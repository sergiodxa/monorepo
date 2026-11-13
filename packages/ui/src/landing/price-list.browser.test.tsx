/**
 * Lays a price list out in a real browser: the price keeps its own line end however long the
 * name grows, the leader fills the gap between them, and the groups fold into one column once
 * the list is narrower than two of them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";

import { render } from "remix/component/test";
import { describe, expect, test } from "vitest";

import { PriceList } from "./price-list.js";

/** Mounts a node in a column of the given width. */
function mount(width: number, node: RemixNode): HTMLElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	return render(node, { container: host }).container;
}

/** Two groups, one item with a name long enough to wrap in a phone column. */
function menu(): RemixNode {
	return (
		<PriceList>
			<PriceList.Group title="Bread" description="From 7 am">
				<PriceList.Item name="Country sourdough" price="$9.00">
					Two-day ferment
				</PriceList.Item>
				<PriceList.Item name="Seeded rye with sunflower, pumpkin and flax seeds" price="$11.50" />
			</PriceList.Group>
			<PriceList.Group title="Pastry">
				<PriceList.Item name="Butter croissant" price="$4.25" />
			</PriceList.Group>
		</PriceList>
	);
}

describe("PriceList layout", () => {
	test("keeps every price on one line at the row's end, with the leader between", () => {
		let root = mount(300, menu());
		for (let item of root.querySelectorAll('[data-slot="price-list-item"]')) {
			let row = item.firstElementChild!.getBoundingClientRect();
			let price = item.querySelector('[data-slot="price-list-price"]')!;
			let leader = item.querySelector('[data-slot="price-list-leader"]')!.getBoundingClientRect();
			let box = price.getBoundingClientRect();
			let range = document.createRange();
			range.selectNodeContents(price);

			expect(range.getClientRects()).toHaveLength(1);
			expect(Math.abs(box.right - row.right)).toBeLessThan(1);
			expect(leader.width).toBeGreaterThan(0);
		}
	});

	test("puts groups side by side when two fit, and stacks them when they do not", () => {
		let wide = mount(800, menu());
		let [first, second] = wide.querySelectorAll('[data-slot="price-list-group"]');
		expect(second!.getBoundingClientRect().top).toBe(first!.getBoundingClientRect().top);

		let narrow = mount(360, menu());
		let [top, bottom] = narrow.querySelectorAll('[data-slot="price-list-group"]');
		expect(bottom!.getBoundingClientRect().top).toBeGreaterThan(
			top!.getBoundingClientRect().bottom,
		);
	});
});
