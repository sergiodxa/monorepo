/**
 * Keyboard row navigation for a list or table: `j`/`k` and the arrows move one roving focus
 * stop through the rows, Enter or `o` opens a row, `x` toggles its selection checkbox, Space
 * can ask for a peek, and `/` jumps to the page's search field.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/component";

import { outline } from "@sdxc/u/color";
import { when } from "@sdxc/u/state";
import { createElement, createMixin } from "remix/component";

import type { Announcer } from "../../behaviors/announcer.js";

import { shortcutRegistry } from "../behaviors/shortcuts.js";

/** Rows the mixin walks when its options name none: marked rows, table body rows, list items. */
export const ROW_NAVIGATION_ROW_SELECTOR = "[data-row], tbody > tr, :scope > li";

/** The control opening a row: one marked `data-row-primary`, else its first link. */
export const ROW_NAVIGATION_PRIMARY_SELECTOR = "[data-row-primary], a[href]";

/** Attribute every row the mixin has indexed carries, which its focus ring is drawn on. */
export const ROW_NAVIGATION_ATTRIBUTE = "data-row-navigation";

/** Event a row dispatches when Space asks to peek at it, bubbling with the row as `detail.row`. */
export const ROW_PEEK_EVENT = "row-peek";

/** The selection checkbox the selection column renders in each row. */
const SELECTION_ITEM_SELECTOR = "input[type='checkbox'][data-selection-item]";

/**
 * Types for {@link rowNavigation}.
 */
export namespace RowNavigation {
	/** The copy each key lists under in the help sheet; an omitted label keeps that key unlisted. */
	export interface Labels {
		/** The help-sheet heading the keys list under. */
		group?: string;
		next?: string;
		previous?: string;
		open?: string;
		toggle?: string;
		peek?: string;
		search?: string;
		/** Announced when `x` checks the row's checkbox. */
		selected?: string;
		/** Announced when `x` clears the row's checkbox. */
		deselected?: string;
	}

	/** Options for {@link rowNavigation}. */
	export interface Options {
		/** Rows to walk, matched inside the host. @default ROW_NAVIGATION_ROW_SELECTOR */
		rows?: string;
		/** The control Enter and `o` press inside a row. @default ROW_NAVIGATION_PRIMARY_SELECTOR */
		primary?: string;
		/** The `id` of the search field `/` focuses; omitted, `/` stays unbound. */
		search?: string;
		/** Binds Space to dispatch {@link ROW_PEEK_EVENT} on the focused row. @default false */
		peek?: boolean;
		labels?: Labels;
		/** Says what `x` did, for a reader who cannot see the checkbox change. */
		announcer?: Announcer;
	}

	/** `detail` of {@link ROW_PEEK_EVENT}. */
	export interface PeekDetail {
		row: HTMLElement;
	}
}

/** The rows under `host`, each marked so the focus ring draws on it. */
function queryRows(host: HTMLElement, selector: string): HTMLElement[] {
	let rows = [...host.querySelectorAll<HTMLElement>(selector)].filter(
		(row) => !row.hidden && row.closest("[hidden]") === null,
	);
	for (let row of rows) row.setAttribute(ROW_NAVIGATION_ATTRIBUTE, "");
	return rows;
}

/** The row holding focus, or `null` when focus sits outside every row. */
function focusedRow(host: HTMLElement, rows: HTMLElement[]): HTMLElement | null {
	let active = host.ownerDocument.activeElement;
	if (active === null || !host.contains(active)) return null;
	return rows.find((row) => row.contains(active)) ?? null;
}

/** Makes `row` the list's one Tab stop. */
function rove(rows: HTMLElement[], row: HTMLElement): void {
	for (let other of rows) other.tabIndex = other === row ? 0 : -1;
}

/**
 * The row to start from when nothing is focused: the first whose top is on screen going
 * down, the last whose bottom is on screen going up.
 */
function rowInView(rows: HTMLElement[], direction: 1 | -1): HTMLElement | undefined {
	let height = rows[0]?.ownerDocument.defaultView?.innerHeight ?? 0;
	if (direction === 1) {
		return rows.find((row) => row.getBoundingClientRect().top >= 0) ?? rows.at(-1);
	}
	return [...rows].reverse().find((row) => row.getBoundingClientRect().bottom <= height) ?? rows[0];
}

