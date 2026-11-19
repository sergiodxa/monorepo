/**
 * What one visitor did on Wayfern, kept in their own cookies: the stays they saved and the
 * trips they booked or cancelled. The server reads them to draw every screen, so a booking
 * survives a reload and works without script, and nothing is shared between visitors.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import * as checks from "remix/data-schema/checks";

import { demoAppCookiePath } from "~/resources/views/demo-apps";

import type { CarExtra } from "./cars";
import type { FareClass } from "./flights";

import { carOffers, findCarOffer } from "./cars";
import { SAVED_CARDS, SLUG, TRAVELLER, findCard, findStay } from "./data";
import { addDays, readDay } from "./days";
import { findFlight, flightsOn } from "./flights";

/** Every Wayfern cookie starts with this, which is how a request is known to be personal. */
const COOKIE_PREFIX = "wayfern.";

/** The cookie holding the saved stays' ids, most recently saved first. */
const SAVED_COOKIE = `${COOKIE_PREFIX}saved`;

/** The cookie holding the visitor's trips. */
const TRIPS_COOKIE = `${COOKIE_PREFIX}trips`;

/** A week: long enough to come back to, short enough that the demo resets itself. */
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

/** The most trips a visitor keeps, so the cookie stays far under a browser's size limit. */
const MAX_TRIPS = 10;

/** The stays a new visitor finds already saved, so the wishlist is never empty on arrival. */
const DEFAULT_SAVED = ["the-canopy", "stillwater-boathouse", "gullwing-cottage"];

/** What every booking keeps, whatever was booked. */
interface Booking {
	/** A short code the visitor sees on the confirmation, such as `WF-4K8Q2`. */
	id: string;
	/** The saved card it was paid with. */
	card: string;
	status: "confirmed" | "cancelled";
	/** The package code shared by a flight and a stay booked together, which earns a saving. */
	bundle?: string;
}

/** A stay booked from check-in to check-out. */
export interface StayTrip extends Booking {
	kind: "stay";
	stay: string;
	start: string;
	end: string;
	adults: number;
	children: number;
}

/** One flown journey: each leg's option, its fare class and the seats picked on each segment. */
export interface FlightTrip extends Booking {
	kind: "flight";
	legs: Array<{ option: string; fare: FareClass; seats: string[] }>;
	adults: number;
	children: number;
	/** The lead passenger, whose name is on the boarding passes. */
	lead: string;
}

/** A car rented from a pickup place and time to a drop-off. */
export interface CarTrip extends Booking {
	kind: "car";
	place: string;
	dropoff: string;
	offer: string;
	/** Local pickup and drop-off times, `YYYY-MM-DDTHH:MM`, in the coast's zone. */
	pickupAt: string;
	dropoffAt: string;
	extras: CarExtra[];
}

/** Anything the visitor booked. */
export type Trip = StayTrip | FlightTrip | CarTrip;

/** What the visitor did, as every screen reads it. */
export interface Traveller {
	/** The saved stays' ids, most recently saved first. */
	saved: string[];
	/** Every trip, most recently booked first. */
	trips: Trip[];
}

/**
 * The trips a new visitor starts with, dated from today: a long weekend to look forward to
 * (the flights there and back, a cabin and a car) and a stay already taken, so Trips shows
 * both halves of its screen and the itinerary has every kind of booking on it.
 *
 * @param today Today's key.
 */
