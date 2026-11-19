/**
 * The item dialogs' live half: as picks change, the add button's price follows them and the
 * quantity, an optional group stops taking picks at its limit, and a dialog closes as its
 * form posts. Without script each form still posts, and the server prices and checks it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { clientEntry } from "remix/component";

/**
 * Formats cents as dollars, as the server does.
 *
 * @example dollars(1150) // "$11.50"
 */
function dollars(cents: number): string {
	return `$${(cents / 100).toFixed(2)}`;
}

/** The item form an event came from, if it came from one. */
function itemForm(event: Event): HTMLFormElement | null {
	let target = event.target;
	if (!(target instanceof Element)) return null;
	return target.closest<HTMLFormElement>("form[data-item-form]");
}

/** Prices a form as it stands and holds each optional group to its limit. */
function update(form: HTMLFormElement) {
	let base = Number(form.dataset.base ?? "0");
	let picks = [...form.querySelectorAll<HTMLInputElement>("input[data-price]:checked")].reduce(
		(sum, input) => sum + Number(input.dataset.price ?? "0"),
		0,
	);
	let field = form.elements.namedItem("qty");
	let qty =
		field instanceof HTMLInputElement ? Math.min(Math.max(Number(field.value) || 1, 1), 20) : 1;
	for (let total of form.querySelectorAll<HTMLElement>("[data-item-total]")) {
		total.textContent = dollars((base + picks) * qty);
	}
	for (let count of form.querySelectorAll<HTMLElement>("[data-item-qty]")) {
		count.textContent = String(qty);
	}
	for (let group of form.querySelectorAll<HTMLFieldSetElement>("fieldset[data-max]")) {
		let max = Number(group.dataset.max ?? "0");
		let boxes = [...group.querySelectorAll<HTMLInputElement>("input[type=checkbox]")];
		let full = boxes.filter((box) => box.checked).length >= max;
		for (let box of boxes) box.disabled = full && !box.checked;
	}
}

/**
 * Wires every item dialog on the menu through one set of listeners on the document, so a menu
 * of any length hydrates one island.
 */
export const ItemLive = clientEntry(
	import.meta.url,
	function ItemLive(handle: Handle<Record<never, never>>) {
		handle.queueTask(() => {
			if (handle.signal.aborted) return;
			let options = { signal: handle.signal };
			for (let type of ["input", "change"]) {
				document.addEventListener(
					type,
					(event) => {
						let form = itemForm(event);
						if (form !== null) update(form);
					},
					options,
				);
			}
			document.addEventListener(
				"submit",
				(event) => {
					let form = itemForm(event);
					let dialog = form?.closest("dialog");
					if (dialog instanceof HTMLDialogElement) queueMicrotask(() => dialog.close());
				},
				options,
			);
		});

		return () => <span hidden data-item-live="" />;
	},
);
