/**
 * Holds the promo code box to its contract in a real browser: it starts folded, opens on a
 * refused code with the field described by the error, posts its hidden fields, and lists
 * applied codes each with its own remove form.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { PromoCode } from "./promo-code.js";

import "../reset.css";
import "../theme.css";

/** The words every box here carries. */
const LABELS = {
	toggle: "Have a promo code?",
	field: "Promo code",
	apply: "Apply",
	remove: "Remove",
};

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
});

describe("PromoCode", () => {
	test("starts folded with a POST form carrying the hidden fields", () => {
		mounted = render(<PromoCode action="/cart/promo" fields={{ back: "/cart" }} labels={LABELS} />);
		let details = mounted.container.querySelector("details")!;
		expect(details.open).toBe(false);
		expect(details.querySelector("summary")!.textContent).toBe("Have a promo code?");
		let form = details.querySelector("form")!;
		expect(form.method).toBe("post");
		expect(form.getAttribute("action")).toBe("/cart/promo");
		expect(new FormData(form).get("back")).toBe("/cart");
		let field = form.querySelector<HTMLInputElement>('input[name="code"]')!;
		expect(field.labels![0]!.textContent).toBe("Promo code");
		expect(field.hasAttribute("aria-invalid")).toBe(false);
	});

	test("opens on a refused code, keeping it and describing the field by the error", () => {
		mounted = render(
			<PromoCode
				action="/cart/promo"
				value="NOPE"
				error="That code has expired."
				labels={LABELS}
			/>,
		);
		let details = mounted.container.querySelector("details")!;
		expect(details.open).toBe(true);
		let field = details.querySelector<HTMLInputElement>('input[name="code"]')!;
		expect(field.value).toBe("NOPE");
		expect(field.getAttribute("aria-invalid")).toBe("true");
		let error = document.getElementById(field.getAttribute("aria-describedby")!)!;
		expect(error.textContent).toBe("That code has expired.");
	});

	test("lists each applied code with a remove button posting its own form", () => {
		mounted = render(
			<PromoCode
				action="/cart/promo"
				applied={[
					{
						code: "WALLS10",
						label: "10% off prints",
						remove: { action: "/cart/promo/remove", fields: { code: "WALLS10" } },
					},
				]}
				labels={LABELS}
			/>,
		);
		let chip = mounted.container.querySelector<HTMLElement>('[data-code="WALLS10"]')!;
		expect(chip.textContent).toBe("WALLS10 10% off prints");
		let button = chip.querySelector("button")!;
		expect(button.getAttribute("aria-label")).toBe("Remove WALLS10");
		expect(button.form!.getAttribute("action")).toBe("/cart/promo/remove");
		expect(new FormData(button.form!).get("code")).toBe("WALLS10");
		expect(mounted.container.querySelector("details")!.open).toBe(false);
	});
});
