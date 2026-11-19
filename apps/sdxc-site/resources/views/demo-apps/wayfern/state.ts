/**
 * What one visitor did on Wayfern, kept in their own cookies: the stays they saved and the
 * trips they booked or cancelled. The server reads them to draw every screen, so a booking
 * survives a reload and works without script, and nothing is shared between visitors.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { demoAppCookiePath } from "~/resources/views/demo-apps";

import { SAVED_CARDS, SLUG, findCard, findStay } from "./data";
import { addDays, readDay } from "./days";

/** Every Wayfern cookie starts with this, which is how a request is known to be personal. */
const COOKIE_PREFIX = "wayfern.";

/** The cookie holding the saved stays' ids, most recently saved first. */
const SAVED_COOKIE = `${COOKIE_PREFIX}saved`;

/** The cookie holding the visitor's trips. */
const TRIPS_COOKIE = `${COOKIE_PREFIX}trips`;

/** A week: long enough to come back to, short enough that the demo resets itself. */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

/** The most trips a visitor keeps, so the cookie stays far under a browser's size limit. */
const MAX_TRIPS = 12;

/** The stays a new visitor finds already saved, so the wishlist is never empty on arrival. */
const DEFAULT_SAVED = ["the-canopy", "stillwater-boathouse", "gullwing-cottage"];

/** One booked trip. */
export interface Trip {
	/** A short code the visitor sees on the confirmation, such as `WF-4K8Q2`. */
	id: string;
	stay: string;
	start: string;
	end: string;
	adults: number;
	children: number;
	card: string;
	status: "confirmed" | "cancelled";
}

/** What the visitor did, as every screen reads it. */
export interface Traveller {
	/** The saved stays' ids, most recently saved first. */
	saved: string[];
	/** Every trip, most recently booked first. */
	trips: Trip[];
}

/**
 * The trips a new visitor starts with, dated from today: one stay to look forward to and one
 * already taken, so Trips shows both halves of its screen.
 *
 * @param today Today's key.
 */
export function defaultTrips(today: string): Trip[] {
	return [
		{
			id: "WF-7M3QK",
			stay: "pinecone-a-frame",
			start: addDays(today, 24),
			end: addDays(today, 27),
			adults: 2,
			children: 0,
			card: SAVED_CARDS[0]!.id,
			status: "confirmed",
		},
		{
			id: "WF-2D9LX",
			stay: "dune-hollow",
			start: addDays(today, -46),
			end: addDays(today, -42),
			adults: 2,
			children: 0,
			card: SAVED_CARDS[1]!.id,
			status: "confirmed",
		},
	];
}

/**
 * Splits a `Cookie` header into Wayfern's pairs. Where a name repeats, the first wins: browsers
 * send the cookie with the longest path first, so the app's own cookie outranks an older one.
 */
function wayfernCookies(header: string | null): Map<string, string> {
	let pairs = new Map<string, string>();
	for (let pair of (header ?? "").split(";")) {
		let [name = "", ...value] = pair.trim().split("=");
		if (name.startsWith(COOKIE_PREFIX) && !pairs.has(name)) pairs.set(name, value.join("="));
	}
	return pairs;
}

/**
 * Whether a request carries something the visitor did, so its pages render fresh rather than
 * from a copy cached for everyone.
 *
 * @param header The request's `Cookie` header.
 */
export function isPersonal(header: string | null): boolean {
	return wayfernCookies(header).size > 0;
}

/** Reads one trip from its cookie form, `id.stay.start.end.adults.children.card.status`. */
function readTrip(text: string): Trip | undefined {
	let [id = "", stay = "", start, end, adults, children, card = "", status] = text.split(".");
	let first = readDay(start);
	let last = readDay(end);
	if (!/^WF-[A-Z0-9]{5}$/.test(id) || findStay(stay) === undefined || findCard(card) === undefined)
		return undefined;
	if (first === undefined || last === undefined || last <= first) return undefined;
	if (status !== "confirmed" && status !== "cancelled") return undefined;
	return {
		id,
		stay,
		start: first,
		end: last,
		adults: Math.max(1, Math.min(16, Number(adults) || 1)),
		children: Math.max(0, Math.min(16, Number(children) || 0)),
		card,
		status,
	};
}

