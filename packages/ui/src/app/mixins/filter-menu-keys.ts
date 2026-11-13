/**
 * Why JS: a filterable picker is typed into and steered from its filter field, and only script
 * hears those keys. This routes typing, ↑↓, Enter, Escape, picks, tab changes and hovers to the list.
 * No-JS baseline: every row is a link or a native input, and tabs switch through CSS.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/component";

import { createMixin } from "remix/component";

/** The slot every row of the list carries, with its entry's key in `data-key`. */
export const FILTER_MENU_ROW_SLOT = "filter-menu-row";

/** Types for {@link filterMenuKeys}. */
export namespace FilterMenuKeys {
	/** What the list does for each gesture; the latest handlers always answer. */
	export interface Handlers {
		/** The filter field's id; typing and keys count only there. */
		input: string;
		/** The filter field's text changed. */
		onFilter(value: string): void;
		/** ↓ (`1`) or ↑ (`-1`) moved the highlighted row. */
		onMove(step: 1 | -1): void;
		/** Enter picked the highlighted row. */
		onChoose(host: HTMLElement): void;
		/** Escape closed the menu, whatever the field holds. */
		onClose(host: HTMLElement): void;
		/** A tab radio, marked `data-tab-index`, was chosen. */
		onTab(index: number): void;
		/** A row's radio or checkbox changed. */
		onPick(input: HTMLInputElement, host: HTMLElement): void;
		/** The pointer moved onto the row whose key this is. */
		onHover(key: string): void;
	}
}

/**
 * Applied to the list's root: listens for typing and keys in the filter field, changes to the
 * row and tab inputs, and pointer moves over rows, and hands each to `handlers`. Escape is
 * taken from the search field, so it closes the menu instead of only clearing the text.
 *
 * @example <div mix={[filterMenuKeys({ input: "refs-filter", onFilter, onMove, onChoose, onClose, onTab, onPick, onHover })]}>…</div>
 */
export const filterMenuKeys: MixinFactory<HTMLElement, [handlers: FilterMenuKeys.Handlers]> =
	createMixin<HTMLElement, [handlers: FilterMenuKeys.Handlers]>((handle) => {
		let handlers: FilterMenuKeys.Handlers | undefined;
		let controller: AbortController | undefined;

		handle.addEventListener("insert", (event) => {
			controller?.abort();
			controller = new AbortController();
			listen(event.node, () => handlers, controller.signal);
		});

		handle.addEventListener("remove", () => {
			controller?.abort();
			controller = undefined;
		});

		return (next) => {
			handlers = next;
		};
	});

/**
 * Wires `host`'s listeners until `signal` aborts.
 *
 * @param host The list's root.
 * @param read Reads the latest handlers.
 * @param signal Ends every listener once the list leaves the document.
 */
function listen(
	host: HTMLElement,
	read: () => FilterMenuKeys.Handlers | undefined,
	signal: AbortSignal,
): void {
	/** The filter field the event came from, or `undefined` for any other target. */
	function field(event: Event): HTMLInputElement | undefined {
		let handlers = read();
		let target = event.target;
		if (!handlers || !(target instanceof HTMLInputElement)) return undefined;
		return target.id === handlers.input ? target : undefined;
	}

	host.addEventListener(
		"input",
		(event) => {
			let input = field(event);
			if (input) read()?.onFilter(input.value);
		},
		{ signal },
	);

	host.addEventListener(
		"keydown",
		(event) => {
			let handlers = read();
			if (!handlers || !field(event)) return;
			if (event.key === "ArrowDown" || event.key === "ArrowUp") {
				event.preventDefault();
				handlers.onMove(event.key === "ArrowDown" ? 1 : -1);
			} else if (event.key === "Enter") {
				event.preventDefault();
				handlers.onChoose(host);
			} else if (event.key === "Escape") {
				event.preventDefault();
				handlers.onClose(host);
			}
		},
		{ signal },
	);

	host.addEventListener(
		"change",
		(event) => {
			let handlers = read();
			let input = event.target;
			if (!handlers || !(input instanceof HTMLInputElement)) return;
			if (input.dataset.tabIndex === undefined) handlers.onPick(input, host);
			else handlers.onTab(Number(input.dataset.tabIndex));
		},
		{ signal },
	);

	host.addEventListener(
		"pointermove",
		(event) => {
			if (!(event.target instanceof Element)) return;
			let row = event.target.closest<HTMLElement>(`[data-slot="${FILTER_MENU_ROW_SLOT}"]`);
			let key = row?.dataset.key;
			if (key) read()?.onHover(key);
		},
		{ signal },
	);
}
