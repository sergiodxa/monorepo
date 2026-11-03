/**
 * Finishes a server-rendered docs sidebar in the browser: it opens scrolled to the current
 * page, in the docked column and again each time a drawer holding it opens, and an optional
 * field filters its pages by title while keeping each match's group open around it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ElementProps, MixinFactory } from "remix/component";

import { createMixin } from "remix/component";

import { filterWords, titleMatches } from "../utils/docs-filter.js";
import { revealInScroller } from "../utils/reveal-in-scroller.js";

/**
 * Works on the closest `[data-docs-nav]` around its host. The current link is the one with
 * `aria-current="page"`. When the host holds an `<input>`, typing hides every `li` whose
 * title misses the query, hides sections left empty, opens `<details>` groups holding a
 * match, and shows `[data-docs-nav-empty]` when nothing matches; clearing the field restores
 * every group's own open state. A page reload that resets the tree keeps the query applied,
 * and the field's form stays on the page, which without script submits to the server instead.
 *
 * @example
 * <div data-docs-nav><form mix={[docsNavTools()]}><input type="search" /></form><nav>…</nav></div>
 */
export const docsNavTools: MixinFactory<HTMLElement, [], ElementProps> = createMixin<
	HTMLElement,
	[],
	ElementProps
>((handle) => {
	let controller: AbortController | undefined;

	handle.addEventListener("insert", (event) => {
		controller?.abort();
		controller = new AbortController();
		enhance(event.node, controller.signal);
	});

	handle.addEventListener("remove", () => {
		controller?.abort();
		controller = undefined;
	});
});

/** Wires reveal-on-open and the filter for the nav around `host` until `signal` aborts. */
function enhance(host: HTMLElement, signal: AbortSignal) {
	let nav = host.closest<HTMLElement>("[data-docs-nav]");
	if (!nav) return;

	let reveal = () => {
		let current = nav.querySelector('[aria-current="page"]');
		if (current) revealInScroller(current, "center");
	};
	reveal();
	nav.closest("dialog")?.addEventListener("toggle", reveal, { signal });

	let input = host.querySelector("input");
	if (!input) return;
	host.addEventListener("submit", (event) => event.preventDefault(), { signal });
	let ownState = new Map<HTMLDetailsElement, boolean>();
	let snapshot = () => {
		ownState = new Map(
			[...nav.querySelectorAll("details")].map((group) => [group, ownOpen(group)]),
		);
	};
	snapshot();

	let observer = new MutationObserver((records) => {
		if (!input.value || !records.some(isReset)) return;
		snapshot();
		filterDocsNav(nav, input.value, ownState);
		observer.takeRecords();
	});
	let apply = () => {
		filterDocsNav(nav, input.value, ownState);
		observer.takeRecords();
	};
	observer.observe(nav, { subtree: true, childList: true, attributeFilter: ["hidden"] });
	signal.addEventListener("abort", () => observer.disconnect());
	input.addEventListener("input", apply, { signal });
	if (input.value) apply();
}

/** Whether `group` is open on its own, discounting a server render that opened it for a match. */
function ownOpen(group: HTMLDetailsElement): boolean {
	return group.open && !group.hasAttribute("data-docs-nav-opened");
}

/**
 * Whether `record` is a page reload putting the server's markup back: pages added or
 * replaced, or a page the filter hid shown again. The filter's own writes only hide.
 */
function isReset(record: MutationRecord): boolean {
	if (record.type === "childList") return true;
	return record.target instanceof HTMLElement && !record.target.hidden;
}

/**
 * Shows the pages whose title holds every word of `query`, case- and accent-insensitive,
 * with the groups and sections that contain them; a group whose own title matches keeps all
 * its pages. An empty query restores the full tree and each group's own open state.
 */
export function filterDocsNav(
	nav: HTMLElement,
	query: string,
	ownState: Map<HTMLDetailsElement, boolean>,
) {
	let words = filterWords(query);
	let empty = nav.querySelector<HTMLElement>("[data-docs-nav-empty]");
	let anyMatch = false;

	for (let section of nav.querySelectorAll<HTMLElement>("[data-docs-nav-section]")) {
		let visible = false;
		for (let item of section.querySelectorAll<HTMLLIElement>("[data-docs-nav-list] > li")) {
			visible = applyFilter(item, words) || visible;
		}
		section.hidden = !visible;
		anyMatch ||= visible;
	}

	if (words.length === 0) for (let [group, open] of ownState) group.open = open;
	if (empty) empty.hidden = anyMatch;
}

/** Shows or hides `item` and its nested pages for `words`; reports whether it stays shown. */
function applyFilter(item: HTMLLIElement, words: string[]): boolean {
	let title = item.querySelector(
		":scope > a [data-docs-nav-title], :scope > details > summary [data-docs-nav-title]",
	);
	let own = titleMatches(title?.textContent ?? "", words);
	let children = item.querySelectorAll<HTMLLIElement>(
		":scope > details > ul > li, :scope > ul > li",
	);
	let childShown = false;
	for (let child of children) childShown = applyFilter(child, own ? [] : words) || childShown;
	let group = item.querySelector<HTMLDetailsElement>(":scope > details");
	if (group && childShown && words.length > 0) group.open = true;
	item.hidden = !(own || childShown);
	return !item.hidden;
}
