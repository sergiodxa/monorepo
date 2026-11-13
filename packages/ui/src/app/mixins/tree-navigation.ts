/**
 * Keyboard navigation for a tree whose rows are links and folders: one roving Tab stop, ↑↓
 * (and `j`/`k`) between visible rows, → opens a folder or enters it, ← closes it or goes to
 * its parent, Home/End, and type-ahead over row names. The keys go through the page's
 * shortcut registry under the tree's layer, so they answer only while focus is in the tree.
 * Why JS: HTML has no arrow-key movement between rows. No-JS baseline: every folder toggles
 * from its `<summary>` and every file link is reachable by Tab.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/component";

import { createElement, createMixin } from "remix/component";

import { isPrintableKey, labelFor, setRovingTabindex } from "../../utils/keyboard-nav.js";
import { shortcutRegistry } from "../behaviors/shortcuts.js";

/** Selector for the rows the keys walk: folder summaries and file links alike. */
export const TREE_NAVIGATION_ROW_SELECTOR = '[role="treeitem"]';

/** Idle time after the last keystroke before the type-ahead buffer resets. */
const TYPEAHEAD_RESET_MS = 500;

/**
 * Priority the tree's keys register at, above a list's row keys on the same layer, so `j`
 * and `k` move through the tree while it holds focus and through the list otherwise.
 */
const TREE_KEY_PRIORITY = 1;

/**
 * How long focus keeps retrying a row that refused it. A folder opened a moment ago still
 * holds its content hidden while its reveal starts, and a row inside refuses focus until then.
 */
const FOCUS_RETRY_MS = 400;

/** Keys that always move rather than start a type-ahead search. */
const MOVEMENT_LETTERS = new Set(["j", "k"]);

/**
 * Types for {@link treeNavigation}.
 */
export namespace TreeNavigation {
	/** The copy each key lists under in the help sheet; an omitted label keeps that key unlisted. */
	export interface Labels {
		/** The help-sheet heading the keys list under. */
		group?: string;
		next?: string;
		previous?: string;
		/** What → does: open a folder or step into it. */
		expand?: string;
		/** What ← does: close a folder or step out to its parent. */
		collapse?: string;
		first?: string;
		last?: string;
	}

	/** Options for {@link treeNavigation}. */
	export interface Options {
		/**
		 * The nearest ancestor matching this selector becomes the tree whose rows are walked,
		 * for a mixin carried by a marker element inside the tree rather than the tree itself.
		 */
		within?: string;
		labels?: Labels;
	}
}

/** One row as the keys see it, read from the DOM on every keystroke. */
interface Row {
	element: HTMLElement;
	level: number;
	/** The `<details>` this row is the summary of, for a folder. */
	folder: HTMLDetailsElement | null;
}

/** The folder a row opens, when the row is a `<details>` element's own summary. */
function folderOf(element: HTMLElement): HTMLDetailsElement | null {
	let parent = element.parentElement;
	return element.localName === "summary" && parent instanceof HTMLDetailsElement ? parent : null;
}

/**
 * Whether a row is on screen in the tree: neither it nor any ancestor below `host` is
 * hidden, and every folder around it is open. A folder's own summary shows while the folder
 * is closed, so the walk starts above it.
 */
function isReachable(host: HTMLElement, element: HTMLElement): boolean {
	if (element.hidden) return false;
	let node = folderOf(element) ?? element;
	for (
		let current = node.parentElement;
		current && current !== host;
		current = current.parentElement
	) {
		if (current.hidden) return false;
		if (current instanceof HTMLDetailsElement && !current.open) return false;
	}
	return !(node instanceof HTMLDetailsElement && node.hidden);
}

/** The rows a reader can reach right now, in document order. */
function visibleRows(host: HTMLElement): Row[] {
	return [...host.querySelectorAll<HTMLElement>(TREE_NAVIGATION_ROW_SELECTOR)]
		.filter((element) => element.getAttribute("aria-disabled") !== "true")
		.filter((element) => isReachable(host, element))
		.map((element) => ({
			element,
			level: Number(element.getAttribute("aria-level")) || 1,
			folder: folderOf(element),
		}));
}

/** The row holding focus, by index into `rows`, or `-1` when focus is elsewhere. */
function focusedIndex(host: HTMLElement, rows: Row[]): number {
	let active = host.ownerDocument.activeElement;
	return rows.findIndex((row) => row.element === active);
}

/**
 * Focuses `element`, retrying on a timer until it takes focus or `deadline` passes, so a
 * row in a folder that has only just opened still receives it.
 */
function focusWhenReady(element: HTMLElement, deadline: number): void {
	element.focus();
	if (element.ownerDocument.activeElement === element || Date.now() > deadline) return;
	setTimeout(() => {
		if (element.isConnected) focusWhenReady(element, deadline);
	}, 16);
}

/** Makes `row` the tree's one Tab stop, focuses it and scrolls it into view. */
function focusRow(host: HTMLElement, row: Row): void {
	setRovingTabindex(
		[...host.querySelectorAll<HTMLElement>(TREE_NAVIGATION_ROW_SELECTOR)],
		row.element,
	);
	focusWhenReady(row.element, Date.now() + FOCUS_RETRY_MS);
	row.element.scrollIntoView({ block: "nearest", inline: "nearest" });
}

