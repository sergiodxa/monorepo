/**
 * View model for the `/search` page and the search dialog. Turns search results into rows
 * whose title and excerpt are already split into highlighted segments, and pagination into
 * links that keep the query, so the templates render `<mark>` with no matching logic.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Page, Pagination } from "@sdxc/pagination";
import type { Excerpt, HighlightSegment, ParsedQuery } from "@sdxc/search/query";
import type { ValidationError } from "@sdxc/validate";

import { Markdown } from "@sdxc/markdown";
import { toPlainText } from "@sdxc/markdown/plain";
import { isFailure } from "@sdxc/result";
import { excerpt, highlight } from "@sdxc/search/query";

import type { Kind } from "~/app/models/kinds";
import type { PostSearch } from "~/app/models/search";

import { KINDS, POST_KINDS } from "~/app/models/kinds";
import routes from "~/routes/web";

/**
 * Contracts for the search page template: which of its three states it renders, and the
 * render-ready values each state carries.
 */
export namespace SearchViewModel {
	/** One result row. */
	export interface Item {
		/** App-relative link to the post; a glossary entry links to its anchor on `/glossary`. */
		href: string;
		kind: Kind;
		/** Human label for the result's content type, which names its icon. */
		kindLabel: string;
		title: Array<HighlightSegment>;
		/**
		 * A window of the post's text around its first match: the summary when it holds one,
		 * otherwise the body as plain text. A glossary entry always shows its definition, and
		 * text holding no match shows its opening words. `null` when the post has no text.
		 */
		excerpt: Excerpt | null;
		/** ISO 8601 instant the post was published, or `null` when it has none to show. */
		publishedAt: string | null;
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
	 * Everything the template renders. `blank` is an empty box, `invalid` a query with
	 * nothing to search for or over a limit, and `results` a page of matches, possibly none.
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
				/** What the signed-in author can do with this search as a topic; `null` for readers. */
				topic: TopicLink | null;
		  };

	/**
	 * The author's way from a search to its topic: the CMS form prefilled with the query, or
	 * the topic already saving this search, whatever spelling it was typed in.
	 */
	export type TopicLink =
		| { type: "save"; href: string }
		| { type: "saved"; title: string; href: string };

	/**
	 * One tab over the dialog's matches: "All" when `kind` is `null`, otherwise one kind with
	 * matches. `href` is the `/search` page narrowed the same way, which a click without
	 * script follows.
	 */
	export interface Tab {
		kind: Kind | null;
		label: string;
		count: number;
		href: string;
		current: boolean;
	}

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
				kind: Kind | null;
				/** "All" then each kind with matches; empty while one kind holds every match. */
				tabs: Array<Tab>;
		  };
}

/** Words of excerpt each result shows around its first match. */
const EXCERPT_WORDS = 28;

/** Builds the search page's and the search dialog's states from what a controller resolved. */
export class SearchViewModel {
	/** The box before anybody typed, on the page and in the dialog alike. */
	static blank(): Extract<SearchViewModel.Model, { state: "blank" }> {
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
	): Extract<SearchViewModel.Model, { state: "invalid" }> {
		let message = error.issues[0]?.message ?? "This search cannot run.";
		return { state: "invalid", query, message };
	}

	/**
	 * A page of results, highlighted against the query that found them, with pager links
	 * built from the request URL so every other parameter, `q` included, carries over.
	 *
	 * @param input The typed text, its parsed query, the page of results, the request URL, and the author's topic link, omitted for a reader.
	 */
	static results(input: {
		query: string;
		parsed: ParsedQuery;
		page: Page<PostSearch.Hit>;
		url: URL;
		topic?: SearchViewModel.TopicLink | null;
	}): SearchViewModel.Model {
		let { pagination } = input.page;

		return {
			state: "results",
			query: input.query,
			total: pagination.total,
			from: pagination.from,
			to: pagination.to,
			items: input.page.items.map((result) => this.item(result, input.parsed)),
			pager: pagination.pages > 1 ? this.pager(pagination, input.url) : null,
			topic: input.topic ?? null,
		};
	}

