/**
 * Holds the quantity stepper to its contract in a real browser: each button posts the next
 * count with the hidden fields, − becomes a bin that posts zero at one, and + stops at `max`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { QuantityStepper } from "./quantity-stepper.js";

import "../theme.css";

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
});

/** The labels every stepper here uses. */
const LABELS: QuantityStepper.Labels = {
	fewer: "One fewer taco",
	more: "One more taco",
	remove: "Remove taco",
	count: "Tacos",
};

/** Mounts a stepper and returns its form. */
function mount(value: number, max?: number): HTMLFormElement {
	mounted = render(
		<QuantityStepper
			action="/cart/line"
			value={value}
			max={max}
			fields={{ line: "2" }}
			labels={LABELS}
		/>,
	);
	return mounted.container.querySelector("form")!;
}

/** What a button would post: the form's fields plus its own name and value. */
function posted(form: HTMLFormElement, slot: string): Record<string, string> {
	let button = form.querySelector<HTMLButtonElement>(`[data-slot="${slot}"]`)!;
	let data = new FormData(form, button);
	return Object.fromEntries([...data.entries()].map(([key, value]) => [key, String(value)]));
}

describe("QuantityStepper", () => {
	test("posts one fewer and one more with its hidden fields", () => {
		let form = mount(3);
		expect(form.getAttribute("method")).toBe("post");
		expect(posted(form, "quantity-stepper-fewer")).toEqual({ line: "2", qty: "2" });
		expect(posted(form, "quantity-stepper-more")).toEqual({ line: "2", qty: "4" });
		expect(form.querySelector("output")!.textContent).toBe("3");
	});

	test("turns − into a bin that posts zero at a count of one", () => {
		let form = mount(1);
		let fewer = form.querySelector('[data-slot="quantity-stepper-fewer"]')!;
		expect(fewer.getAttribute("aria-label")).toBe("Remove taco");
		expect(posted(form, "quantity-stepper-fewer").qty).toBe("0");
	});

	test("stops + at its max", () => {
		let form = mount(5, 5);
		let more = form.querySelector<HTMLButtonElement>('[data-slot="quantity-stepper-more"]')!;
		expect(more.disabled).toBe(true);
	});
});
