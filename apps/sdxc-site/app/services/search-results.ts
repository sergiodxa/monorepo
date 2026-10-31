/**
 * The search dialog's and the `/search` page's states, built from the matches a query
 * reached: rows whose title and description are already split into highlighted segments,
 * a tab per kind with its count, heading rows grouped under their page, and pagination links
 * that keep the query.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { HighlightSegment, ParsedQuery } from "@sdxc/search/query";
import type { ValidationError } from "@sdxc/validate";

import { Pagination } from "@sdxc/pagination";
import { highlight } from "@sdxc/search/query";

import type { SearchDocument, SearchKind } from "~/app/services/search-query";

import { SEARCH_KINDS, withoutKindFilters } from "~/app/services/search-query";
import routes from "~/routes/web";

/** The states the search templates render, and the render-ready values each one carries. */
export namespace SearchResults {
	/** One result row. */
	export interface Item {
		/** The page, carrying the heading fragment for a heading. */
		href: string;
		kind: SearchKind;
		/** The tab's name for the kind, which the row's icon is announced as. */
		kindLabel: string;
		title: Array<HighlightSegment>;
		/** The page's summary, or for a heading the page and section it sits in. */
		description: Array<HighlightSegment>;
		/**
		 * Whether the row is a heading listed under its page's row, drawn indented on a rail
		 * with its title alone, since the page row above names where it sits.
		 */
		nested: boolean;
	}

	/**
	 * One tab over the dialog's matches: "All" when `kind` is `null`, otherwise one kind with
	 * matches. `href` is the `/search` page narrowed the same way, which a click without
	 * script follows.
	 */
	export interface Tab {
		kind: SearchKind | null;
		label: string;
		count: number;
		href: string;
		current: boolean;
	}

	/** One entry of the numbered pager: a page link, or a gap where numbers are elided. */
	export type PagerItem =
		| { type: "page"; page: number; href: string; current: boolean }
		| { type: "gap" };

	/** Links to the neighbouring pages and every page number worth showing. */
	export interface Pager {
		prev: string | null;
		next: string | null;
		items: Array<PagerItem>;
	}

	/**
	 * What the `/search` page renders: an empty box, a query that cannot run, or a page of
	 * matches, possibly none.
	 */
	export type Model =
		| { state: "blank"; query: "" }
		| { state: "invalid"; query: string; message: string }
		| {
				state: "results";
				query: string;
				total: number;
				from: number;
				to: number;
				items: Array<Item>;
				/** `null` when every match fits on one page. */
				pager: Pager | null;
		  };

	/**
	 * What the search dialog's frame renders under its box: nothing yet, why the text cannot
	 * run, or the top matches with the total and a link to every one of them on `/search`.
	 */
	export type Suggestions =
		| { state: "blank"; query: "" }
		| { state: "invalid"; query: string; message: string }
		| {
				state: "results";
				query: string;
				total: number;
				/** How many of the matches the rows list; a page row holding only headings adds a row, not a match. */
				listed: number;
				items: Array<Item>;
				/** The `/search` page for the same text and tab, where every match is paged. */
				seeAll: string;
				/** The tab the items belong to, `null` for every kind. */
				kind: SearchKind | null;
				/** "All" then each kind with matches; empty while one kind holds every match. */
				tabs: Array<Tab>;
				/**
				 * With no matches, each kind the same words reach once the typed `kind:` filters are
				 * dropped, linking to `/search` for it; empty otherwise.
				 */
				elsewhere: Array<Tab>;
		  };
}

/** The name each kind's tab, row icon and `kind:` help go by. */
export const KIND_LABELS: Record<SearchKind, string> = {
	guide: "Guides",
	api: "API",
	u: "U",
	ui: "UI",
};

/** Builds the search page's and the search dialog's states from what a controller matched. */
export class SearchResults {
	/** The box before anybody typed, on the page and in the dialog alike. */
	static blank(): { state: "blank"; query: "" } {
		return { state: "blank", query: "" };
	}

