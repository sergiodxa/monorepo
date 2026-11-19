/**
 * A Wayfern search as its address carries it: where, the dates, the party and every filter.
 * Reading and writing it in one place keeps each list a link someone can send, and lets every
 * link on a results screen change one thing while keeping the rest.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Amenity, Place, Stay, StayType } from "./data";

import { AMENITIES, PLACES, STAYS, STAY_TYPES, findPlace } from "./data";
import { addDays, readDay } from "./days";
import { isBooked } from "./pricing";
import { toLngLat } from "./region";

/** How the results are ordered. */
export type Sort = "recommended" | "price-low" | "price-high" | "rating";

/** The sorts the results offer, in menu order. */
export const SORTS: Array<{ id: Sort; label: string }> = [
	{ id: "recommended", label: "Recommended" },
	{ id: "price-low", label: "Price: low to high" },
	{ id: "price-high", label: "Price: high to low" },
	{ id: "rating", label: "Top rated" },
];

/** The price slider's bounds, in whole dollars a night. */
export const PRICE_BOUNDS = { min: 50, max: 450, step: 10 } as const;

/** A search, read from an address. Missing values mean "any". */
export interface Search {
	/** A place id, when the box names one. */
	place?: string;
	/** What the visitor typed when it names no place, matched against stay names. */
	text?: string;
	start?: string;
	end?: string;
	adults: number;
	children: number;
	types: StayType[];
	amenities: Amenity[];
	/** Nightly price bounds in whole dollars, when narrowed. */
	min?: number;
	max?: number;
	sort: Sort;
	/** The phone's map/list toggle; the wide layout always shows both. */
	view: "list" | "map";
	/** "Search this area": only stays inside `west,south,east,north`. */
	bounds?: [number, number, number, number];
	/** Where the map was left, so a moved map comes back the same after a search. */
	camera?: { center: [number, number]; zoom: number };
}

/** Reads a whole number within bounds, falling back when the text is anything else. */
function readCount(text: string | null, fallback: number, low: number, high: number): number {
	let value = Number(text);
	return text === null || !Number.isInteger(value)
		? fallback
		: Math.max(low, Math.min(high, value));
}

/**
 * Matches what a visitor typed to a place: an id, or a name it starts or contains, ignoring case.
 *
 * @param text The where box's value.
 */
export function matchPlace(text: string): Place | undefined {
	let wanted = text.trim().toLowerCase();
	if (wanted === "") return undefined;
	return (
		findPlace(wanted) ??
		PLACES.find((place) => place.name.toLowerCase() === wanted) ??
		PLACES.find((place) => place.name.toLowerCase().startsWith(wanted)) ??
		PLACES.find((place) => place.name.toLowerCase().includes(wanted))
	);
}

/**
 * Reads a search from an address. A check-out on or before check-in is dropped, as are filter
 * values Wayfern doesn't offer, so any address renders a valid search.
 *
 * @param params The address's query.
 */
export function readSearch(params: URLSearchParams): Search {
	let where = params.get("where") ?? "";
	let place = matchPlace(where);
	let start = readDay(params.get("checkin"));
	let end = readDay(params.get("checkout"));
	if (start === undefined || end === undefined || end <= start) end = undefined;
	if (start === undefined) end = undefined;
	let min = params.has("min")
		? readCount(params.get("min"), PRICE_BOUNDS.min, 0, 10_000)
		: undefined;
	let max = params.has("max")
		? readCount(params.get("max"), PRICE_BOUNDS.max, 0, 10_000)
		: undefined;
	let sort = params.get("sort");
	return {
		place: place?.id,
		text: place === undefined && where.trim() !== "" ? where.trim() : undefined,
		start,
		end,
		adults: readCount(params.get("adults"), 2, 1, 16),
		children: readCount(params.get("children"), 0, 0, 16),
		types: params
			.getAll("type")
			.filter((type): type is StayType => STAY_TYPES.some((entry) => entry.id === type)),
		amenities: params
			.getAll("amenity")
			.filter((id): id is Amenity => AMENITIES.some((entry) => entry.id === id)),
		min: min === undefined || min <= PRICE_BOUNDS.min ? undefined : min,
		max: max === undefined || max >= PRICE_BOUNDS.max ? undefined : max,
		sort: SORTS.some((entry) => entry.id === sort) ? (sort as Sort) : "recommended",
		view: params.get("view") === "map" ? "map" : "list",
		bounds: readNumbers(params.get("bounds"), 4) as Search["bounds"],
		camera: readCamera(params),
	};
}

/** Reads `count` comma-separated finite numbers, or `undefined` for anything else. */
function readNumbers(text: string | null, count: number): number[] | undefined {
	let values = (text ?? "").split(",").map(Number);
	return values.length === count && values.every(Number.isFinite) ? values : undefined;
}

/** Reads the map's camera from `center` and `zoom`, kept only when both are sensible. */
function readCamera(params: URLSearchParams): Search["camera"] {
	let center = readNumbers(params.get("center"), 2);
	let zoom = Number(params.get("zoom"));
	if (center === undefined || !Number.isFinite(zoom) || zoom < 3 || zoom > 18) return undefined;
	return { center: [center[0]!, center[1]!], zoom };
}

