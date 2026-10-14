/**
 * The run of page items a pager renders for one page of a result set: the first and last
 * page always, a window of neighbours around the current one, and an ellipsis standing in
 * for each stretch left out. Built as a list rather than a count so a pager renders it
 * directly and never has to decide where a gap falls while laying out markup.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Neighbours shown either side of the current page before a gap opens. */
const NEIGHBOURS = 1;

/** One item of a pager: a page to link to, or a gap standing in for the pages left out. */
export type PageItem = { kind: "page"; page: number } | { kind: "gap"; after: number };

/**
 * The items a pager shows for `current` out of `total` pages: page one, the pages within
 * one step of `current`, the last page, and a gap wherever that leaves a jump of more
 * than one. A total of seven or fewer pages fits without gaps and is returned in full.
 *
 * @param current - The page being shown, 1-based.
 * @param total - How many pages the result set has.
 * @returns The items in reading order.
 * @example pageWindow(4, 12).filter((item) => item.kind === "gap").length // 2
 */
export function pageWindow(current: number, total: number): PageItem[] {
	let pages = new Set<number>([1, total]);

	for (let page = current - NEIGHBOURS; page <= current + NEIGHBOURS; page++) {
		if (page >= 1 && page <= total) pages.add(page);
	}

	let items: PageItem[] = [];
	let previous = 0;

	for (let page of [...pages].sort((left, right) => left - right)) {
		if (previous !== 0 && page - previous > 1) items.push({ kind: "gap", after: previous });
		items.push({ kind: "page", page });
		previous = page;
	}

	return items;
}
