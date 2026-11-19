/**
 * Renders `PriceBreakdown` in a real browser: named amounts are outputs a form finds by
 * name, a discount is signed and set apart in colour, amounts line up at the end, and the
 * receipt fits a 320px column without overflowing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { PriceBreakdown } from "./price-breakdown.js";

import "../reset.css";
import "@sdxc/u/theme.css";
import "../theme.css";

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
	document.body.replaceChildren();
});

/** Mounts a cabin stay's receipt inside a form `width` pixels wide and returns the form. */
function mount(width: number): HTMLFormElement {
	let host = document.createElement("div");
	host.style.width = `${width}px`;
	document.body.appendChild(host);
	mounted = render(
		<form>
			<PriceBreakdown note="You won't be charged yet">
				<PriceBreakdown.Line
					label="4 nights"
					detail="$182 × 4 nights"
					amount="$728.00"
					name="nights"
					line="nights"
				/>
				<PriceBreakdown.Line label="Cleaning fee" amount="$45.00" line="cleaning" />
				<PriceBreakdown.Line
					label="Weekly stay discount"
					amount="$72.80"
					tone="discount"
					line="discount"
				/>
				<PriceBreakdown.Total label="Total (USD)" amount="$700.20" name="total" />
			</PriceBreakdown>
		</form>,
		{ container: host },
	);
	return host.querySelector("form")!;
}

describe("PriceBreakdown", () => {
	test("pairs each label with its amount in a description list", () => {
		let form = mount(400);
		let terms = [...form.querySelectorAll("dl > div > dt")].map(
			(term) => term.firstChild?.textContent,
		);
		let amounts = [...form.querySelectorAll("dl > div > dd")].map((amount) => amount.textContent);
		expect(terms).toEqual(["4 nights", "Cleaning fee", "Weekly stay discount", "Total (USD)"]);
		expect(amounts).toEqual(["$728.00", "$45.00", "−$72.80", "$700.20"]);
		expect(form.querySelector("[data-slot=price-breakdown-note]")?.closest("dl")).toBeNull();
	});

	test("puts named amounts in outputs a script can update by name", () => {
		let form = mount(400);
		let total = form.elements.namedItem("total");
		expect(total).toBeInstanceOf(HTMLOutputElement);
		(total as HTMLOutputElement).value = "$655.20";
		expect(form.querySelector("[data-slot=price-breakdown-total] dd")?.textContent).toBe("$655.20");
		expect(form.elements.namedItem("nights")).toBeInstanceOf(HTMLOutputElement);
		expect(form.querySelector("[data-line=cleaning] output")).toBeNull();
	});

	test("signs a discount once and sets it apart in the success tone", () => {
		let form = mount(400);
		let root = document.documentElement.style;
		root.setProperty("--ui-color-success-600", "rgb(0, 128, 0)");
		root.setProperty("--ui-color-neutral-900", "rgb(20, 20, 20)");
		let discount = form.querySelector<HTMLElement>("[data-line=discount]")!;
		let plain = form.querySelector<HTMLElement>("[data-line=cleaning]")!;
		expect(discount.dataset.tone).toBe("discount");
		expect(getComputedStyle(discount).color).toBe("rgb(0, 128, 0)");
		expect(getComputedStyle(plain).color).toBe("rgb(20, 20, 20)");
		root.removeProperty("--ui-color-success-600");
		root.removeProperty("--ui-color-neutral-900");
	});

	test("aligns amounts at the end in tabular figures, bold for the total", () => {
		let form = mount(400);
		let amounts = [...form.querySelectorAll("dl > div > dd")];
		let ends = new Set(amounts.map((amount) => Math.round(amount.getBoundingClientRect().right)));
		expect(ends.size).toBe(1);
		expect(getComputedStyle(amounts[0]!).fontVariantNumeric).toContain("tabular-nums");
		let total = form.querySelector("[data-slot=price-breakdown-total]")!;
		expect(Number(getComputedStyle(total).fontWeight)).toBeGreaterThanOrEqual(600);
		expect(getComputedStyle(total).borderTopWidth).toBe("1px");
	});

	test("fits a 320px column without overflowing", () => {
		let form = mount(320);
		let receipt = form.querySelector<HTMLElement>("[data-slot=price-breakdown]")!;
		expect(receipt.scrollWidth).toBeLessThanOrEqual(320);
		for (let line of receipt.querySelectorAll("dl > div")) {
			expect(line.getBoundingClientRect().right).toBeLessThanOrEqual(
				receipt.getBoundingClientRect().right + 0.5,
			);
		}
	});
});