/**
 * Walks a list's rows from the keyboard, registering its keys in the page's shortcut registry
 * under the host's layer, so a list inside a sheet answers above the page's. Rows receive a
 * 2px focus ring drawn inside their edge, so a scrolling container never clips it.
 *
 * @param options Which rows to walk, what opens one, and the copy each key lists under.
 * @example <ul mix={[rowNavigation({ search: "q", labels: { group: "List", next: "Next", previous: "Previous" } })]}>…</ul>
 */
export const rowNavigation: MixinFactory<HTMLElement, [options?: RowNavigation.Options]> =
	createMixin<HTMLElement, [options?: RowNavigation.Options]>((handle) => {
		let options: RowNavigation.Options = {};

		handle.addEventListener("insert", (event) => {
			let host = event.node;
			let registry = shortcutRegistry(host.ownerDocument);
			let signal = handle.signal;
			let rows = () => queryRows(host, options.rows ?? ROW_NAVIGATION_ROW_SELECTOR);
			let labels = () => options.labels ?? {};

			let initial = rows();
			if (initial[0] !== undefined) rove(initial, initial[0]);

			host.addEventListener(
				"focusin",
				(focus) => {
					let all = rows();
					let row = all.find(
						(candidate) => focus.target instanceof Node && candidate.contains(focus.target),
					);
					if (row !== undefined) rove(all, row);
				},
				{ signal },
			);

			/** Focuses the row one step from the focused one, or the row on screen. */
			let move = (direction: 1 | -1, event: KeyboardEvent): boolean => {
				let all = rows();
				let current = focusedRow(host, all);
				if (current === null && event.key.startsWith("Arrow")) return false;
				let next =
					current === null ? rowInView(all, direction) : all[all.indexOf(current) + direction];
				if (next === undefined) return current !== null;
				rove(all, next);
				next.focus();
				next.scrollIntoView({ block: "nearest" });
				return true;
			};

			/** The focused row, only when the row itself holds focus rather than a control in it. */
			let rowItself = (): HTMLElement | null => {
				let row = focusedRow(host, rows());
				return row !== null && host.ownerDocument.activeElement === row ? row : null;
			};

			registry.register({
				keys: ["j", "arrowdown"],
				label: labels().next,
				group: labels().group,
				scope: host,
				run: (event) => move(1, event),
				signal,
			});
			registry.register({
				keys: ["k", "arrowup"],
				label: labels().previous,
				group: labels().group,
				scope: host,
				run: (event) => move(-1, event),
				signal,
			});
			registry.register({
				keys: ["o", "enter"],
				label: labels().open,
				group: labels().group,
				scope: host,
				run: (event) => {
					let row = event.key === "Enter" ? rowItself() : focusedRow(host, rows());
					let primary = row?.querySelector<HTMLElement>(
						options.primary ?? ROW_NAVIGATION_PRIMARY_SELECTOR,
					);
					if (primary == null) return false;
					primary.click();
					return true;
				},
				signal,
			});
			registry.register({
				keys: "x",
				label: labels().toggle,
				group: labels().group,
				scope: host,
				run: () => {
					let checkbox = focusedRow(host, rows())?.querySelector<HTMLInputElement>(
						SELECTION_ITEM_SELECTOR,
					);
					if (checkbox == null || checkbox.disabled) return false;
					checkbox.click();
					let said = checkbox.checked ? labels().selected : labels().deselected;
					if (said !== undefined) options.announcer?.announce(said);
					return true;
				},
				signal,
			});

			if (options.peek === true) {
				registry.register({
					keys: "space",
					label: labels().peek,
					group: labels().group,
					scope: host,
					run: () => {
						let row = rowItself();
						if (row === null) return false;
						row.dispatchEvent(
							new CustomEvent<RowNavigation.PeekDetail>(ROW_PEEK_EVENT, {
								bubbles: true,
								detail: { row },
							}),
						);
						return true;
					},
					signal,
				});
			}

			if (options.search !== undefined) {
				let id = options.search;
				registry.register({
					keys: "/",
					label: labels().search,
					group: labels().group,
					scope: host,
					run: () => {
						let field = host.ownerDocument.getElementById(id);
						if (field === null) return false;
						field.focus();
						if (field instanceof HTMLInputElement) field.select();
						return true;
					},
					signal,
				});
			}
		});

		return (next = {}) => {
			options = next;
			return createElement(handle.element, {
				mix: [
					when(
						`& [${ROW_NAVIGATION_ATTRIBUTE}]:focus-visible`,
						outline({ color: "brand.ring", width: 2, offset: -2 }),
					),
				],
			});
		};
	});
