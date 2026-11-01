/**
 * Keeps a selection bar in step with the rows it acts on: it counts the checked
 * `[data-selection-item]` boxes in a target region, morphs the bar between pagination and
 * bulk actions, announces the count, and owns Escape and the action keys while rows are picked.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/component";

import { createMixin } from "remix/component";

import { isListKey } from "../utils/key-target.js";

/** The rows a selection counts: checked item boxes, never the select-all box. */
const CHECKED_ITEM_SELECTOR = "[data-selection-item]:checked";

/** Types for {@link selectionBarSync}. */
export namespace SelectionBarSync {
	/** Configuration for {@link selectionBarSync}. */
	export interface Options {
		/** The `id` of the region holding the rows' checkboxes. */
		target: string;
		/** The visible and announced count, with `{count}` replaced, such as "{count} selected". */
		selected: string;
		/** What is announced once the selection empties, such as "Selection cleared". */
		cleared: string;
		/** Locale for the count. Defaults to the runtime's. */
		locale?: string;
	}
}

/**
 * Wires the bar around its host (`[data-slot="selection-bar"]`) to the target region; the
 * host itself is the polite live region. The bar shows `data-state="selecting"` while any
 * row is checked, its hidden layer is `inert`, and the count stays on the last non-zero value
 * so the bar fades out still naming what was selected.
 *
 * @example <span role="status" mix={[selectionBarSync({ target: "monitors", selected: "{count} selected", cleared: "Selection cleared" })]} />
 */
export const selectionBarSync: MixinFactory<HTMLElement, [options: SelectionBarSync.Options]> =
	createMixin<HTMLElement, [options: SelectionBarSync.Options]>((handle) => {
		let options: SelectionBarSync.Options | undefined;
		let controller: AbortController | undefined;

		handle.addEventListener("insert", (event) => {
			controller?.abort();
			controller = new AbortController();
			if (options) connect(event.node, options, controller.signal);
		});

		handle.addEventListener("remove", () => {
			controller?.abort();
			controller = undefined;
		});

		return (next) => {
			options = next;
		};
	});

/**
 * Connects `live`'s bar to its target until `signal` aborts.
 *
 * @param live The status element the island renders inside the bar.
 * @param options The target and the strings to show.
 * @param signal Ends every listener once the host leaves the document.
 */
function connect(live: HTMLElement, options: SelectionBarSync.Options, signal: AbortSignal): void {
	let bar = live.closest<HTMLElement>('[data-slot="selection-bar"]');
	let doc = live.ownerDocument;
	let target = doc.getElementById(options.target);
	if (!bar || !target) return;

	let numbers = new Intl.NumberFormat(options.locale);
	let pagination = bar.querySelector<HTMLElement>('[data-slot="selection-bar-pagination"]');
	let selection = bar.querySelector<HTMLElement>('[data-slot="selection-bar-selection"]');
	let summary = bar.querySelector<HTMLElement>('[data-slot="selection-count"]');
	let previous = 0;
	let pending = false;

	/** Reads the count off the target and moves the bar to match, announcing a change. */
	let sync = () => {
		pending = false;
		let count = target.querySelectorAll(CHECKED_ITEM_SELECTOR).length;
		let selecting = count > 0;
		bar.dataset.state = selecting ? "selecting" : "idle";
		if (selection) selection.inert = !selecting;
		if (pagination) pagination.inert = selecting;
		if (selecting && summary) summary.textContent = format(options.selected, numbers, count);
		if (count !== previous) {
			live.textContent = selecting ? format(options.selected, numbers, count) : options.cleared;
		}
		previous = count;
	};

	/** Coalesces the burst of `change` events a select-all or range pick dispatches into one sync. */
	let schedule = () => {
		if (pending) return;
		pending = true;
		queueMicrotask(sync);
	};

	/** Unchecks every row and select-all box, firing `change` on each as a click would. */
	let clear = () => {
		for (let box of target.querySelectorAll<HTMLInputElement>(CHECKED_ITEM_SELECTOR)) {
			box.checked = false;
			box.dispatchEvent(new Event("change", { bubbles: true }));
		}
		for (let all of target.querySelectorAll<HTMLInputElement>("[data-selection-all]")) {
			if (!all.checked && !all.indeterminate) continue;
			all.checked = false;
			all.indeterminate = false;
			all.dispatchEvent(new Event("change", { bubbles: true }));
		}
		if (bar.contains(doc.activeElement)) {
			target.querySelector<HTMLElement>("[data-selection-item]")?.focus();
		}
		sync();
	};

	target.addEventListener("change", schedule, { signal });
	target.addEventListener("reset", () => setTimeout(sync), { signal });
	bar.querySelector('[data-slot="selection-clear"]')?.addEventListener("click", clear, { signal });
	doc.defaultView?.addEventListener(
		"keydown",
		(event) => {
			if (bar.dataset.state !== "selecting" || event.shiftKey || !isListKey(event)) return;
			let escape = event.key === "Escape";
			let action = escape ? undefined : actionFor(bar, event.key);
			if (!escape && !action) return;
			event.preventDefault();
			event.stopPropagation();
			if (action) action.click();
			else clear();
		},
		{ capture: true, signal },
	);
	sync();
}

/**
 * The enabled action button in `bar` whose key is `key`, matched without case so the printed
 * capital and the typed lowercase letter agree.
 *
 * @param bar The selection bar.
 * @param key The pressed key.
 * @returns The button to click, if one claims the key.
 */
function actionFor(bar: HTMLElement, key: string): HTMLButtonElement | undefined {
	if (key.length !== 1) return undefined;
	let wanted = key.toLowerCase();
	return [...bar.querySelectorAll<HTMLButtonElement>("button[data-selection-key]")].find(
		(button) => !button.disabled && button.dataset.selectionKey?.toLowerCase() === wanted,
	);
}

/**
 * Writes `count` into `template`'s `{count}` placeholder.
 *
 * @param template The string with a `{count}` placeholder.
 * @param numbers The formatter for the reader's locale.
 * @param count How many rows are selected.
 * @returns The finished string.
 */
function format(template: string, numbers: Intl.NumberFormat, count: number): string {
	return template.replaceAll("{count}", numbers.format(count));
}