	/**
	 * The search dialog's state for a query. Its blank and invalid states mirror the page's,
	 * so the box answers the same way in both places. Tabs show only while matches span
	 * more than one kind, since a lone kind's tab would repeat "All".
	 *
	 * @param input The typed text, its parsed query, the first page of matches, the tab they were narrowed to, and how many matches each kind holds.
	 */
	static suggestions(input: {
		query: string;
		parsed: ParsedQuery;
		page: Page<PostSearch.Hit>;
		kind: Kind | null;
		counts: Record<Kind, number>;
	}): SearchViewModel.Suggestions {
		let kinds = KINDS.filter((kind) => input.counts[kind] > 0);
		let all = kinds.reduce((sum, kind) => sum + input.counts[kind], 0);
		let tab = (kind: Kind | null): SearchViewModel.Tab => ({
			kind,
			label: kind === null ? "All" : POST_KINDS[kind].plural,
			count: kind === null ? all : input.counts[kind],
			href: searchHref(input.query, kind),
			current: kind === input.kind,
		});

		return {
			state: "results",
			query: input.query,
			total: input.page.pagination.total,
			items: input.page.items.map((result) => this.item(result, input.parsed)),
			seeAll: searchHref(input.query, input.kind),
			kind: input.kind,
			tabs: kinds.length > 1 ? [tab(null), ...kinds.map(tab)] : [],
		};
	}

	/** Highlights one result's title and excerpt against the query it was found with. */
	private static item(hit: PostSearch.Hit, parsed: ParsedQuery): SearchViewModel.Item {
		return {
			href: hit.url,
			kind: hit.kind,
			kindLabel: POST_KINDS[hit.kind].label,
			title: highlight(hit.title, parsed, { field: "title" }),
			excerpt: this.excerpt(hit, parsed),
			publishedAt: hit.publishedAt,
		};
	}

	/**
	 * Picks the text a result shows. The summary wins when it holds a match, the body when
	 * only the body does, and with no match in either the summary's (or body's) opening
	 * words stand in. A post's body is read as plain text, so no Markdown syntax shows.
	 */
	private static excerpt(hit: PostSearch.Hit, parsed: ParsedQuery): Excerpt | null {
		let window = (text: string) => excerpt(text, parsed, { words: EXCERPT_WORDS });
		let summary = hit.kind === "glossary" ? plainText(hit.body) : (hit.excerpt?.trim() ?? "");

		let fromSummary = summary === "" ? null : window(summary);
		if (hit.kind === "glossary" || (fromSummary && hasMatch(fromSummary))) return fromSummary;

		let body = hit.kind === "bookmark" ? oneLine(hit.body) : plainText(hit.body);
		let fromBody = body === "" ? null : window(body);
		if (fromBody && hasMatch(fromBody)) return fromBody;
		return fromSummary ?? fromBody;
	}

	/**
	 * The numbered pager, every link the current URL with only its `page` replaced, so any
	 * listing paged by `?page=` keeps the rest of its query string.
	 *
	 * @param pagination The page's arithmetic.
	 * @param url The request URL the links are built from.
	 */
	static pager(pagination: Pagination, url: URL): SearchViewModel.Pager {
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
				.map((item) =>
					item.type === "gap"
						? item
						: { type: "page", page: item.page, href: href(item.page), current: item.current },
				),
		};
	}
}

/**
 * The `/search` page for `query`, narrowed to `kind` with the search syntax's own `kind:`
 * filter, so the page needs no parameter beyond `q`.
 */
function searchHref(query: string, kind: Kind | null): string {
	let q = kind === null ? query : `${query.trim()} kind:${kind}`;
	return `${routes.search.href()}?${new URLSearchParams({ q })}`;
}

/** Whether a window of text shows any of the words the query matched. */
function hasMatch(window: Excerpt): boolean {
	return window.segments.some((segment) => segment.match);
}

/**
 * Markdown read as the prose a reader sees, as one line. Text that will not parse is shown
 * as written.
 */
function plainText(markdown: string): string {
	let parsed = Markdown.parse(markdown);
	return oneLine(isFailure(parsed) ? markdown : toPlainText(parsed.data.document));
}

/**
 * Text with its whitespace collapsed to single spaces, so a window reads as one line; a
 * bookmark's address and description are read this way, since both are plain text.
 */
function oneLine(text: string): string {
	return text.replace(/\s+/g, " ").trim();
}
