/**
 * Why JS: HTML has no select-all checkbox, no indeterminate state outside script and no
 * shift-click range. No-JS baseline: every row checkbox still toggles and submits with its
 * form, and a checked row is tinted by CSS alone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ElementProps, MixinFactory } from "remix/component";

import { iife } from "@sdxc/iife";
import { createMixin } from "remix/component";

/** Selector for a per-row checkbox, the contract any selectable list renders. */
export const SELECTION_ITEM_SELECTOR = "input[type=checkbox][data-selection-item]";

/** Selector for the checkbox that selects or clears every row at once. */
export const SELECTION_ALL_SELECTOR = "input[type=checkbox][data-selection-all]";

/**
 * Marks a checked row box on the client alone, so a frame reload or navigation that patches
 * the row against server HTML removes it: that removal is how a selection learns its rows
 * were re-rendered.
 */
const CHECKED_MARKER = "data-selection-checked";

/**
 * The record each known row box held when last seen, `null` while unchecked. Module-wide, so
 * every binding over the same boxes restores the same selection.
 */
const REMEMBERED = new WeakMap<HTMLInputElement, string | null>();

/** Forms that submitted checked rows; their next re-render clears the selection it sent. */
const SUBMITTED = new WeakSet<HTMLFormElement>();

/** A region whose row boxes {@link keepSelection} keeps, and what follows each re-render. */
interface Keeper {
	scope: HTMLElement;
	restored: () => void;
}

/**
 * Every live keeper and the one observer watching all their regions, created on first use.
 * One observer hears each patch once, however many keepers' regions overlap.
 */
const KEEPING: { keepers: Set<Keeper>; observer?: MutationObserver } = { keepers: new Set() };

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

	keepSelection(scope, signal, sync);

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

/**
 * Keeps `scope`'s row boxes true to the selection when a frame reload or navigation patches
 * them against server HTML, until `signal` aborts. The patch matches rows by position and
 * keeps each box's live check, so afterwards a box is checked exactly when it holds a record
 * that was checked before; once a form submitted checked rows, its boxes take what the server
 * rendered instead. `restored` runs after every such patch, even one that changed no box.
 *
 * @param scope The region holding the row boxes.
 * @param signal Ends the watch once the binding leaves the document.
 * @param restored Re-derives what the binding draws from the boxes.
 */
export function keepSelection(scope: HTMLElement, signal: AbortSignal, restored: () => void): void {
	if (signal.aborted) return;
	let keeper: Keeper = { scope, restored };
	KEEPING.keepers.add(keeper);
	KEEPING.observer ??= new MutationObserver(settleRerender);
	KEEPING.observer.observe(scope, {
		subtree: true,
		childList: true,
		attributeFilter: [CHECKED_MARKER],
		attributeOldValue: true,
	});
	remember(rowBoxes(scope));

	scope.addEventListener(
		"change",
		(event) => {
			if (
				event.target instanceof HTMLInputElement &&
				event.target.matches(SELECTION_ITEM_SELECTOR)
			) {
				remember([event.target]);
			}
		},
		{ signal },
	);
	scope.ownerDocument.addEventListener(
		"submit",
		(event) => {
			let form = event.target;
			if (!(form instanceof HTMLFormElement)) return;
			let sent = rowBoxes(scope).some((item) => item.checked && item.form === form);
			if (sent) SUBMITTED.add(form);
		},
		{ capture: true, signal },
	);
	scope.ownerDocument.addEventListener("reset", () => setTimeout(() => remember(rowBoxes(scope))), {
		capture: true,
		signal,
	});
	signal.addEventListener("abort", () => {
		KEEPING.keepers.delete(keeper);
		if (KEEPING.keepers.size > 0) return;
		KEEPING.observer?.disconnect();
		KEEPING.observer = undefined;
	});
}

/** Every row box in `scope`, disabled ones included, in document order. */
function rowBoxes(scope: Element): HTMLInputElement[] {
	return [...scope.querySelectorAll<HTMLInputElement>(SELECTION_ITEM_SELECTOR)];
}

/** Row boxes in or at `node`, for nodes a patch added or removed. */
function boxesIn(node: Node): HTMLInputElement[] {
	if (!(node instanceof Element)) return [];
	if (node.matches(SELECTION_ITEM_SELECTOR)) return [node as HTMLInputElement];
	return rowBoxes(node);
}

/**
 * Records what each of `items` holds and marks the checked ones. The observer's own marker
 * writes are dropped right away, so only a patch's removals reach it.
 */
function remember(items: HTMLInputElement[]): void {
	for (let item of items) {
		REMEMBERED.set(item, item.checked ? item.value : null);
		if (item.checked === item.hasAttribute(CHECKED_MARKER)) continue;
		if (item.checked) item.setAttribute(CHECKED_MARKER, "");
		else item.removeAttribute(CHECKED_MARKER);
	}
	KEEPING.observer?.takeRecords();
}

/**
 * Answers a batch of mutations: when a patch removed the marker from a box still remembered
 * as checked, or added or removed rows, every kept region's boxes are restored.
 */
function settleRerender(records: MutationRecord[]): void {
	let gone: HTMLInputElement[] = [];
	let patched = false;
	for (let record of records) {
		if (record.type === "attributes") {
			let item = record.target as HTMLInputElement;
			if (typeof REMEMBERED.get(item) === "string" && !item.hasAttribute(CHECKED_MARKER)) {
				patched = true;
			}
			continue;
		}
		let added = [...record.addedNodes].flatMap(boxesIn);
		let removed = [...record.removedNodes].flatMap(boxesIn);
		if (added.length > 0 || removed.length > 0) patched = true;
		gone.push(...removed);
	}
	if (!patched) return;

	let keepers = [...KEEPING.keepers].filter((keeper) => keeper.scope.isConnected);
	let items = [...new Set(keepers.flatMap((keeper) => rowBoxes(keeper.scope)))];
	restore(items, gone);
	remember(items);
	for (let keeper of keepers) keeper.restored();
}

/**
 * Checks each box that holds a record checked before the patch, or, for a form that
 * submitted, what the server rendered. A box the patch created keeps its rendered check.
 * Each box that flips fires a bubbling `change`, as a click would.
 *
 * @param items The boxes on the page now.
 * @param gone The boxes the patch removed, whose records may have moved to other rows.
 */
function restore(items: HTMLInputElement[], gone: HTMLInputElement[]): void {
	let records = new Set<string>();
	for (let item of [...items, ...gone]) {
		let record = REMEMBERED.get(item);
		if (typeof record === "string") records.add(record);
	}
	let consumed = new Set<HTMLFormElement>();
	for (let item of items) {
		let form = item.form;
		let wanted = iife(() => {
			if (form && SUBMITTED.has(form)) {
				consumed.add(form);
				return item.defaultChecked;
			}
			return records.has(item.value) || (REMEMBERED.get(item) === undefined && item.checked);
		});
		if (item.checked === wanted) continue;
		item.checked = wanted;
		item.dispatchEvent(new Event("change", { bubbles: true }));
	}
	for (let form of consumed) SUBMITTED.delete(form);
}