	/**
	 * A query that cannot run, keeping the text in the box so the reader can edit it.
	 *
	 * @param query The text as typed.
	 * @param error Why it cannot run; its first issue is the message shown.
	 */
	static invalid(
		query: string,
		error: ValidationError,
	): { state: "invalid"; query: string; message: string } {
		let message = error.issues[0]?.message ?? "This search cannot run.";
		return { state: "invalid", query, message };
	}

	/**
	 * The dialog's state for a query: the top matches of the tab asked for, as many as fill
	 * `limit` rows once grouped under their pages. A tab
	 * naming a kind with no matches falls back to "All", so a tab that empties as the reader
	 * types never strands them; tabs show only while matches span more than one kind.
	 *
	 * @param input The typed text, its parsed query, every match, the tab asked for, how many matches the dialog lists, and what the words match with their `kind:` filters dropped.
	 */
	static suggestions(input: {
		query: string;
		parsed: ParsedQuery;
		matches: ReadonlyArray<SearchDocument>;
		kind: SearchKind | null;
		limit: number;
		unfiltered?: ReadonlyArray<SearchDocument>;
	}): SearchResults.Suggestions {
		let counts = countKinds(input.matches);
		let kinds = SEARCH_KINDS.filter((kind) => counts[kind] > 0);
		let current = input.kind !== null && counts[input.kind] > 0 ? input.kind : null;
		let shown =
			current === null ? input.matches : input.matches.filter((match) => match.kind === current);
		let listed = fillRows(shown, input.limit);
		let tab = (kind: SearchKind | null): SearchResults.Tab => ({
			kind,
			label: kind === null ? "All" : KIND_LABELS[kind],
			count: kind === null ? input.matches.length : counts[kind],
			href: searchHref(input.query, kind),
			current: kind === current,
		});

		return {
			state: "results",
			query: input.query,
			total: shown.length,
			listed: listed.length,
			items: groupByPage(listed, input.parsed),
			seeAll: searchHref(input.query, current),
			kind: current,
			tabs: kinds.length > 1 ? [tab(null), ...kinds.map(tab)] : [],
			elsewhere: input.matches.length === 0 ? elsewhere(input.query, input.unfiltered ?? []) : [],
		};
	}

	/**
	 * One page of every match, clamped to the last page, with pager links built from the
	 * request URL so every other parameter, `q` included, carries over.
	 *
	 * @param input The typed text, its parsed query, every match, the page asked for, how many a page holds, and the request URL.
	 */
	static results(input: {
		query: string;
		parsed: ParsedQuery;
		matches: ReadonlyArray<SearchDocument>;
		page: number;
		perPage: number;
		url: URL;
	}): SearchResults.Model {
		let pagination = new Pagination({
			page: input.page,
			perPage: input.perPage,
			total: input.matches.length,
		});
		let items = input.matches.slice(pagination.offset, pagination.offset + pagination.perPage);

		return {
			state: "results",
			query: input.query,
			total: pagination.total,
			from: pagination.from,
			to: pagination.to,
			items: groupByPage(items, input.parsed),
			pager: pagination.pages > 1 ? pager(pagination, input.url) : null,
		};
	}
}

/** How many matches each kind holds, zero for a kind with none. */
function countKinds(matches: ReadonlyArray<SearchDocument>): Record<SearchKind, number> {
	let counts: Record<SearchKind, number> = { guide: 0, api: 0, u: 0, ui: 0 };
	for (let match of matches) counts[match.kind] += 1;
	return counts;
}

/**
 * A tab per kind the unfiltered matches reach, each linking to `/search` for the typed words
 * without their `kind:` filters, narrowed to that kind.
 */
function elsewhere(
	query: string,
	unfiltered: ReadonlyArray<SearchDocument>,
): Array<SearchResults.Tab> {
	let counts = countKinds(unfiltered);
	let words = withoutKindFilters(query);
	return SEARCH_KINDS.filter((kind) => counts[kind] > 0).map((kind) => ({
		kind,
		label: KIND_LABELS[kind],
		count: counts[kind],
		href: searchHref(words, kind),
		current: false,
	}));
}