/**
 * Reads the visitor's saved stays and trips. Anything malformed or naming a stay Wayfern lacks
 * is dropped, so a tampered cookie can only lose entries.
 *
 * @param header The request's `Cookie` header.
 * @param today Today's key, which the starting trips are dated from.
 */
export function readTraveller(header: string | null, today: string): Traveller {
	let cookies = wayfernCookies(header);
	let savedText = cookies.get(SAVED_COOKIE);
	let saved =
		savedText === undefined
			? DEFAULT_SAVED
			: decodeURIComponent(savedText)
					.split(",")
					.filter((id) => findStay(id) !== undefined);
	let tripsText = cookies.get(TRIPS_COOKIE);
	let trips =
		tripsText === undefined
			? defaultTrips(today)
			: decodeURIComponent(tripsText)
					.split(",")
					.map(readTrip)
					.filter((trip): trip is Trip => trip !== undefined);
	return { saved: [...new Set(saved)], trips };
}

/** One `Set-Cookie` value under the app's own path. */
function cookieHeader(name: string, value: string): string {
	return `${name}=${value}; Path=${demoAppCookiePath(SLUG)}; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax; HttpOnly`;
}

/**
 * The cookie holding the saved stays with one added or removed; an added stay goes first.
 *
 * @param traveller The visitor as the request found them.
 * @param stay The stay's id.
 * @param save `true` to save it, `false` to remove it.
 */
export function savedCookie(traveller: Traveller, stay: string, save: boolean): string {
	let rest = traveller.saved.filter((id) => id !== stay);
	let next = save ? [stay, ...rest] : rest;
	return cookieHeader(SAVED_COOKIE, encodeURIComponent(next.join(",")));
}

/**
 * The cookie holding the trips as given, newest kept when there are more than fit.
 *
 * @param trips Every trip, most recent first.
 */
export function tripsCookie(trips: Trip[]): string {
	let text = trips
		.slice(0, MAX_TRIPS)
		.map((trip) =>
			[
				trip.id,
				trip.stay,
				trip.start,
				trip.end,
				trip.adults,
				trip.children,
				trip.card,
				trip.status,
			].join("."),
		)
		.join(",");
	return cookieHeader(TRIPS_COOKIE, encodeURIComponent(text));
}

/**
 * The nights a visitor's confirmed trips hold at a stay, so a calendar shows them as taken and
 * a second booking can't overlap the first.
 *
 * @param traveller The visitor.
 * @param stay The stay's id.
 * @param except A trip to leave out, such as the one being changed.
 */
export function heldNights(traveller: Traveller, stay: string, except?: string): Set<string> {
	let nights = new Set<string>();
	for (let trip of traveller.trips) {
		if (trip.stay !== stay || trip.status !== "confirmed" || trip.id === except) continue;
		for (let day = trip.start; day < trip.end; day = addDays(day, 1)) nights.add(day);
	}
	return nights;
}

/**
 * A new trip's confirmation code: `WF-` and five characters from the request and the clock,
 * avoiding letters that read as digits.
 *
 * @param seed A number unique to this booking, such as the current time.
 */
export function tripCode(seed: number): string {
	let alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
	let code = "";
	let value = Math.abs(Math.floor(seed));
	for (let index = 0; index < 5; index++) {
		code += alphabet[value % alphabet.length];
		value = Math.floor(value / alphabet.length) + index * 7919;
	}
	return `WF-${code}`;
}

/**
 * The cookies that put the demo back as it started: every Wayfern cookie the request carries,
 * expired, so saved stays and trips return to their starting state.
 *
 * @param header The request's `Cookie` header.
 */
export function resetCookies(header: string | null): string[] {
	return [...wayfernCookies(header).keys()].map(
		(name) => `${name}=; Path=${demoAppCookiePath(SLUG)}; Max-Age=0; SameSite=Lax; HttpOnly`,
	);
}
