/**
 * Adapts the WAI-ARIA tree keyboard pattern onto a Tree's rows: a roving
 * focus position moves between visible rows, arrow keys expand, collapse, or
 * step into and out of a subtree, and typed text matches labels, with every
 * selection change delegated to a shared `SelectionModel`. Each row still
 * renders in document order behind a disclosure control, staying expandable.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createElement, createMixin, on } from "remix/ui";

import type { SelectionModel } from "../behaviors/selection-model";

import { isPrintableKey, labelFor, setRovingTabindex } from "../utils/keyboard-nav";

/**
 * Attribute every Tree row exposes itself on; its value doubles as the
 * `SelectionModel.Key` {@link treeKeys} toggles, ranges over, and mirrors
 * `aria-selected` onto, while `aria-level`/`aria-expanded` derive each row's
 * place in the tree.
 */
export const TREE_ITEM_ATTRIBUTE = "data-tree-item";

/** Selector matching a row excluded from keyboard navigation and selection. */
const DISABLED_SELECTOR = '[aria-disabled="true"]';

/** Idle time after the last keystroke before the typeahead buffer resets. */
const TYPEAHEAD_RESET_MS = 500;

/** DOM event type dispatched by {@link treeKeys} whenever the bound model's selection or the active row changes. */
const TREE_CHANGE_EVENT = "ui:tree-change" as const;

declare global {
	interface HTMLElementEventMap {
		[TREE_CHANGE_EVENT]: TreeChangeEvent;
	}
}

/**
 * Dispatched on a Tree's row list by {@link treeKeys} whenever the bound
 * `SelectionModel`'s selection changes or the roving cursor moves rows, so a
 * consumer can react — a live-region announcement, syncing a hidden field —
 * without reading the model or DOM focus directly.
 */
export class TreeChangeEvent extends Event {
	/** Keys the bound model currently reports as selected. */
	readonly selectedKeys: ReadonlySet<SelectionModel.Key>;
	/** Key of the row currently holding the roving keyboard cursor, or `null` when no row has focus. */
	readonly activeKey: SelectionModel.Key | null;

	/**
	 * @param init Snapshot of the tree's selection and active row at dispatch time.
	 */
	constructor(init: {
		selectedKeys: ReadonlySet<SelectionModel.Key>;
		activeKey: SelectionModel.Key | null;
	}) {
		super(TREE_CHANGE_EVENT, { bubbles: true });
		this.selectedKeys = init.selectedKeys;
		this.activeKey = init.activeKey;
	}
}

/**
 * A single Tree row read from the DOM, positioned within its hierarchy from
 * document order and `aria-level` alone — no separate parent/child model is
 * kept anywhere.
 */
interface TreeRow {
	/** Row element carrying {@link TREE_ITEM_ATTRIBUTE}. */
	element: HTMLElement;
	/** Row's `SelectionModel.Key`, read from {@link TREE_ITEM_ATTRIBUTE}'s value. */
	key: SelectionModel.Key;
	/** Row's 1-based depth, read from `aria-level` (a row without one is treated as depth 1). */
	level: number;
	/** Nearest enclosing row, or `null` at the root. */
	parent: TreeRow | null;
	/** `true` when the next row in document order is nested one level deeper. */
	hasChildren: boolean;
	/** Current `aria-expanded` value; meaningless when {@link hasChildren} is `false`. */
	expanded: boolean;
	/** Mirrors `aria-disabled`; excluded from keyboard navigation and selection regardless of {@link visible}. */
	disabled: boolean;
	/** `true` when every ancestor is expanded, so the row is actually reachable right now. */
	visible: boolean;
}

/**
 * Reads rows beneath `host` carrying {@link TREE_ITEM_ATTRIBUTE} into a flat
 * {@link TreeRow} list, deriving level, parent, children, and visibility from
 * `aria-level`/`aria-expanded` alone, via one level-ordered stack pass so no row re-scans its ancestors.
 */