/**
 * The leading matches that fit in `rows` rows once grouped: a page costs one row, a heading
 * one more, plus one for its page's row the first time that page appears.
 */
function fillRows(matches: ReadonlyArray<SearchDocument>, rows: number): Array<SearchDocument> {
	let pages = new Set<string>();
	let used = 0;
	let taken: Array<SearchDocument> = [];
	for (let match of matches) {
		let page = pageHref(match);
		let cost = pages.has(page) ? Number(isHeading(match)) : 1 + Number(isHeading(match));
		if (used + cost > rows) break;
		used += cost;
		pages.add(page);
		taken.push(match);
	}
	return taken;
}

/** The page a match belongs to: its address without the heading fragment. */
function pageHref(match: SearchDocument): string {
	return match.href.split("#")[0] ?? match.href;
}

/** Whether a match is a heading inside a page rather than the page itself. */
function isHeading(match: SearchDocument): boolean {
	return match.href.includes("#");
}

/**
 * Lists the matches page by page, in the order each page first ranks: the page's row, then
 * every heading match inside it nested under it. A page whose headings matched but whose own
 * entry did not still gets a row, named after the page and its section, to hold them.
 */
function groupByPage(
	matches: ReadonlyArray<SearchDocument>,
	parsed: ParsedQuery,
): Array<SearchResults.Item> {
	let groups = new Map<string, { page: SearchDocument | null; headings: SearchDocument[] }>();

	for (let match of matches) {
		let key = pageHref(match);
		let group = groups.get(key) ?? { page: null, headings: [] };
		if (isHeading(match)) group.headings.push(match);
		else group.page = match;
		groups.set(key, group);
	}

	let items: Array<SearchResults.Item> = [];
	for (let [href, group] of groups) {
		let first = group.page ?? group.headings[0];
		if (!first) continue;
		items.push(
			group.page
				? item(group.page, parsed, false)
				: {
						href,
						kind: first.kind,
						kindLabel: KIND_LABELS[first.kind],
						title: highlight(first.page, parsed),
						description: highlight(first.section, parsed),
						nested: false,
					},
		);
		for (let heading of group.headings) items.push(item(heading, parsed, true));
	}
	return items;
}

/**
 * A summary with its Markdown code spans unwrapped, since a row draws plain text and a raw
 * backtick would read as part of the name it wraps.
 */
function withoutCodeTicks(text: string): string {
	return text.replace(/`([^`]+)`/g, "$1");
}

/** Highlights one match's title and description against the query that found it. */
function item(match: SearchDocument, parsed: ParsedQuery, nested: boolean): SearchResults.Item {
	return {
		href: match.href,
		kind: match.kind,
		kindLabel: KIND_LABELS[match.kind],
		title: highlight(match.title, parsed),
		description: highlight(
			withoutCodeTicks(match.summary ?? `${match.page} · ${match.section}`),
			parsed,
		),
		nested,
	};
}

/**
 * The numbered pager, every link the current URL with only its `page` replaced, so the
 * query and any other parameter carry over.
 */
function pager(pagination: Pagination, url: URL): SearchResults.Pager {
	let href = (number: number) => {
		let target = new URL(url);
		target.searchParams.set("page", String(number));
		return `${target.pathname}${target.search}`;
	};

	return {
		prev: pagination.prev === null ? null : href(pagination.prev),
		next: pagination.next === null ? null : href(pagination.next),
		items: pagination
			.series()
			.map((entry) =>
				entry.type === "gap"
					? entry
					: { type: "page", page: entry.page, href: href(entry.page), current: entry.current },
			),
	};
}

/**
 * The `/search` page for `query`, narrowed to `kind` with the search syntax's own `kind:`
 * filter, so the page needs no parameter beyond `q`.
 */
function searchHref(query: string, kind: SearchKind | null): string {
	let q = kind === null ? query : `${query.trim()} kind:${kind}`;
	return `${routes.search.href()}?${new URLSearchParams({ q })}`;
}