/**
 * The row that starts as the Tab stop: the current file when the tree marks one, else the
 * first row.
 */
function initialRow(host: HTMLElement): HTMLElement | undefined {
	let rows = visibleRows(host);
	let current = rows.find((row) => row.element.getAttribute("aria-current") === "page");
	return (current ?? rows[0])?.element;
}

/**
 * Walks a tree's rows from the keyboard. Each key declines while focus is outside the tree,
 * so the page's own `j`/`k` and arrows keep working there, and printable keys search row
 * names (a row's `data-search-value`, else its text) from the focused row on.
 *
 * @param options Where the tree is, and the copy each key lists under.
 * @example <div role="tree" aria-label="Files" mix={[treeNavigation({ labels: { group: "Files", next: "Next file" } })]}>…</div>
 */
export const treeNavigation: MixinFactory<HTMLElement, [options?: TreeNavigation.Options]> =
	createMixin<HTMLElement, [options?: TreeNavigation.Options]>((handle) => {
		let options: TreeNavigation.Options = {};

		handle.addEventListener("insert", (event) => {
			let host: HTMLElement =
				options.within === undefined
					? event.node
					: (event.node.parentElement?.closest<HTMLElement>(options.within) ?? event.node);
			let registry = shortcutRegistry(host.ownerDocument);
			let signal = handle.signal;
			let labels = () => options.labels ?? {};
			let buffer = "";
			let resetBuffer: ReturnType<typeof setTimeout> | undefined;
			signal.addEventListener("abort", () => clearTimeout(resetBuffer));

			let start = initialRow(host);
			if (start !== undefined) {
				setRovingTabindex(
					[...host.querySelectorAll<HTMLElement>(TREE_NAVIGATION_ROW_SELECTOR)],
					start,
				);
			}

			host.addEventListener(
				"focusin",
				(focus) => {
					if (!(focus.target instanceof HTMLElement)) return;
					if (!focus.target.matches(TREE_NAVIGATION_ROW_SELECTOR)) return;
					setRovingTabindex(
						[...host.querySelectorAll<HTMLElement>(TREE_NAVIGATION_ROW_SELECTOR)],
						focus.target,
					);
				},
				{ signal },
			);

			/** Runs `move` with the visible rows and the focused one, declining when focus is outside the tree. */
			let withFocus = (move: (rows: Row[], index: number) => void) => (): boolean => {
				let rows = visibleRows(host);
				let index = focusedIndex(host, rows);
				if (index === -1) return false;
				move(rows, index);
				return true;
			};

			/** Registers one key binding scoped to the tree. */
			let bind = (keys: string[], label: string | undefined, run: () => boolean) =>
				registry.register({
					keys,
					label,
					group: labels().group,
					scope: host,
					priority: TREE_KEY_PRIORITY,
					run,
					signal,
				});

			bind(
				["arrowdown", "j"],
				labels().next,
				withFocus((rows, index) => {
					let next = rows[index + 1];
					if (next) focusRow(host, next);
				}),
			);
			bind(
				["arrowup", "k"],
				labels().previous,
				withFocus((rows, index) => {
					let previous = rows[index - 1];
					if (previous) focusRow(host, previous);
				}),
			);
			bind(
				["arrowright"],
				labels().expand,
				withFocus((rows, index) => {
					let row = rows[index]!;
					if (row.folder === null) return;
					if (!row.folder.open) {
						row.folder.open = true;
						return;
					}
					let child = rows[index + 1];
					if (child && child.level > row.level) focusRow(host, child);
				}),
			);
			bind(
				["arrowleft"],
				labels().collapse,
				withFocus((rows, index) => {
					let row = rows[index]!;
					if (row.folder?.open) {
						row.folder.open = false;
						return;
					}
					let parent = rows
						.slice(0, index)
						.reverse()
						.find((candidate) => candidate.level < row.level);
					if (parent) focusRow(host, parent);
				}),
			);
			bind(
				["home"],
				labels().first,
				withFocus((rows) => focusRow(host, rows[0]!)),
			);
			bind(
				["end"],
				labels().last,
				withFocus((rows) => focusRow(host, rows[rows.length - 1]!)),
			);

			host.addEventListener(
				"keydown",
				(key) => {
					if (key.defaultPrevented || !isPrintableKey(key) || key.key === " ") return;
					if (buffer === "" && MOVEMENT_LETTERS.has(key.key)) return;

					let rows = visibleRows(host);
					let index = focusedIndex(host, rows);
					if (index === -1) return;

					let order = [...rows.slice(index + 1), ...rows.slice(0, index + 1)];
					let find = (prefix: string) =>
						order.find((row) => labelFor(row.element).startsWith(prefix));
					let query = buffer + key.key.toLowerCase();
					let match = find(query);
					if (match === undefined && buffer !== "") {
						query = key.key.toLowerCase();
						match = find(query);
					}
					if (match === undefined) return;

					key.preventDefault();
					buffer = query;
					clearTimeout(resetBuffer);
					resetBuffer = setTimeout(() => {
						buffer = "";
					}, TYPEAHEAD_RESET_MS);
					focusRow(host, match);
				},
				{ signal },
			);
		});

		return (next = {}) => {
			options = next;
			return createElement(handle.element, {});
		};
	});