function collectRows(host: HTMLElement): TreeRow[] {
	let elements = Array.from(host.querySelectorAll<HTMLElement>(`[${TREE_ITEM_ATTRIBUTE}]`));
	let rows: TreeRow[] = [];
	let stack: TreeRow[] = [];

	for (let [index, element] of elements.entries()) {
		let level = Number(element.getAttribute("aria-level")) || 1;
		while (stack.length > 0 && stack[stack.length - 1]!.level >= level) stack.pop();

		let parent = stack[stack.length - 1] ?? null;
		let next = elements[index + 1];
		let nextLevel = next ? Number(next.getAttribute("aria-level")) || 1 : level;

		let row: TreeRow = {
			element,
			key: element.getAttribute(TREE_ITEM_ATTRIBUTE) ?? "",
			level,
			parent,
			hasChildren: nextLevel > level,
			expanded: element.getAttribute("aria-expanded") === "true",
			disabled: element.matches(DISABLED_SELECTOR),
			visible: parent === null || (parent.visible && parent.expanded),
		};

		rows.push(row);
		stack.push(row);
	}

	return rows;
}

/** Rows in `rows` that are both reachable (every ancestor expanded) and enabled — the set arrow keys, `Home`/`End`, typeahead, and range/select-all actually operate over. */
function navigableRows(rows: readonly TreeRow[]): TreeRow[] {
	return rows.filter((row) => row.visible && !row.disabled);
}

/** Moves roving `tabindex` and real DOM focus onto `row`, scrolling it into view. */
function focusRow(rows: readonly TreeRow[], row: TreeRow): void {
	setRovingTabindex(
		rows.map((candidate) => candidate.element),
		row.element,
	);
	row.element.focus();
	row.element.scrollIntoView({ block: "nearest", inline: "nearest" });
}

/** Mirrors `model.selectedKeys` onto every row's `aria-selected` beneath `host`, whether currently visible or collapsed out of view, so a selection made before a subtree collapsed is never lost from the DOM. */
function syncSelection(host: HTMLElement, model: SelectionModel): void {
	for (let row of collectRows(host)) {
		row.element.setAttribute("aria-selected", model.isSelected(row.key) ? "true" : "false");
	}
}

/**
 * Refreshes `model`'s known key universe to the rows currently reachable by
 * keyboard, so range selection and select-all span only what's visible — a
 * row inside a collapsed subtree is skipped, matching arrow-key movement.
 */
function refreshKeys(host: HTMLElement, model: SelectionModel): void {
	model.setKeys(navigableRows(collectRows(host)).map((row) => row.key));
}

/** Dispatches {@link TreeChangeEvent} on `host`, reading the active row's key straight off whichever element currently holds DOM focus. */
function dispatchTreeChange(host: HTMLElement, model: SelectionModel): void {
	let active = host.ownerDocument.activeElement;
	let activeKey =
		active instanceof HTMLElement && active.hasAttribute(TREE_ITEM_ATTRIBUTE)
			? (active.getAttribute(TREE_ITEM_ATTRIBUTE) ?? "")
			: null;

	host.dispatchEvent(new TreeChangeEvent({ selectedKeys: model.selectedKeys, activeKey }));
}

/**
 * Turns a Tree's row list into the ARIA tree keyboard surface for its rows:
 * arrow keys move, expand, and collapse; typed text searches labels; and
 * every selection delegates to `model`, mirroring back and firing {@link TreeChangeEvent}.
 *
 * @param model Behavior class instance owning the tree's selected-key set.
 * @example
 * let model = new SelectionModel({ mode: "multiple" });
 * <div role="tree" mix={[treeKeys(model)]}>
 *   <div role="treeitem" aria-level={1} aria-expanded="true" data-tree-item="docs">Docs</div>
 *   <div role="treeitem" aria-level={2} data-tree-item="docs/readme">README</div>
 * </div>
 */
