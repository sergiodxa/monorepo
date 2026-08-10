/**
 * Adapts the WAI-ARIA grid keyboard pattern onto a GridList's rows and their
 * action cells: a single roving focus position moves between rows with
 * `ArrowUp`/`ArrowDown`, into and out of a row's action cells with
 * `ArrowRight`/`ArrowLeft`, and to the first/last row with `Home`/`End`.
 * `Space` toggles the focused row's selection, `Shift`+`ArrowUp`/`ArrowDown`
 * extends a contiguous selection range, and `Ctrl`/`Cmd`+`A` selects every
 * row — each of these calls straight into a `SelectionModel` instance
 * rather than tracking selected keys itself.
 *
 * Why JS: the WAI-ARIA grid pattern moves one roving focus position across
 * rows and their action cells with the arrow keys, and layers point, range,
 * and select-all selection on top of it with Space, Shift, and Ctrl/Cmd — a
 * keyboard model no combination of HTML and CSS expresses on its own.
 * No-JS baseline: every row, and any native control inside it (a link, a
 * button), still renders as its own reachable element, individually
 * focusable in ordinary `Tab` order; only the unified roving focus and
 * keyboard-driven selection are unavailable.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createElement, createMixin, on } from "remix/ui";

import type { SelectionModel } from "../behaviors/selection-model";

import { DISABLED_SELECTOR } from "../utils/disabled-selector";

/**
 * Attribute every GridList row exposes its {@link SelectionModel.Key} on, as
 * a string — the same attribute a `dragReorder()` mixin applied to the same
 * rows identifies them by. `gridListKeys()` reads it to correlate a row
 * element with the key `SelectionModel` tracks its selection under, and
 * writes `aria-selected` back onto the same element as the model's
 * selection changes.
 */
export const GRIDLIST_ROW_KEY_ATTRIBUTE = "data-key";

/** Selector matching a GridList row, by the same attribute contract {@link GRIDLIST_ROW_KEY_ATTRIBUTE} documents. */
const ROW_SELECTOR = `[${GRIDLIST_ROW_KEY_ATTRIBUTE}]`;

/** Selector matching one of a row's individually focusable action cells. */
const CELL_SELECTOR = '[role="gridcell"]';

/**
 * Where a keydown event originated within the grid: the row it came from,
 * and — when it came from one of that row's action cells rather than the
 * row itself — that cell's index among the row's cells.
 */
interface Position {
	/** Index of the origin row within the grid's current row list. */
	rowIndex: number;
	/** Index of the origin cell within its row's cells, or `null` when the row itself was the origin. */
	cellIndex: number | null;
}

/**
 * Collects the grid's enabled rows beneath `host`, in document order.
 * Queried fresh on every keystroke and focus change so navigation stays
 * correct as rows are added, removed, or toggled disabled.
 */
function queryRows(host: HTMLElement): HTMLElement[] {
	let candidates = host.querySelectorAll<HTMLElement>(ROW_SELECTOR);
	return Array.from(candidates).filter((row) => !row.matches(DISABLED_SELECTOR));
}

/**
 * Collects `row`'s enabled action cells, in document order.
 */
function queryCells(row: HTMLElement): HTMLElement[] {
	let candidates = row.querySelectorAll<HTMLElement>(CELL_SELECTOR);
	return Array.from(candidates).filter((cell) => !cell.matches(DISABLED_SELECTOR));
}

/**
 * Reads the raw {@link GRIDLIST_ROW_KEY_ATTRIBUTE} value off `row`, ahead of
 * resolving it back to the `SelectionModel.Key` it names.
 */
function rowKeyOf(row: HTMLElement): string {
	return row.getAttribute(GRIDLIST_ROW_KEY_ATTRIBUTE) ?? "";
}

/**
 * Resolves a row's raw {@link GRIDLIST_ROW_KEY_ATTRIBUTE} string back to the
 * `SelectionModel.Key` it names, matching by string equality against
 * `model.keys` so a model tracking numeric keys still correlates correctly
 * with the string-only DOM attribute. Falls back to the raw string itself
 * when it matches no known key — for example, before the consumer has
 * called `SelectionModel.setKeys`.
 */
