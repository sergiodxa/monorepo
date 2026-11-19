/**
 * The shop's queries: the facets a collection page filters by (read from and written to the
 * address with `@sdxc/facets`), its sorts and pages, and search with suggestions and a
 * "did you mean" for a typo. Every list is a pure function of the address, so a filtered page
 * is a link anyone can open.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createFacets } from "@sdxc/facets";
import { isFailure } from "@sdxc/result";

import type { Collection, Poster } from "./data";

import {
	ARTISTS,
	PAINTS,
	POSTERS,
	ROOMS,
	STYLES,
	findArtist,
	fromPrice,
	inStock,
	ratingOf,
} from "./data";

/** The facets a collection page filters by; the price facet reads whole euros, as the form's fields do. */
export const POSTER_FACETS = createFacets<Poster>()
	.terms("style", (poster) => poster.style, { values: STYLES.map((style) => style.id) })
	.terms("color", (poster) => poster.paints, { values: PAINTS.map((paint) => paint.id) })
	.terms("artist", (poster) => poster.artist, { values: ARTISTS.map((artist) => artist.id) })
	.terms("orientation", (poster) => poster.orientation, { values: ["portrait", "landscape"] })
	.range("price", (poster) => fromPrice(poster) / 100, { buckets: [0, 20, 25, 30] })
	.toggle("sale", (poster) => poster.sale !== undefined)
	.toggle("framed", inStock, { param: "ready" });

/** The facets' selection. */
export type PosterFilters = ReturnType<typeof POSTER_FACETS.empty>;

/** A sort a collection page offers. */
export interface Sort {
	id: string;
	label: string;
	compare: (a: Poster, b: Poster) => number;
}

/** The sorts, the default first. */
export const SORTS: Sort[] = [
	{ id: "featured", label: "Featured", compare: (a, b) => a.featured - b.featured },
	{ id: "newest", label: "Newest", compare: (a, b) => b.added - a.added },
	{
		id: "price-asc",
		label: "Price, low to high",
		compare: (a, b) => fromPrice(a) - fromPrice(b) || a.featured - b.featured,
	},
	{
		id: "price-desc",
		label: "Price, high to low",
		compare: (a, b) => fromPrice(b) - fromPrice(a) || a.featured - b.featured,
	},
	{
		id: "rating",
		label: "Top rated",
		compare: (a, b) => ratingOf(b).average - ratingOf(a).average || a.featured - b.featured,
	},
];

/** How many posters a page of the grid shows; "Show more" adds this many again. */
export const PAGE_SIZE = 12;

/** A collection page's place: which collection, the parsed query, the sort and how many pages. */
export interface ShopQuery {
	collection: Collection | null;
	filters: PosterFilters;
	sort: Sort;
	pages: number;
	/** The parameters a malformed filter carried, which the page reports. */
	issues: string[];
}

/** The posters a collection holds before any filter. */
export function collectionPosters(collection: Collection | null): Poster[] {
	if (collection === null) return POSTERS;
	return POSTERS.filter((poster) =>
		collection.kind === "style"
			? poster.style === collection.id
			: poster.rooms.includes(collection.id),
	);
}

/** A collection by its path segment. */
export function findCollection(id: string): Collection | undefined {
	return [...STYLES, ...ROOMS].find((collection) => collection.id === id);
}

/**
 * Reads a collection page's query. A malformed filter is dropped and named, so a stale link
 * still opens the collection rather than an error page.
 */
export function readShopQuery(collection: Collection | null, params: URLSearchParams): ShopQuery {
	let parsed = POSTER_FACETS.parse(params);
	let issues: string[] = [];
	let filters = POSTER_FACETS.empty();
	if (isFailure(parsed)) {
		issues = parsed.error.issues.map((issue) => {
			let first = issue.path?.[0];
			return typeof first === "object" ? String(first.key) : String(first ?? "");
		});
		let clean = new URLSearchParams(params);
		for (let name of issues) clean.delete(name);
		let retry = POSTER_FACETS.parse(clean);
		if (!isFailure(retry)) filters = retry.data;
	} else {
		filters = parsed.data;
	}
	let sort = SORTS.find((entry) => entry.id === params.get("sort")) ?? SORTS[0]!;
	let pages = Math.min(Math.max(Number.parseInt(params.get("page") ?? "1", 10) || 1, 1), 10);
	return { collection, filters, sort, pages, issues };
}

