/**
 * Holds the facet filters to their contract in a real browser: one GET form carrying the
 * kept fields and no blank ones, rows whose empty values disable unless checked, a switch posting `1`, applied
 * chips that vanish when none apply, and a form that submits itself on change once live.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { FacetFilters } from "./facet-filters.js";

import "../theme.css";

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
});

/** Mounts a filter form with every kind of row and returns it. */
function mount(): HTMLFormElement {
	mounted = render(
		<FacetFilters action="/shop" keep={{ q: "dune", sort: "new" }} labels={{ apply: "Apply" }}>
			<FacetFilters.Group title="Colour">
				<FacetFilters.Check name="colour" value="blue" label="Blue" count={12} swatch="#3b6fd8" />
				<FacetFilters.Check name="colour" value="red" label="Red" count={0} />
				<FacetFilters.Check name="colour" value="green" label="Green" count={0} checked />
			</FacetFilters.Group>
			<FacetFilters.Group title="Availability" open={false}>
				<FacetFilters.Toggle name="in_stock" label="In stock" count={84} checked />
			</FacetFilters.Group>
			<FacetFilters.Group title="Price">
				<FacetFilters.Range
					minName="min"
					maxName="max"
					min={20}
					max={null}
					prefix="$"
					labels={{ min: "Min", max: "Max" }}
					buckets={[
						{ label: "Under $25", href: "?max=25", count: 4, selected: false },
						{ label: "$25 to $50", href: "?min=25&max=50", count: 9, selected: true },
					]}
				/>
			</FacetFilters.Group>
		</FacetFilters>,
	);
	return mounted.container.querySelector("form")!;
}

/** What the form would submit, as query pairs. */
function submitted(form: HTMLFormElement): string[][] {
	return [...new FormData(form).entries()].map(([key, value]) => [key, String(value)]);
}

describe("FacetFilters", () => {
	test("is a GET form carrying the kept fields and every checked value, without blank range ends", () => {
		let form = mount();
		expect(form.getAttribute("method")).toBe("get");
		expect(form.getAttribute("action")).toBe("/shop");
		expect(submitted(form)).toEqual([
			["q", "dune"],
			["sort", "new"],
			["colour", "green"],
			["in_stock", "1"],
			["min", "20"],
		]);
	});

	test("disables an empty value unless it is checked, and mutes both", () => {
		let form = mount();
		let red = form.querySelector<HTMLInputElement>('input[value="red"]')!;
		let green = form.querySelector<HTMLInputElement>('input[value="green"]')!;
		expect(red.disabled).toBe(true);
		expect(green.disabled).toBe(false);
		expect(green.closest("label")!.hasAttribute("data-empty")).toBe(true);
		let count = form.querySelector('[data-slot="facet-filters-count"]')!;
		expect(getComputedStyle(count).fontVariantNumeric).toBe("tabular-nums");
	});

	test("opens groups by default and closes one asked to", () => {
		let form = mount();
		let groups = [...form.querySelectorAll("details")];
		expect(groups.map((group) => group.open)).toEqual([true, false, true]);
	});

	test("marks the selected price bucket", () => {
		let form = mount();
		let selected = form.querySelector('[data-slot="facet-filters-bucket"][aria-current="true"]')!;
		expect(selected.getAttribute("href")).toBe("?min=25&max=50");
	});

	test("hides Apply and submits on change once live, leaving keystrokes alone", async () => {
		let form = mount();
		let submits = 0;
		form.addEventListener("submit", (event) => {
			event.preventDefault();
			submits++;
		});
		let apply = form.querySelector<HTMLButtonElement>('[data-slot="facet-filters-apply"]')!;
		expect(apply.hidden).toBe(true);
		let blue = form.querySelector<HTMLInputElement>('input[value="blue"]')!;
		blue.click();
		expect(submits).toBe(1);
		let min = form.querySelector<HTMLInputElement>('input[name="min"]')!;
		min.value = "30";
		min.dispatchEvent(new Event("input", { bubbles: true }));
		expect(submits).toBe(1);
		min.dispatchEvent(new Event("change", { bubbles: true }));
		expect(submits).toBe(2);
	});
});

describe("FacetFilters.Applied", () => {
	test("draws each chip as a link and a Clear all link", () => {
		mounted = render(
			<FacetFilters.Applied
				label="Applied filters"
				chips={[
					{ label: "Blue", href: "/shop?colour=red" },
					{ label: "In stock", href: "/shop?colour=blue&colour=red" },
				]}
				clear={{ label: "Clear all", href: "/shop" }}
			/>,
		);
		let row = mounted.container.querySelector('[data-slot="facet-filters-applied"]')!;
		expect(row.getAttribute("aria-label")).toBe("Applied filters");
		expect([...row.querySelectorAll("a")].map((link) => link.textContent)).toEqual([
			"Blue",
			"In stock",
			"Clear all",
		]);
	});

	test("renders nothing without chips", () => {
		mounted = render(<FacetFilters.Applied label="Applied filters" chips={[]} />);
		expect(mounted.container.querySelector('[data-slot="facet-filters-applied"]')).toBeNull();
	});
});
