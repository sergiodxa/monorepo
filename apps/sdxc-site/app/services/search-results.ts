/**
 * The search dialog's and the `/search` page's states, built from the matches a query
 * reached: rows whose title and description are already split into highlighted segments,
 * a tab per kind with its count, and pagination links that keep the query.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { HighlightSegment, ParsedQuery } from "@sdxc/search/query";
import type { ValidationError } from "@sdxc/validate";

import { Pagination } from "@sdxc/pagination";
import { highlight } from "@sdxc/search/query";

import type { SearchDocument, SearchKind } from "~/app/services/search-query";

import { SEARCH_KINDS } from "~/app/services/search-query";
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
				items: Array<Item>;
				/** The `/search` page for the same text and tab, where every match is paged. */
				seeAll: string;
				/** The tab the items belong to, `null` for every kind. */
				kind: SearchKind | null;
				/** "All" then each kind with matches; empty while one kind holds every match. */
				tabs: Array<Tab>;
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
	 * The dialog's state for a query: the first `limit` matches of the tab asked for. A tab
	 * naming a kind with no matches falls back to "All", so a tab that empties as the reader
	 * types never strands them; tabs show only while matches span more than one kind.
	 *
	 * @param input The typed text, its parsed query, every match, the tab asked for, and how many rows the dialog lists.
	 */
	static suggestions(input: {
		query: string;
		parsed: ParsedQuery;
		matches: ReadonlyArray<SearchDocument>;
		kind: SearchKind | null;
		limit: number;
	}): SearchResults.Suggestions {
		let counts = countKinds(input.matches);
		let kinds = SEARCH_KINDS.filter((kind) => counts[kind] > 0);
		let current = input.kind !== null && counts[input.kind] > 0 ? input.kind : null;
		let shown =
			current === null ? input.matches : input.matches.filter((match) => match.kind === current);
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
			items: shown.slice(0, input.limit).map((match) => item(match, input.parsed)),
			seeAll: searchHref(input.query, current),
			kind: current,
			tabs: kinds.length > 1 ? [tab(null), ...kinds.map(tab)] : [],
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
			items: items.map((match) => item(match, input.parsed)),
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

/** Highlights one match's title and description against the query that found it. */
function item(match: SearchDocument, parsed: ParsedQuery): SearchResults.Item {
	return {
		href: match.href,
		kind: match.kind,
		kindLabel: KIND_LABELS[match.kind],
		title: highlight(match.title, parsed),
		description: highlight(match.summary ?? `${match.page} · ${match.section}`, parsed),
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
