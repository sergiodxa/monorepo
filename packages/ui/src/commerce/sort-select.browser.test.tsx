/**
 * Holds the sort select to its contract in a real browser: a labelled native select showing
 * the current order, which submits the form it names on change and hides its no-script button.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { SortSelect } from "./sort-select.js";

import "../theme.css";

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
});

/** The orders a listing offers. */
const OPTIONS = [
	{ value: "new", label: "Newest" },
	{ value: "price", label: "Price: low to high" },
];

describe("SortSelect", () => {
	test("labels a native select set to the current order", () => {
		mounted = render(<SortSelect name="sort" value="price" label="Sort by" options={OPTIONS} />);
		let select = mounted.container.querySelector("select")!;
		expect(select.name).toBe("sort");
		expect(select.value).toBe("price");
		expect(select.labels[0]!.textContent).toBe("Sort by");
	});

	test("submits the form it names from outside it", async () => {
		mounted = render(
			<div>
				<form id="filters" method="get" action="/shop" />
				<SortSelect form="filters" name="sort" value="new" label="Sort by" options={OPTIONS} />
			</div>,
		);
		let form = mounted.container.querySelector("form")!;
		let fields: string[][] = [];
		form.addEventListener("submit", (event) => {
			event.preventDefault();
			fields = [...new FormData(form).entries()].map(([key, value]) => [key, String(value)]);
		});
		let button = mounted.container.querySelector<HTMLButtonElement>(
			'[data-slot="sort-select-submit"]',
		)!;
		expect(button.hidden).toBe(true);
		let select = mounted.container.querySelector("select")!;
		select.value = "price";
		select.dispatchEvent(new Event("change", { bubbles: true }));
		expect(fields).toEqual([["sort", "price"]]);
	});
});