/**
 * Writes a search back to a query string, leaving out every default, so an address only
 * names what the visitor chose and two equal searches share one address.
 *
 * @param search The search.
 * @returns The query, without its leading `?`; empty for the default search.
 */
export function writeSearch(search: Search): string {
	let params = new URLSearchParams();
	if (search.place !== undefined) params.set("where", search.place);
	else if (search.text !== undefined) params.set("where", search.text);
	if (search.start !== undefined) params.set("checkin", search.start);
	if (search.end !== undefined) params.set("checkout", search.end);
	if (search.adults !== 2) params.set("adults", String(search.adults));
	if (search.children !== 0) params.set("children", String(search.children));
	for (let type of search.types) params.append("type", type);
	if (search.min !== undefined) params.set("min", String(search.min));
	if (search.max !== undefined) params.set("max", String(search.max));
	for (let amenity of search.amenities) params.append("amenity", amenity);
	if (search.sort !== "recommended") params.set("sort", search.sort);
	if (search.view !== "list") params.set("view", search.view);
	if (search.bounds !== undefined) params.set("bounds", search.bounds.join(","));
	if (search.camera !== undefined) {
		params.set("center", search.camera.center.join(","));
		params.set("zoom", String(search.camera.zoom));
	}
	return params.toString();
}

/**
 * The query a stay link carries from a search: only the dates and the party, so a listing
 * opens priced for the trip being planned.
 *
 * @param search The search.
 */
export function tripQuery(search: Pick<Search, "start" | "end" | "adults" | "children">): string {
	let params = new URLSearchParams();
	if (search.start !== undefined) params.set("checkin", search.start);
	if (search.end !== undefined) params.set("checkout", search.end);
	if (search.adults !== 2) params.set("adults", String(search.adults));
	if (search.children !== 0) params.set("children", String(search.children));
	return params.toString();
}

/** Joins a page path and a query string, leaving no dangling `?`. */
export function withQuery(page: string, query: string): string {
	return query === "" ? page : `${page}?${query}`;
}

/**
 * The stays a search finds, in its order: in its place, of its types, within its price,
 * with all its amenities, large enough for the party and free on every night of its dates.
 *
 * @param search The search.
 */
export function findStays(search: Search): Stay[] {
	let guests = search.adults + search.children;
	let found = STAYS.filter((stay) => {
		if (search.place !== undefined && stay.place !== search.place) return false;
		if (search.text !== undefined && !matchesText(stay, search.text)) return false;
		if (search.types.length > 0 && !search.types.includes(stay.type)) return false;
		if (search.bounds !== undefined && !inBounds(toLngLat(stay.x, stay.y), search.bounds))
			return false;
		if (!search.amenities.every((amenity) => stay.amenities.includes(amenity))) return false;
		if (stay.guests < guests) return false;
		let nightly = stay.nightly / 100;
		if (search.min !== undefined && nightly < search.min) return false;
		if (search.max !== undefined && nightly > search.max) return false;
		return search.start === undefined || search.end === undefined
			? true
			: isFree(stay, search.start, search.end);
	});
	return sortStays(found, search.sort);
}

/** Whether a point lies inside `west,south,east,north`. */
function inBounds(
	[lng, lat]: [number, number],
	[west, south, east, north]: [number, number, number, number],
): boolean {
	return lng >= west && lng <= east && lat >= south && lat <= north;
}

/** Whether every night from check-in to the night before check-out is open. */
function isFree(stay: Stay, start: string, end: string): boolean {
	for (let day = start; day < end; day = addDays(day, 1)) if (isBooked(stay, day)) return false;
	return true;
}

/** Whether free text names a stay, its type or a word of its line. */
function matchesText(stay: Stay, text: string): boolean {
	let wanted = text.toLowerCase();
	return [stay.name, stay.type, stay.line].some((field) => field.toLowerCase().includes(wanted));
}

/** Orders stays for a sort; "recommended" puts guest favourites first, then the best rated. */
function sortStays(stays: Stay[], sort: Sort): Stay[] {
	let sorted = stays.slice();
	if (sort === "price-low") sorted.sort((a, b) => a.nightly - b.nightly);
	else if (sort === "price-high") sorted.sort((a, b) => b.nightly - a.nightly);
	else if (sort === "rating") sorted.sort((a, b) => b.rating - a.rating);
	else
		sorted.sort(
			(a, b) =>
				Number(b.favourite === true) - Number(a.favourite === true) ||
				b.rating * Math.log(b.reviews) - a.rating * Math.log(a.reviews),
		);
	return sorted;
}

/**
 * How many filters a search applies beyond where, when and who, for the "Filters · 3" button.
 *
 * @param search The search.
 */
export function filterCount(search: Search): number {
	return (
		search.types.length +
		search.amenities.length +
		(search.min !== undefined || search.max !== undefined ? 1 : 0)
	);
}

/**
 * The party in words, children counted as guests: "1 guest", "3 guests".
 *
 * @param search The adults and children.
 */
export function partyLabel(search: Pick<Search, "adults" | "children">): string {
	let guests = search.adults + search.children;
	return `${guests} ${guests === 1 ? "guest" : "guests"}`;
}
