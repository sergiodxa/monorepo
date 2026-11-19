/**
 * Holds the item options dialog and its option groups to their contract in a real browser:
 * a menu card opens the dialog without script, a required group is radios and an optional one
 * checkboxes that stop at their limit, the add button reprices with every pick and the
 * quantity, and the dialog closes as its form posts.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type {} from "@vitest/browser-playwright";
import type { RenderResult } from "remix/component/test";

import { render } from "remix/component/test";
import { afterEach, describe, expect, test } from "vitest";

import { ItemOptionsDialog } from "./item-options-dialog.js";
import { MenuItemCard } from "./menu-item-card.js";
import { OptionGroup } from "./option-group.js";

import "../theme.css";

let mounted: RenderResult | undefined;

afterEach(() => {
	mounted?.cleanup();
	mounted = undefined;
});

/** Waits until a check passes, for an island that hydrates after mount. */
async function until(check: () => boolean, timeout = 2000): Promise<void> {
	let start = performance.now();
	while (!check()) {
		if (performance.now() - start > timeout) throw new Error("timed out");
		await new Promise((resolve) => requestAnimationFrame(resolve));
	}
}

/** Mounts a card and its dialog: a required tortilla, extras up to two, and a quantity. */
function mount(): { card: HTMLButtonElement; dialog: HTMLDialogElement; form: HTMLFormElement } {
	mounted = render(
		<div>
			<MenuItemCard
				dialog="item-tacos"
				name="Al pastor trio"
				description="Pork and pineapple."
				price="$11.50"
				media={<svg />}
			/>
			<ItemOptionsDialog
				id="item-tacos"
				action="/cart/add"
				title="Al pastor trio"
				base={1150}
				currency="USD"
				locale="en-US"
				total="$11.50"
				fields={{ item: "al-pastor" }}
				quantity={{ label: "Quantity" }}
				submitLabel={
					<>
						Add <span data-options-qty="">1</span> to cart
					</>
				}
				closeLabel="Close"
			>
				<OptionGroup
					name="tortilla"
					title="Tortilla"
					required
					requiredLabel="Required"
					choices={[
						{ value: "corn", label: "Blue corn", price: 0 },
						{ value: "flour", label: "Flour", price: 50, priceLabel: "+$0.50" },
					]}
				/>
				<OptionGroup
					name="extras"
					title="Extras"
					max={2}
					choices={[
						{ value: "guac", label: "Guacamole", price: 150 },
						{ value: "queso", label: "Queso", price: 100 },
						{ value: "onions", label: "Onions", price: 50 },
					]}
				/>
			</ItemOptionsDialog>
		</div>,
	);
	let root = mounted.container;
	return {
		card: root.querySelector<HTMLButtonElement>('[data-slot="menu-item-card"]')!,
		dialog: root.querySelector("dialog")!,
		form: root.querySelector("form")!,
	};
}

/** Ticks an input by its value. */
function pick(form: HTMLFormElement, value: string) {
	form.querySelector<HTMLInputElement>(`input[value="${value}"]`)!.click();
}

describe("ItemOptionsDialog", () => {
	test("opens from its menu card without script", () => {
		let { card, dialog } = mount();
		expect(card.getAttribute("commandfor")).toBe("item-tacos");
		card.click();
		expect(dialog.open).toBe(true);
		expect(dialog.matches(":modal")).toBe(true);
	});

	test("draws a required group as radios and an optional one as checkboxes", () => {
		let { form } = mount();
		expect(form.querySelectorAll('input[name="tortilla"][type="radio"]')).toHaveLength(2);
		expect(form.querySelectorAll('input[name="extras"][type="checkbox"]')).toHaveLength(3);
		expect(form.querySelector('input[name="tortilla"]')!.hasAttribute("required")).toBe(true);
	});

	test("reprices with every pick and the quantity, and stops extras at their limit", async () => {
		let { card, form } = mount();
		card.click();
		let total = form.querySelector("[data-options-total]")!;
		pick(form, "flour");
		await until(() => total.textContent === "$12.00");
		pick(form, "guac");
		pick(form, "queso");
		await until(() => total.textContent === "$14.50");
		let onions = form.querySelector<HTMLInputElement>('input[value="onions"]')!;
		expect(onions.disabled).toBe(true);
		let qty = form.querySelector<HTMLInputElement>("input[data-options-qty-field]")!;
		qty.value = "2";
		qty.dispatchEvent(new Event("input", { bubbles: true }));
		await until(() => total.textContent === "$29.00");
		expect(form.querySelector("[data-options-qty]")!.textContent).toBe("2");
	});

	test("posts every pick and closes as its form submits", async () => {
		let { card, dialog, form } = mount();
		card.click();
		pick(form, "corn");
		pick(form, "guac");
		let data = new FormData(form);
		expect(data.get("item")).toBe("al-pastor");
		expect(data.get("tortilla")).toBe("corn");
		expect(data.getAll("extras")).toEqual(["guac"]);
		await until(() => form.querySelector("[data-options-total]")!.textContent === "$13.00");
		form.addEventListener("submit", (event) => event.preventDefault());
		form.requestSubmit();
		await until(() => !dialog.open);
	});
});