export function defaultTrips(today: string): Trip[] {
	let start = addDays(today, 24);
	let end = addDays(today, 27);
	let out = flightsOn("SRL", "MRW", start)[1];
	let back = flightsOn("MRW", "SRL", end).at(-2);
	let card = SAVED_CARDS[0]!.id;
	let trips: Trip[] = [];
	if (out !== undefined && back !== undefined) {
		trips.push({
			kind: "flight",
			id: "WF-8F2TL",
			card,
			status: "confirmed",
			legs: [
				{ option: out.id, fare: "standard", seats: out.segments.map(() => "14C") },
				{ option: back.id, fare: "standard", seats: back.segments.map(() => "21A") },
			],
			adults: 2,
			children: 0,
			lead: TRAVELLER.name,
		});
	}
	trips.push(
		{
			kind: "stay",
			id: "WF-7M3QK",
			stay: "pinecone-a-frame",
			start,
			end,
			adults: 2,
			children: 0,
			card,
			status: "confirmed",
		},
		{
			kind: "car",
			id: "WF-3CRV9",
			card,
			status: "confirmed",
			place: "MRW",
			dropoff: "MRW",
			offer: (carOffers("MRW").find((offer) => offer.car.id === "compact") ?? carOffers("MRW")[0]!)
				.id,
			pickupAt: `${start}T14:00`,
			dropoffAt: `${end}T10:00`,
			extras: [],
		},
		{
			kind: "stay",
			id: "WF-2D9LX",
			stay: "dune-hollow",
			start: addDays(today, -46),
			end: addDays(today, -42),
			adults: 2,
			children: 0,
			card: SAVED_CARDS[1]!.id,
			status: "confirmed",
		},
	);
	return trips;
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

/** A trip code's shape. */
const CODE = s.string().refine((value) => /^WF-[A-Z0-9]{5}$/.test(value), "Unreadable");

/** A local date-time, `YYYY-MM-DDTHH:MM`. */
const LOCAL_TIME = s
	.string()
	.refine((value) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value), "Unreadable");

/** What every booking in the cookie carries. */
const BOOKING = {
	id: CODE,
	card: s.string(),
	status: s.enum_(["confirmed", "cancelled"]),
	bundle: s.optional(CODE),
};

/** One trip as the cookie stores it, by kind. */
const TRIP_SCHEMA = s.variant("kind", {
	stay: s.object({
		...BOOKING,
		kind: s.literal("stay"),
		stay: s.string(),
		start: s.string(),
		end: s.string(),
		adults: s.number(),
		children: s.number(),
	}),
	flight: s.object({
		...BOOKING,
		kind: s.literal("flight"),
		legs: s.array(
			s.object({
				option: s.string(),
				fare: s.enum_(["basic", "standard", "flex"]),
				seats: s.array(s.string().refine((value) => /^\d{1,2}[A-K]$/.test(value), "Unreadable")),
			}),
		),
		adults: s.number(),
		children: s.number(),
		lead: s.string().pipe(checks.maxLength(60)),
	}),
	car: s.object({
		...BOOKING,
		kind: s.literal("car"),
		place: s.string(),
		dropoff: s.string(),
		offer: s.string(),
		pickupAt: LOCAL_TIME,
		dropoffAt: LOCAL_TIME,
		extras: s.array(s.enum_(["child-seat", "gps", "driver", "cover"])),
	}),
});

/**
 * Whether a trip that parsed names things Wayfern has: a real stay and dates, flights that
 * exist, an offer at its place. A tampered entry fails here and is dropped.
 */
function isKnown(trip: Trip): boolean {
	if (findCard(trip.card) === undefined) return false;
	if (trip.kind === "stay") {
		let start = readDay(trip.start);
		let end = readDay(trip.end);
		return (
			findStay(trip.stay) !== undefined && start !== undefined && end !== undefined && end > start
		);
	}
	if (trip.kind === "flight")
		return trip.legs.length > 0 && trip.legs.every((leg) => findFlight(leg.option) !== undefined);
	return findCarOffer(trip.place, trip.offer) !== undefined && trip.dropoffAt > trip.pickupAt;
}

/** Reads the trips cookie: base64url JSON, each entry validated on its own. */
function readTrips(text: string): Trip[] {
	let decoded: unknown;
	try {
		decoded = JSON.parse(
			new TextDecoder().decode(
				Uint8Array.from(atob(text.replaceAll("-", "+").replaceAll("_", "/")), (c) =>
					c.charCodeAt(0),
				),
			),
		);
	} catch {
		return [];
	}
	if (!Array.isArray(decoded)) return [];
	return decoded.flatMap((entry) => {
		let parsed = s.parseSafe(TRIP_SCHEMA, entry);
		return parsed.success && isKnown(parsed.value as Trip) ? [parsed.value as Trip] : [];
	});
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
	let trips = tripsText === undefined ? defaultTrips(today) : readTrips(tripsText);
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
	let json = JSON.stringify(trips.slice(0, MAX_TRIPS));
	let text = btoa(String.fromCharCode(...new TextEncoder().encode(json)))
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replaceAll("=", "");
	return cookieHeader(TRIPS_COOKIE, text);
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
		if (
			trip.kind !== "stay" ||
			trip.stay !== stay ||
			trip.status !== "confirmed" ||
			trip.id === except
		)
			continue;
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
