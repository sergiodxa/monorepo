/**
 * Why JS: HTML has no select-all checkbox, no indeterminate state outside script and no
 * shift-click range. No-JS baseline: every row checkbox still toggles and submits with its
 * form, and a checked row is tinted by CSS alone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ElementProps, MixinFactory } from "remix/component";

import { createMixin } from "remix/component";

/** Selector for a per-row checkbox, the contract any selectable list renders. */
export const SELECTION_ITEM_SELECTOR = "input[type=checkbox][data-selection-item]";

/** Selector for the checkbox that selects or clears every row at once. */
export const SELECTION_ALL_SELECTOR = "input[type=checkbox][data-selection-all]";

/**
 * Keeps a table's selection checkboxes consistent: select-all checks or clears every enabled
 * row, mirrors the rows as checked, indeterminate or clear, and a shift-click checks or clears
 * every row between the last clicked one and this one. Each row it changes fires a bubbling
 * `change`, as a click would, so a selection bar counting `[data-selection-item]:checked`
 * hears every change; each row's `<tr>` carries `aria-selected` while checked.
 *
 * The host is the region it governs: a `<table>`, a wrapper, or a marker inside a table, which
 * hands the work to its closest `<table>`.
 *
 * @example <Table mix={[tableSelection()]}>…</Table>
 * @example <span hidden mix={[tableSelection()]} />
 */
export const tableSelection: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
	HTMLElement,
	[],
	ElementProps
>(
	(handle) => {
		let controller: AbortController | undefined;

		handle.addEventListener("insert", (event) => {
			controller?.abort();
			controller = new AbortController();
			let scope: HTMLElement = event.node.closest("table") ?? event.node;
			bindSelection(scope, controller.signal);
		});

		handle.addEventListener("remove", () => {
			controller?.abort();
			controller = undefined;
		});
	},
	{ ssr: false },
);

/**
 * Wires `scope`'s checkboxes until `signal` aborts. A batch of changes the mixin makes itself
 * syncs select-all once at the end, so checking a thousand rows costs one pass.
 */
function bindSelection(scope: HTMLElement, signal: AbortSignal): void {
	let anchor: HTMLInputElement | null = null;
	let applying = false;

	/** The enabled row checkboxes in document order, the order a range spans. */
	function items(): HTMLInputElement[] {
		return [...scope.querySelectorAll<HTMLInputElement>(SELECTION_ITEM_SELECTOR)].filter(
			(item) => !item.disabled,
		);
	}

	/** Sets each of `targets` to `checked`, firing `change` on every one that flips. */
	function apply(targets: HTMLInputElement[], checked: boolean): void {
		applying = true;
		for (let target of targets) {
			if (target.checked === checked) continue;
			target.checked = checked;
			target.dispatchEvent(new Event("change", { bubbles: true }));
		}
		applying = false;
		sync();
	}

	/** Mirrors the rows onto every select-all box and onto each row's `aria-selected`. */
	function sync(): void {
		let all = items();
		let checked = all.filter((item) => item.checked).length;
		for (let box of scope.querySelectorAll<HTMLInputElement>(SELECTION_ALL_SELECTOR)) {
			box.checked = all.length > 0 && checked === all.length;
			box.indeterminate = checked > 0 && checked < all.length;
		}
		for (let item of scope.querySelectorAll<HTMLInputElement>(SELECTION_ITEM_SELECTOR)) {
			let row = item.closest("tr");
			if (!row) continue;
			if (item.checked) row.setAttribute("aria-selected", "true");
			else row.removeAttribute("aria-selected");
		}
	}

	scope.addEventListener(
		"mousedown",
		(event) => {
			if (!event.shiftKey || !(event.target instanceof Element)) return;
			if (event.target.closest("label")?.querySelector(SELECTION_ITEM_SELECTOR)) {
				event.preventDefault();
			}
		},
		{ signal },
	);

	scope.addEventListener(
		"click",
		(event) => {
			let item = event.target instanceof Element ? event.target : null;
			if (!item?.matches(SELECTION_ITEM_SELECTOR)) return;
			let current = item as HTMLInputElement;
			let all = items();
			if (event.shiftKey && anchor && anchor !== current && all.includes(anchor)) {
				let [from, to] = [all.indexOf(anchor), all.indexOf(current)].sort((a, b) => a - b);
				apply(all.slice(from, (to ?? 0) + 1), current.checked);
			}
			anchor = current;
		},
		{ signal },
	);

	scope.addEventListener(
		"change",
		(event) => {
			if (applying || !(event.target instanceof Element)) return;
			if (event.target.matches(SELECTION_ALL_SELECTOR)) {
				apply(items(), (event.target as HTMLInputElement).checked);
				return;
			}
			if (event.target.matches(SELECTION_ITEM_SELECTOR)) sync();
		},
		{ signal },
	);

	sync();
}
