/**
 * Holds the price to its contract in a real browser: the amount in its currency, a saving
 * rounded down beside the struck-through earlier price, "From", and the first instalment share.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { Price } from "./price.js";

import "../theme.css";

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
});

/** Mounts a price and returns its host. */
function mount(element: JSX.Element): HTMLElement {
	mounted = render(element);
	return mounted.container.querySelector<HTMLElement>('[data-slot="price"]')!;
}

describe("Price", () => {
	test("writes the amount alone in a paragraph", () => {
		let price = mount(<Price amount={4500} currency="USD" />);
		expect(price.tagName).toBe("P");
		expect(price.textContent).toBe("$45.00");
		expect(price.querySelector("s")).toBeNull();
	});

	test("strikes the earlier price with a hidden 'was' and rounds the saving down", () => {
		let price = mount(<Price amount={4500} currency="USD" compareAt={6100} />);
		let was = price.querySelector("s")!;
		expect(was.textContent).toBe("Was $61.00");
		expect(was.querySelector("span")!.getBoundingClientRect().width).toBeLessThanOrEqual(1);
		expect(price.querySelector('[data-slot="price-save"]')!.textContent).toBe("Save 26%");
	});

	test("ignores a compare-at price at or below the amount", () => {
		let price = mount(<Price amount={4500} currency="USD" compareAt={4500} />);
		expect(price.querySelector("s")).toBeNull();
		expect(price.querySelector('[data-slot="price-save"]')).toBeNull();
	});

	test("leads with From and splits instalments through allocate", () => {
		let price = mount(
			<Price
				amount={1000}
				currency="USD"
				from
				installments={3}
				inline
				labels={{ from: "Desde" }}
			/>,
		);
		expect(price.tagName).toBe("SPAN");
		expect(price.querySelector('[data-slot="price-current"]')!.textContent).toBe("Desde $10.00");
		expect(price.querySelector('[data-slot="price-installments"]')!.textContent).toBe(
			"or 3 × $3.34",
		);
	});

	test("sets the large size bigger than the small one", () => {
		let large = mount(<Price amount={100} currency="EUR" size="lg" />);
		let largeSize = parseFloat(
			getComputedStyle(large.querySelector('[data-slot="price-current"]')!).fontSize,
		);
		mounted?.cleanup();
		let small = mount(<Price amount={100} currency="EUR" size="sm" />);
		let smallSize = parseFloat(
			getComputedStyle(small.querySelector('[data-slot="price-current"]')!).fontSize,
		);
		expect(largeSize).toBeGreaterThan(smallSize);
	});
});