/** The grid's posters for a query, their total and every facet's counts. */
export function runShopQuery(query: ShopQuery) {
	let result = POSTER_FACETS.apply(collectionPosters(query.collection), query.filters);
	let sorted = [...result.items].sort(query.sort.compare);
	return {
		posters: sorted.slice(0, query.pages * PAGE_SIZE),
		total: result.total,
		more: sorted.length > query.pages * PAGE_SIZE,
		counts: result.counts,
	};
}

/**
 * A link to the collection page with other filters, keeping the sort and dropping the page,
 * so a changed filter starts from the top.
 */
export function shopLink(
	base: string,
	params: URLSearchParams,
	filters: Partial<ShopQuery["filters"]>,
): string {
	let keep = new URLSearchParams(params);
	keep.delete("page");
	let query = POSTER_FACETS.serialize(filters, keep).toString();
	return query === "" ? base : `${base}?${query}`;
}

/** What a search box suggests as the shopper types: posters, artists and collections. */
export interface Suggestion {
	kind: "poster" | "artist" | "collection";
	id: string;
	label: string;
	detail: string;
}

/** Lowercases and strips accents, so "Mérida" and "merida" match. */
function fold(text: string): string {
	return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** The words a poster is found by. */
function haystack(poster: Poster): string {
	let artist = findArtist(poster.artist)?.name ?? "";
	return fold(
		[poster.title, artist, poster.style, poster.blurb, ...poster.paints, ...poster.rooms].join(" "),
	);
}

/** The posters matching every word of a query, best (title) matches first. */
export function searchPosters(query: string): Poster[] {
	let words = fold(query)
		.split(/\s+/)
		.filter((word) => word !== "");
	if (words.length === 0) return [];
	return POSTERS.filter((poster) => words.every((word) => haystack(poster).includes(word))).sort(
		(a, b) => {
			let at = fold(a.title).includes(words[0]!) ? 0 : 1;
			let bt = fold(b.title).includes(words[0]!) ? 0 : 1;
			return at - bt || a.featured - b.featured;
		},
	);
}

/** Up to eight suggestions for what a shopper has typed so far. */
export function suggest(query: string): Suggestion[] {
	let wanted = fold(query.trim());
	if (wanted === "") return [];
	let collections = [...STYLES, ...ROOMS]
		.filter((collection) => fold(collection.name).includes(wanted))
		.map((collection): Suggestion => ({
			kind: "collection",
			id: collection.id,
			label: collection.name,
			detail: collection.kind === "style" ? "Style" : "Room",
		}));
	let artists = ARTISTS.filter((artist) => fold(artist.name).includes(wanted)).map(
		(artist): Suggestion => ({
			kind: "artist",
			id: artist.id,
			label: artist.name,
			detail: `Artist · ${artist.city}`,
		}),
	);
	let posters = searchPosters(query).map((poster): Suggestion => ({
		kind: "poster",
		id: poster.id,
		label: poster.title,
		detail: findArtist(poster.artist)?.name ?? "",
	}));
	return [...collections, ...artists, ...posters].slice(0, 8);
}

/** The edit distance between two short words, for "did you mean". */
function distance(a: string, b: string): number {
	let row = Array.from({ length: b.length + 1 }, (_, index) => index);
	for (let i = 1; i <= a.length; i += 1) {
		let previous = row[0]!;
		row[0] = i;
		for (let j = 1; j <= b.length; j += 1) {
			let current = row[j]!;
			row[j] = Math.min(row[j]! + 1, row[j - 1]! + 1, previous + (a[i - 1] === b[j - 1] ? 0 : 1));
			previous = current;
		}
	}
	return row[b.length]!;
}

/** The closest catalogue word to a query that found nothing, or `null` when none is close. */
export function didYouMean(query: string): string | null {
	let wanted = fold(query.trim());
	if (wanted.length < 3) return null;
	let words = new Set(
		POSTERS.flatMap((poster) => haystack(poster).split(/[^a-z0-9]+/)).filter(
			(word) => word.length > 2,
		),
	);
	let best: { word: string; score: number } | null = null;
	for (let word of words) {
		let score = distance(wanted, word);
		if (
			score <= Math.max(1, Math.floor(wanted.length / 4)) &&
			(best === null || score < best.score)
		)
			best = { word, score };
	}
	return best?.word ?? null;
}
