/**
 * Narrows a file tree as the reader types into its filter field: leaves that miss the query
 * hide, every folder holding a match opens, and folders with none hide, so a match is never
 * stranded inside a closed or hidden branch.
 * Why JS: HTML has no live filtering of other elements. No-JS baseline: the field submits its
 * GET form (`?filter=`) and the server renders the narrowed tree.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ElementProps, MixinFactory } from "remix/component";

import { createElement, createMixin, on } from "remix/component";

import { treeFilterMatches } from "../utils/tree-filter.js";

/** Attribute every file row carries, holding the path the filter matches. */
export const TREE_FILTER_TEXT_ATTRIBUTE = "data-filter-text";

/** Selector for the file rows a filter narrows. */
const LEAF_SELECTOR = "[data-tree-leaf]";

/** Selector for the rows focus can move into from the field. */
const ROW_SELECTOR = '[role="treeitem"]';

/**
 * Each folder's open state from before the filter changed it, so clearing the query puts
 * every folder back the way the reader left it.
 */
const OPEN_BEFORE_FILTER = new WeakMap<HTMLDetailsElement, boolean>();

/**
 * Types for {@link treeFilter}.
 */
export namespace TreeFilter {
	/** Options for {@link treeFilter}. */
	export interface Options {
		/** The `id` of the tree the field narrows. */
		tree: string;
	}
}

/**
 * Applies `query` to every row in `tree`. Folders are visited deepest first, so a folder
 * reads its subfolders' final state when it decides whether it still holds a match.
 *
 * @param tree The tree's root element.
 * @param query What the reader typed; blank restores the whole tree.
 * @returns How many files match.
 */
export function applyTreeFilter(tree: HTMLElement, query: string): number {
	let active = query.trim() !== "";
	let matches = 0;

	for (let leaf of tree.querySelectorAll<HTMLElement>(LEAF_SELECTOR)) {
		let text = leaf.getAttribute(TREE_FILTER_TEXT_ATTRIBUTE) ?? leaf.textContent ?? "";
		let match = !active || treeFilterMatches(text, query);
		leaf.hidden = !match;
		if (match) matches += 1;
	}

	let folders = [...tree.querySelectorAll<HTMLDetailsElement>("details")].reverse();
	for (let folder of folders) {
		if (!active) {
			folder.hidden = false;
			let before = OPEN_BEFORE_FILTER.get(folder);
			if (before !== undefined) folder.open = before;
			OPEN_BEFORE_FILTER.delete(folder);
			continue;
		}

		let holdsMatch = folder.querySelector(`${LEAF_SELECTOR}:not([hidden])`) !== null;
		folder.hidden = !holdsMatch;
		if (!holdsMatch) continue;
		if (!OPEN_BEFORE_FILTER.has(folder)) OPEN_BEFORE_FILTER.set(folder, folder.open);
		folder.open = true;
	}

	return matches;
}

/**
 * Filters the tree named by `options.tree` on every keystroke in the field it is applied to,
 * and moves focus from the field into the first visible row on ArrowDown, so a reader types,
 * then walks the results.
 *
 * @param options The tree to narrow.
 * @example <input type="search" name="filter" mix={[treeFilter({ tree: "files" })]} />
 */
export const treeFilter: MixinFactory<
	HTMLInputElement,
	[options: TreeFilter.Options],
	ElementProps
> = createMixin<HTMLInputElement, [options: TreeFilter.Options], ElementProps>((handle) => {
	let treeId = "";

	/** The tree this field narrows, looked up when used so a swapped tree is still found. */
	let treeFor = (input: HTMLInputElement): HTMLElement | null =>
		input.ownerDocument.getElementById(treeId);

	handle.addEventListener("insert", (event) => {
		let tree = treeFor(event.node);
		if (tree !== null && event.node.value !== "") applyTreeFilter(tree, event.node.value);
	});

	return (options) => {
		treeId = options.tree;
		return createElement(handle.element, {
			mix: [
				on<HTMLInputElement, "input">("input", (event) => {
					let tree = treeFor(event.currentTarget);
					if (tree !== null) applyTreeFilter(tree, event.currentTarget.value);
				}),
				on<HTMLInputElement, "keydown">("keydown", (event) => {
					if (event.key !== "ArrowDown") return;
					let rows =
						treeFor(event.currentTarget)?.querySelectorAll<HTMLElement>(ROW_SELECTOR) ?? [];
					let row = [...rows].find((candidate) => candidate.closest("[hidden]") === null);
					if (row === undefined) return;
					event.preventDefault();
					row.focus();
				}),
			],
		});
	};
});