function resolveKey(model: SelectionModel, raw: string): SelectionModel.Key {
	for (let key of model.keys) {
		if (String(key) === raw) return key;
	}

	return raw;
}

/**
 * Locates where a keydown or focus event originated within the grid: which
 * row, and — when it came from one of that row's action cells rather than
 * the row itself — which cell. Returns `null` when `target` isn't inside any
 * of `rows`.
 */
function locate(rows: readonly HTMLElement[], target: EventTarget | null): Position | null {
	if (!(target instanceof Element)) return null;

	let row = target.closest<HTMLElement>(ROW_SELECTOR);
	if (row === null) return null;

	let rowIndex = rows.indexOf(row);
	if (rowIndex === -1) return null;

	if (target === row) return { rowIndex, cellIndex: null };

	let cell = target.closest<HTMLElement>(CELL_SELECTOR);
	if (cell === null || cell.closest(ROW_SELECTOR) !== row) return { rowIndex, cellIndex: null };

	let cellIndex = queryCells(row).indexOf(cell);
	return { rowIndex, cellIndex: cellIndex === -1 ? null : cellIndex };
}

/**
 * Resolves a {@link Position} back to the actual row or cell element it
 * names, so a raw event target several levels deep (an icon inside an
 * action button, say) still maps onto one of the grid's real roving-focus
 * stops.
 */
function stopAt(rows: readonly HTMLElement[], position: Position): HTMLElement {
	let row = rows[position.rowIndex]!;
	if (position.cellIndex === null) return row;

	return queryCells(row)[position.cellIndex] ?? row;
}

/**
 * Every element the grid's roving tabindex currently spans: each row plus
 * its own action cells.
 */
function allStops(rows: readonly HTMLElement[]): HTMLElement[] {
	let stops: HTMLElement[] = [];
	for (let row of rows) stops.push(row, ...queryCells(row));
	return stops;
}

/**
 * Assigns roving tabindex across the whole grid: `active` becomes the sole
 * Tab-reachable stop (`tabIndex = 0`) and every other row and cell drops out
 * of Tab order (`tabIndex = -1`).
 */
function setRovingTabindex(rows: readonly HTMLElement[], active: HTMLElement): void {
	for (let stop of allStops(rows)) stop.tabIndex = stop === active ? 0 : -1;
}

/**
 * Moves roving tabindex and real DOM focus onto `target`, then scrolls it
 * into view — necessary for a grid tall enough to scroll, or rendered with
 * `content-visibility: auto`.
 */
function focusElement(rows: readonly HTMLElement[], target: HTMLElement): void {
	setRovingTabindex(rows, target);
	target.focus();
	target.scrollIntoView({ block: "nearest", inline: "nearest" });
}

/**
 * Mirrors `model`'s selected keys onto every row beneath `host` as
 * `aria-selected`, using {@link GRIDLIST_ROW_KEY_ATTRIBUTE} to correlate each
 * row with the key `model` tracks it under.
 */
function syncSelection(host: HTMLElement, model: SelectionModel): void {
	for (let row of host.querySelectorAll<HTMLElement>(ROW_SELECTOR)) {
		let key = resolveKey(model, rowKeyOf(row));
		row.setAttribute("aria-selected", String(model.isSelected(key)));
	}
}