export const treeKeys = createMixin<HTMLElement, [model: SelectionModel]>((handle) => {
	let hostNode: HTMLElement | undefined;
	let boundModel: SelectionModel | undefined;
	let buffer = "";
	let resetBufferId: ReturnType<typeof setTimeout> | undefined;

	handle.addEventListener("insert", (event) => {
		hostNode = event.node;

		let rows = collectRows(hostNode);
		let navigable = navigableRows(rows);
		if (navigable.length > 0) {
			setRovingTabindex(
				rows.map((row) => row.element),
				navigable[0]!.element,
			);
		}

		if (boundModel) {
			refreshKeys(hostNode, boundModel);
			syncSelection(hostNode, boundModel);
		}
	});
	handle.addEventListener("remove", () => {
		hostNode = undefined;
	});
	handle.signal.addEventListener("abort", () => clearTimeout(resetBufferId));

	return (model) => {
		if (boundModel !== model) {
			boundModel = model;
			model.addEventListener(
				"change",
				() => {
					if (hostNode === undefined) return;
					syncSelection(hostNode, model);
					dispatchTreeChange(hostNode, model);
				},
				{ signal: handle.signal },
			);
		}

		return createElement(handle.element, {
			mix: [
				on<HTMLElement, "focusin">("focusin", (event) => {
					if (!hostNode) return;
					let target = event.target;
					if (!(target instanceof HTMLElement)) return;

					let rows = collectRows(hostNode);
					let row = rows.find((candidate) => candidate.element === target);
					if (row) {
						setRovingTabindex(
							rows.map((candidate) => candidate.element),
							row.element,
						);
					}
				}),
				on<HTMLElement, "keydown">("keydown", (event) => {
					if (!hostNode) return;

					let rows = collectRows(hostNode);
					if (rows.length === 0) return;

					let navigable = navigableRows(rows);
					let activeIndex = navigable.findIndex(
						(row) => row.element === hostNode!.ownerDocument.activeElement,
					);
					let current = activeIndex === -1 ? undefined : navigable[activeIndex];

					switch (event.key) {
						case "ArrowDown": {
							event.preventDefault();
							let next = navigable[activeIndex + 1];
							if (!next) return;
							focusRow(rows, next);
							if (event.shiftKey) model.selectRange(next.key);
							return;
						}
						case "ArrowUp": {
							event.preventDefault();
							let previous = activeIndex > 0 ? navigable[activeIndex - 1] : undefined;
							if (!previous) return;
							focusRow(rows, previous);
							if (event.shiftKey) model.selectRange(previous.key);
							return;
						}
						case "ArrowRight": {
							if (!current) return;
							event.preventDefault();

							if (current.hasChildren && !current.expanded) {
								current.element.setAttribute("aria-expanded", "true");
								refreshKeys(hostNode!, model);
								return;
							}
							if (current.hasChildren && current.expanded) {
								let child = rows.find((row) => row.parent === current && !row.disabled);
								if (child) focusRow(rows, child);
							}
							return;
						}
						case "ArrowLeft": {
							if (!current) return;
							event.preventDefault();

							if (current.hasChildren && current.expanded) {
								current.element.setAttribute("aria-expanded", "false");
								refreshKeys(hostNode!, model);
								return;
							}
							if (current.parent && !current.parent.disabled) focusRow(rows, current.parent);
							return;
						}
						case "Home":
							event.preventDefault();
							if (navigable[0]) focusRow(rows, navigable[0]);
							return;
						case "End":
							event.preventDefault();
							if (navigable[navigable.length - 1]) focusRow(rows, navigable[navigable.length - 1]!);
							return;
						case "Enter":
						case " ":
							if (!current) return;
							event.preventDefault();
							model.toggle(current.key);
							return;
						case "Backspace":
							buffer = buffer.slice(0, -1);
							return;
					}

					if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
						event.preventDefault();
						model.selectAll();
						return;
					}

					if (!isPrintableKey(event)) return;

					clearTimeout(resetBufferId);
					buffer += event.key.toLowerCase();
					resetBufferId = setTimeout(() => {
						buffer = "";
					}, TYPEAHEAD_RESET_MS);

					let start = activeIndex === -1 ? 0 : activeIndex + 1;
					let searchOrder = [...navigable.slice(start), ...navigable.slice(0, start)];
					let match = searchOrder.find((row) => labelFor(row.element).startsWith(buffer));
					if (match) focusRow(rows, match);
				}),
			],
		});
	};
});
