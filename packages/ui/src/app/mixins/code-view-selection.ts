/**
 * Line selection for a code view, from one listener on the view: a number click selects its
 * line, a shift-click a range, the address becomes `#L3-L8` in place, the band and line menu
 * follow, and the numbers are one Tab stop the arrow keys walk.
 * Why JS: ranges, an address rewritten without a navigation, and the clipboard need script.
 * No-JS baseline: every number links to `?L=n#Ln`, the server paints that line and
 * `:target` paints the line an address names.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ElementProps, MixinFactory } from "remix/component";

import { createElement, createMixin } from "remix/component";

import type { LineRange } from "../utils/line-range.js";

import { ESCAPE_PRIORITY, shortcutRegistry } from "../behaviors/shortcuts.js";
import { lineRangeHash, lineRangeQuery, parseLineRange } from "../utils/line-range.js";

/** Selector for the element a code view renders as its root. */
export const CODE_VIEW_SELECTOR = '[data-slot="code-view"]';

/** Attribute a selected row carries, which the view's styles paint as the band. */
export const CODE_VIEW_SELECTED_ATTRIBUTE = "data-selected";

/**
 * Attribute the view's root carries while this mixin owns the selection, which hands the
 * band from `:target` (fixed at load) to the rows it marks.
 */
export const CODE_VIEW_LIVE_ATTRIBUTE = "data-selection-live";

/** Attribute the view's root carries while a selection shows its line menu. */
export const CODE_VIEW_MENU_ATTRIBUTE = "data-line-menu";

/** Selector for a line's number link, whose `data-line-number` names its line. */
const NUMBER_SELECTOR = "a[data-line-number]";

/**
 * The line each key moves focus to from `line`, so the numbers are one Tab stop the arrows walk:
 * a line up or down, a screen up or down, or the first or last line.
 */
const LINE_STEPS: Record<string, (line: number, view: HTMLElement) => number> = {
	ArrowUp: (line) => Math.max(1, line - 1),
	ArrowDown: (line, view) => Math.min(lastLine(view), line + 1),
	PageUp: (line) => Math.max(1, line - 20),
	PageDown: (line, view) => Math.min(lastLine(view), line + 20),
	Home: () => 1,
	End: (_, view) => lastLine(view),
};

/** The view's last line number, read from its last number link. */
function lastLine(view: HTMLElement): number {
	let numbers = view.querySelectorAll(NUMBER_SELECTOR);
	return Number(numbers[numbers.length - 1]?.getAttribute("data-line-number") ?? 1);
}

/** Moves the numbers' one Tab stop from `from` to `to` and focuses `to`. */
function rove(from: HTMLElement | null, to: HTMLElement): void {
	if (from !== null && from !== to) from.tabIndex = -1;
	to.tabIndex = 0;
	to.focus();
}

/** Search parameter a server reads to paint a range without script. */
const LINE_PARAM = "L";

/** How long a copy action reads as done to a screen reader before the status clears. */
const COPIED_MS = 2000;

/**
 * Types for {@link codeViewSelection}.
 */
export namespace CodeViewSelection {
	/** The copy the keys list under in the help sheet, and the copy announced after a copy. */
	export interface Labels {
		/** Announced once a line or a permalink is on the clipboard. */
		copied: string;
		/** The help-sheet heading the keys list under. */
		group?: string;
		/** What `y` does, such as "Copy permalink to address bar". */
		permalinkKey?: string;
		/** What Escape does while lines are selected. */
		clearSelection?: string;
	}

	/** Options for {@link codeViewSelection}. */
	export interface Options {
		/** The address of this file at a fixed commit, which `y` and "Copy permalink" use. */
		permalink?: string;
		/** Where "Reference in new issue" goes, given the permalink under `issueParam`. */
		issueHref?: string;
		/** Search parameter `issueHref` receives the permalink under. @default "body" */
		issueParam?: string;
		labels: Labels;
	}
}

/** The view's state between events. */
interface Selection {
	anchor: number | undefined;
	range: LineRange | undefined;
}

/** The row of line `line` inside `root`, through its number's `id`. */
function rowOf(root: HTMLElement, line: number): HTMLTableRowElement | null {
	let number = root.ownerDocument.getElementById(`L${line}`);
	if (number === null || !root.contains(number)) return null;
	return number.closest("tr");
}