/**
 * Adds ARIA grid keyboard navigation and selection to a GridList. Apply it
 * to the GridList's root (`role="grid"`) through its `mix` prop, alongside
 * rows carrying {@link GRIDLIST_ROW_KEY_ATTRIBUTE} and any per-row action
 * controls carrying `role="gridcell"`.
 *
 * `ArrowDown`/`ArrowUp` move roving focus to the next/previous row.
 * `ArrowRight` moves focus from a row onto its first action cell, or to the
 * next cell from there; `ArrowLeft` reverses that, returning focus to the
 * row once its first cell is passed. `Home`/`End` jump to the first/last
 * row. `Space` toggles the focused row's selection on `model` — only when
 * the row itself, not one of its action cells, holds focus, so a focused
 * action keeps its own native Space activation. Holding `Shift` with
 * `ArrowDown`/`ArrowUp` calls `model.selectRange` toward the newly focused
 * row instead of just moving focus, extending a contiguous selection the
 * same way a shift-click would. `Ctrl`/`Cmd`+`A` calls `model.selectAll`.
 *
 * Every `"change"` `model` dispatches — from one of these keys, or from
 * anything else that calls a mutating method on the same instance, such as
 * a pointer click handled elsewhere — re-scans the grid's rows and mirrors
 * the current selection onto them as `aria-selected`, using the same
 * {@link GRIDLIST_ROW_KEY_ATTRIBUTE} contract the rows are found by.
 *
 * @param model Behavior class instance owning the grid's selected keys.
 * @example
 * let model = new SelectionModel({ keys: rows.map((row) => row.id) });
 * <div role="grid" mix={[gridListKeys(model)]}>
 *   {rows.map((row) => (
 *     <div key={row.id} role="row" data-key={row.id} tabIndex={-1}>
 *       {row.label}
 *       <button role="gridcell" tabIndex={-1}>Remove</button>
 *     </div>
 *   ))}
 * </div>
 */
export const gridListKeys = createMixin<HTMLElement, [model: SelectionModel]>((handle) => {
	let hostNode: HTMLElement | undefined;
	let boundModel: SelectionModel | undefined;

	handle.addEventListener("insert", (event) => {
		hostNode = event.node;

		let rows = queryRows(hostNode);
		if (rows.length > 0) setRovingTabindex(rows, rows[0]!);
	});
	handle.addEventListener("remove", () => {
		hostNode = undefined;
	});

	return (model) => {
		if (boundModel !== model) {
			boundModel = model;
			model.addEventListener(
				"change",
				() => {
					if (hostNode !== undefined) syncSelection(hostNode, model);
				},
				{ signal: handle.signal },
			);
		}

		return createElement(handle.element, {
			mix: [
				on<HTMLElement, "focusin">("focusin", (event) => {
					if (hostNode === undefined) return;

					let rows = queryRows(hostNode);
					let position = locate(rows, event.target);
					if (position === null) return;

					setRovingTabindex(rows, stopAt(rows, position));
				}),
				on<HTMLElement, "keydown">("keydown", (event) => {
					if (hostNode === undefined) return;

					let rows = queryRows(hostNode);
					if (rows.length === 0) return;

					let position = locate(rows, event.target);
					if (position === null) return;

					let { rowIndex, cellIndex } = position;
					let row = rows[rowIndex]!;

					switch (event.key) {
						case "ArrowDown": {
							let next = rows[rowIndex + 1];
							if (!next) return;
							event.preventDefault();
							focusElement(rows, next);
							if (event.shiftKey) model.selectRange(resolveKey(model, rowKeyOf(next)));
							return;
						}
						case "ArrowUp": {
							let previous = rows[rowIndex - 1];
							if (!previous) return;
							event.preventDefault();
							focusElement(rows, previous);
							if (event.shiftKey) model.selectRange(resolveKey(model, rowKeyOf(previous)));
							return;
						}
						case "ArrowRight": {
							let cells = queryCells(row);
							if (cells.length === 0) return;
							event.preventDefault();
							let nextIndex = cellIndex === null ? 0 : Math.min(cellIndex + 1, cells.length - 1);
							focusElement(rows, cells[nextIndex]!);
							return;
						}
						case "ArrowLeft": {
							if (cellIndex === null) return;
							event.preventDefault();
							let cells = queryCells(row);
							let destination = cellIndex === 0 ? row : cells[cellIndex - 1];
							if (destination) focusElement(rows, destination);
							return;
						}
						case "Home":
							event.preventDefault();
							focusElement(rows, rows[0]!);
							return;
						case "End":
							event.preventDefault();
							focusElement(rows, rows[rows.length - 1]!);
							return;
						case " ":
							if (cellIndex !== null) return;
							event.preventDefault();
							model.toggle(resolveKey(model, rowKeyOf(row)));
							return;
						case "a":
						case "A":
							if (!(event.ctrlKey || event.metaKey)) return;
							event.preventDefault();
							model.selectAll();
							return;
					}
				}),
			],
		});
	};
});
