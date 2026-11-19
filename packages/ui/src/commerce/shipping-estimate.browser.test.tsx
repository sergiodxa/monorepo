/**
 * Holds the shipping estimate to its contract in a real browser: a GET form keeping its
 * hidden fields and the postcode, an error describing the field, and options with their
 * prices lined up at the end.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { ShippingEstimate } from "./shipping-estimate.js";

import "../reset.css";
import "../theme.css";

/** The words every estimate here carries. */
const LABELS = { field: "Postcode", submit: "Estimate", heading: "Estimate shipping" };

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
});

describe("ShippingEstimate", () => {
	test("reads back the postcode through a GET form and lists each option", () => {
		mounted = render(
			<div style={{ inlineSize: "24rem" }}>
				<ShippingEstimate
					action="/cart"
					value="SW1A 1AA"
					fields={{ country: "GB" }}
					options={[
						{ id: "std", label: "Standard", arrives: "Arrives Tue 24 Nov", price: "£4.95" },
						{ id: "exp", label: "Express courier", arrives: "Arrives tomorrow", price: "£12.00" },
					]}
					labels={LABELS}
				/>
			</div>,
		);
		let group = mounted.container.querySelector<HTMLElement>('[role="group"]')!;
		expect(document.getElementById(group.getAttribute("aria-labelledby")!)!.textContent).toBe(
			"Estimate shipping",
		);
		let form = group.querySelector("form")!;
		expect(form.method).toBe("get");
		let data = new FormData(form);
		expect(data.get("country")).toBe("GB");
		expect(data.get("postcode")).toBe("SW1A 1AA");
		let rows = [...group.querySelectorAll<HTMLElement>("li[data-option]")];
		expect(rows.map((row) => row.textContent)).toEqual([
			"StandardArrives Tue 24 Nov£4.95",
			"Express courierArrives tomorrow£12.00",
		]);
		let prices = rows.map(
			(row) =>
				row.querySelector('[data-slot="shipping-estimate-price"]')!.getBoundingClientRect().right,
		);
		expect(Math.round(prices[0]!)).toBe(Math.round(prices[1]!));
		expect(Math.round(prices[0]!)).toBe(Math.round(rows[0]!.getBoundingClientRect().right));
	});

	test("describes the field by the error and lists no options", () => {
		mounted = render(
			<ShippingEstimate
				action="/cart"
				value="ZZZ"
				error="We can't find that postcode."
				labels={LABELS}
			/>,
		);
		let field = mounted.container.querySelector<HTMLInputElement>('input[name="postcode"]')!;
		expect(field.getAttribute("aria-invalid")).toBe("true");
		expect(document.getElementById(field.getAttribute("aria-describedby")!)!.textContent).toBe(
			"We can't find that postcode.",
		);
		expect(mounted.container.querySelector("ul")).toBeNull();
	});
});
