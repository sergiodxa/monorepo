/**
 * Checkout's live summary: as the visitor picks a tip or priority delivery, the summary's
 * rows and the Place order button reprice at once. Without script the summary shows the
 * defaults, and the server prices exactly what the form posts.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { clientEntry } from "remix/component";

namespace CheckoutLive {
	export interface Props {
		/** The checkout form's id. */
		form: string;
	}
}

/**
 * Formats cents as dollars, as the server does.
 *
 * @example dollars(1150) // "$11.50"
 */
function dollars(cents: number): string {
	return `$${(cents / 100).toFixed(2)}`;
}

/** Reprices the summary for the form's tip and speed. */
function reprice(form: HTMLFormElement) {
	let read = (name: string) => Number(form.dataset[name] ?? "0");
	let subtotal = read("subtotal");
	let data = new FormData(form);
	let tipPercent = Number(data.get("tip") ?? "0");
	let tip = Math.round((subtotal * tipPercent) / 100);
	let priority = data.get("speed") === "priority" ? read("priorityFee") : 0;
	let total = subtotal + read("delivery") + read("service") + priority + tip;
	let set = (selector: string, text: string) => {
		for (let node of form.querySelectorAll<HTMLElement>(selector)) node.textContent = text;
	};
	set('[data-sum="tip"]', dollars(tip));
	set("[data-sum-tip-percent]", `(${tipPercent}%)`);
	set('[data-sum="priority"]', dollars(priority));
	set('[data-sum="total"]', dollars(total));
	set("[data-place-total]", dollars(total));
	for (let row of form.querySelectorAll<HTMLElement>('[data-sum-row="priority"]'))
		row.hidden = priority === 0;
}

/** Listens to the checkout form and reprices its summary on every change. */
export const CheckoutLive = clientEntry(
	import.meta.url,
	function CheckoutLive(handle: Handle<CheckoutLive.Props>) {
		handle.queueTask(() => {
			let form = document.getElementById(handle.props.form);
			if (!(form instanceof HTMLFormElement) || handle.signal.aborted) return;
			let target = form;
			target.addEventListener("change", () => reprice(target), { signal: handle.signal });
			reprice(target);
		});
		return () => <span hidden data-checkout-live="" />;
	},
);