/** Marks the rows in `range` as selected and clears every row marked before. */
function paint(root: HTMLElement, range: LineRange | undefined): void {
	for (let row of root.querySelectorAll(`tr[${CODE_VIEW_SELECTED_ATTRIBUTE}]`)) {
		row.removeAttribute(CODE_VIEW_SELECTED_ATTRIBUTE);
	}
	if (range === undefined) return;
	for (let line = range.start; line <= range.end; line += 1) {
		rowOf(root, line)?.setAttribute(CODE_VIEW_SELECTED_ATTRIBUTE, "");
	}
}

/**
 * Moves the line menu beside the first selected line's number, through custom properties
 * on the root the menu reads its offsets from.
 */
function placeMenu(root: HTMLElement, range: LineRange | undefined): void {
	let row = range === undefined ? null : rowOf(root, range.start);
	let number = row?.querySelector<HTMLElement>(NUMBER_SELECTOR)?.parentElement;
	if (number == null) {
		root.removeAttribute(CODE_VIEW_MENU_ATTRIBUTE);
		return;
	}
	let box = root.getBoundingClientRect();
	let cell = number.getBoundingClientRect();
	root.style.setProperty("--code-view-menu-top", `${cell.top - box.top}px`);
	root.style.setProperty("--code-view-menu-start", `${cell.left - box.left}px`);
	root.setAttribute(CODE_VIEW_MENU_ATTRIBUTE, "");
}

/**
 * Rewrites the address for `range` without a navigation or a history entry, keeping the
 * state the router stored there. A `?L=` already in the address follows the range, so a
 * reload without script paints the same lines.
 */
function writeAddress(range: LineRange | undefined): void {
	let url = new URL(location.href);
	url.hash = range === undefined ? "" : lineRangeHash(range);
	if (url.searchParams.has(LINE_PARAM)) {
		if (range === undefined) url.searchParams.delete(LINE_PARAM);
		else url.searchParams.set(LINE_PARAM, lineRangeQuery(range));
	}
	if (url.href !== location.href) history.replaceState(history.state, "", url);
}

/** The text of the lines in `range`, one per line, as the source holds them. */
function linesText(root: HTMLElement, range: LineRange): string {
	let lines: string[] = [];
	for (let line = range.start; line <= range.end; line += 1) {
		lines.push(rowOf(root, line)?.lastElementChild?.textContent ?? "");
	}
	return lines.join("\n");
}

/** The permalink for `range`: the fixed-commit address, or this page's, with the range's fragment. */
function permalinkFor(permalink: string | undefined, range: LineRange | undefined): string {
	let url = new URL(permalink ?? location.href, location.href);
	url.searchParams.delete(LINE_PARAM);
	url.hash = range === undefined ? "" : lineRangeHash(range);
	return url.href;
}

/**
 * Owns a code view's line selection from inside the view's island: it reads the range from
 * the address (or the one the server painted), answers clicks on line numbers, `y` and
 * Escape, and runs the line menu's actions, marked `data-action` on its items.
 *
 * @param options The permalink, the issue address and the copy.
 * @example <div mix={[codeViewSelection({ permalink: "/blob/3f2a9c1/app.ts", labels: { copied: t("copied") } })]}>…menu…</div>
 */
export const codeViewSelection: MixinFactory<
	HTMLElement,
	[options: CodeViewSelection.Options],
	ElementProps
> = createMixin<HTMLElement, [options: CodeViewSelection.Options], ElementProps>((handle) => {
	let options: CodeViewSelection.Options = { labels: { copied: "" } };

	handle.addEventListener("insert", (event) => {
		let island = event.node;
		let root = island.closest<HTMLElement>(CODE_VIEW_SELECTOR);
		if (root === null) return;
		let view: HTMLElement = root;
		let signal = handle.signal;
		let state: Selection = { anchor: undefined, range: undefined };
		let clearStatus: ReturnType<typeof setTimeout> | undefined;
		signal.addEventListener("abort", () => clearTimeout(clearStatus));

		/** Paints `range`, moves the menu to it and keeps it as the anchor for the next shift-click. */
		let select = (range: LineRange | undefined, anchor = range?.start) => {
			state = { anchor, range };
			paint(view, range);
			placeMenu(view, range);
		};

		/** Says `copied` to a screen reader for a moment. */
		let announce = () => {
			let status = island.querySelector('[role="status"]');
			if (status === null) return;
			status.textContent = options.labels.copied;
			clearTimeout(clearStatus);
			clearStatus = setTimeout(() => {
				status.textContent = "";
			}, COPIED_MS);
		};

		view.setAttribute(CODE_VIEW_LIVE_ATTRIBUTE, "");
		signal.addEventListener("abort", () => view.removeAttribute(CODE_VIEW_LIVE_ATTRIBUTE));

		let fromHash = parseLineRange(location.hash);
		let initial = fromHash ?? parseLineRange(view.getAttribute("data-selection"));
		select(initial);
		if (fromHash !== undefined && fromHash.start !== fromHash.end) {
			rowOf(view, fromHash.start)?.scrollIntoView({ block: "center" });
		}

		view.addEventListener(
			"keydown",
			(press) => {
				if (
					!(press.target instanceof HTMLAnchorElement) ||
					!press.target.matches(NUMBER_SELECTOR)
				) {
					return;
				}
				let line = Number(press.target.getAttribute("data-line-number"));
				let next = LINE_STEPS[press.key]?.(line, view);
				if (next === undefined) return;
				let target = view.ownerDocument.getElementById(`L${next}`);
				if (!(target instanceof HTMLAnchorElement) || !view.contains(target)) return;
				press.preventDefault();
				rove(press.target, target);
			},
			{ signal },
		);

		view.addEventListener(
			"click",
			(click) => {
				if (!(click.target instanceof Element)) return;
				let number = click.target.closest<HTMLAnchorElement>(NUMBER_SELECTOR);
				if (number === null || !view.contains(number)) return;
				click.preventDefault();
				rove(view.querySelector<HTMLAnchorElement>(`${NUMBER_SELECTOR}[tabindex="0"]`), number);

				let line = Number(number.getAttribute("data-line-number"));
				let anchor = state.anchor;
				if (click.shiftKey && anchor !== undefined) {
					select({ start: Math.min(anchor, line), end: Math.max(anchor, line) }, anchor);
				} else {
					select({ start: line, end: line });
				}
				writeAddress(state.range);
			},
			{ signal },
		);

		island.addEventListener(
			"click",
			async (click) => {
				if (!(click.target instanceof Element)) return;
				let item = click.target.closest<HTMLElement>("[data-action]");
				let range = state.range;
				if (item === null || range === undefined) return;
				let action = item.getAttribute("data-action");

				if (action === "reference" && item instanceof HTMLAnchorElement && options.issueHref) {
					let target = new URL(options.issueHref, location.href);
					target.searchParams.set(
						options.issueParam ?? "body",
						permalinkFor(options.permalink, range),
					);
					item.href = target.href;
					return;
				}

				let text =
					action === "copy-line" ? linesText(view, range) : permalinkFor(options.permalink, range);
				item.closest<HTMLElement>("[popover]")?.hidePopover();
				try {
					await navigator.clipboard.writeText(text);
				} catch {
					return;
				}
				if (!signal.aborted) announce();
			},
			{ signal },
		);

		window.addEventListener(
			"hashchange",
			() => {
				let range = parseLineRange(location.hash);
				if (range !== undefined) select(range);
			},
			{ signal },
		);

		let resize = new ResizeObserver(() => placeMenu(view, state.range));
		resize.observe(view);
		signal.addEventListener("abort", () => resize.disconnect());

		let registry = shortcutRegistry(view.ownerDocument);
		registry.register({
			keys: "y",
			label: options.labels.permalinkKey,
			group: options.labels.group,
			scope: view,
			run: () => {
				if (options.permalink === undefined) return false;
				let url = new URL(options.permalink, location.href);
				let current = new URL(location.href);
				url.hash = current.hash;
				let line = current.searchParams.get(LINE_PARAM);
				if (line !== null) url.searchParams.set(LINE_PARAM, line);
				history.replaceState(history.state, "", url);
				return true;
			},
			signal,
		});
		registry.register({
			keys: "escape",
			label: options.labels.clearSelection,
			group: options.labels.group,
			scope: view,
			priority: ESCAPE_PRIORITY.selection,
			run: (key) => {
				if (state.range === undefined) return false;
				if (key.target instanceof Node && island.contains(key.target)) return false;
				select(undefined);
				writeAddress(undefined);
				return true;
			},
			signal,
		});
	});

	return (next) => {
		options = next;
		return createElement(handle.element, {});
	};
});
