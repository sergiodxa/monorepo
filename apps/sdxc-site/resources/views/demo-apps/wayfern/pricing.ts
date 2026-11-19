/**
 * What a stay costs and when it is free: the nights already booked, the rules a request must
 * meet, and the quote a booking card and checkout both print. One module answers both, so the
 * card's live total and the confirmed trip can never disagree.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Stay } from "./data";

import { hashOf } from "./data";
import { addDays, nightsBetween, weekday } from "./days";

/** Friday and Saturday nights cost this much more than a weeknight. */
const WEEKEND_UPLIFT = 0.15;

/** A stay of a week or more takes this much off the nights. */
const WEEKLY_DISCOUNT = 0.1;

/** Nights needed for {@link WEEKLY_DISCOUNT}. */
const WEEKLY_NIGHTS = 7;

/** Wayfern's service fee, a share of the nights after any discount. */
const SERVICE_RATE = 0.11;

/** Local occupancy tax, a share of the nights and cleaning. */
const TAX_RATE = 0.07;

/** Days are grouped in windows this long; some windows hold a booking. */
const WINDOW_DAYS = 9;

/** Calendars and requests reach this many days ahead. */
export const BOOKING_HORIZON_DAYS = 330;

/**
 * Formats US cents for a reader, dropping `.00` from whole dollars, as prices on a card read.
 *
 * @example money(16_400) // "$164"
 * @example money(1_804) // "$18.04"
 */
export function money(cents: number): string {
	let whole = cents % 100 === 0;
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: whole ? 0 : 2,
		maximumFractionDigits: 2,
	}).format(cents / 100);
}

/** The day number of a key since 1970, which booking windows are counted in. */
function dayNumber(key: string): number {
	return Math.floor(Date.parse(`${key}T00:00:00Z`) / 86_400_000);
}

/**
 * Whether the night starting on `day` is already taken at a stay. A third of the stay's
 * windows hold a two-to-four night booking, placed by the stay's id, so availability looks
 * real and is the same on every request; nights the visitor booked count too.
 *
 * @param stay The stay.
 * @param day The night's date.
 * @param mine The nights the visitor's own trips hold at this stay.
 */
export function isBooked(stay: Stay, day: string, mine: ReadonlySet<string> = new Set()): boolean {
	if (mine.has(day)) return true;
	let number = dayNumber(day);
	let window = Math.floor(number / WINDOW_DAYS);
	let seed = hashOf(`${stay.id}:${window}`);
	if (seed % 3 !== 0) return false;
	let offset = (seed >>> 4) % (WINDOW_DAYS - 4);
	let length = 2 + ((seed >>> 8) % 3);
	let position = number - window * WINDOW_DAYS;
	return position >= offset && position < offset + length;
}

/** The price of one night at a stay, with the weekend uplift on Fridays and Saturdays. */
export function nightPrice(stay: Stay, day: string): number {
	let weekend = weekday(day) === 5 || weekday(day) === 6;
	return weekend ? Math.round((stay.nightly * (1 + WEEKEND_UPLIFT)) / 100) * 100 : stay.nightly;
}

/** One line of a quote, as a price breakdown prints it. */
export interface QuoteLine {
	key: "nights" | "discount" | "cleaning" | "service" | "taxes";
	label: string;
	/** What the line is made of, such as "$164 × 4 nights". */
	detail?: string;
	cents: number;
}

/** What a stay costs for some dates. */
export interface Quote {
	nights: number;
	/** The nights' average price, which "$x night" headlines show. */
	average: number;
	lines: QuoteLine[];
	total: number;
}

/**
 * Prices a stay from check-in to check-out: the nights, a weekly discount, cleaning, the
 * service fee and taxes, each rounded to the cent, with a total that is their exact sum.
 *
 * @param stay The stay.
 * @param start Check-in.
 * @param end Check-out, after check-in.
 */
export function quote(stay: Stay, start: string, end: string): Quote {
	let nights = Math.max(0, nightsBetween(start, end));
	let base = 0;
	for (let index = 0; index < nights; index++) base += nightPrice(stay, addDays(start, index));
	let average = nights === 0 ? stay.nightly : Math.round(base / nights);
	let discount = nights >= WEEKLY_NIGHTS ? Math.round(base * WEEKLY_DISCOUNT) : 0;
	let service = Math.round((base - discount) * SERVICE_RATE);
	let taxes = Math.round((base - discount + stay.cleaning) * TAX_RATE);
	let lines: QuoteLine[] = [
		{
			key: "nights",
			label: `${nights} ${nights === 1 ? "night" : "nights"}`,
			detail: `${money(average)} × ${nights} ${nights === 1 ? "night" : "nights"}`,
			cents: base,
		},
	];
	if (discount > 0)
		lines.push({ key: "discount", label: "Weekly stay discount", cents: -discount });
	lines.push(
		{ key: "cleaning", label: "Cleaning fee", cents: stay.cleaning },
		{ key: "service", label: "Wayfern service fee", cents: service },
		{ key: "taxes", label: "Taxes", cents: taxes },
	);
	return {
		nights,
		average,
		lines,
		total: lines.reduce((sum, line) => sum + line.cents, 0),
	};
}

/** Why a request cannot be booked, in the words the booking card shows. */
export type RequestProblem =
	| { kind: "dates"; message: string }
	| { kind: "guests"; message: string };

/** A request to stay: the dates and party a booking card or checkout carries. */
export interface StayRequest {
	start?: string;
	end?: string;
	adults: number;
	children: number;
}

/**
 * Checks a request against a stay's rules: dates from today within the horizon, the minimum
 * stay, no booked night between them, and a party that fits. Each problem names what to change.
 *
 * @param stay The stay.
 * @param request The request.
 * @param today Today's key.
 * @param mine Nights the visitor already holds at this stay.
 * @returns Every problem, empty when the stay can be booked.
 */
export function checkRequest(
	stay: Stay,
	request: StayRequest,
	today: string,
	mine: ReadonlySet<string> = new Set(),
): RequestProblem[] {
	let problems: RequestProblem[] = [];
	let { start, end } = request;
	if (start === undefined || end === undefined) {
		problems.push({ kind: "dates", message: "Add your check-in and check-out dates." });
	} else if (start < today) {
		problems.push({ kind: "dates", message: "Check-in can't be in the past." });
	} else if (nightsBetween(start, end) < 1) {
		problems.push({ kind: "dates", message: "Check-out must be after check-in." });
	} else if (nightsBetween(today, end) > BOOKING_HORIZON_DAYS) {
		problems.push({ kind: "dates", message: "Pick dates within the next eleven months." });
	} else if (nightsBetween(start, end) < stay.minNights) {
		problems.push({
			kind: "dates",
			message: `${stay.name} has a ${stay.minNights}-night minimum.`,
		});
	} else {
		for (let index = 0; index < nightsBetween(start, end); index++) {
			if (isBooked(stay, addDays(start, index), mine)) {
				problems.push({
					kind: "dates",
					message: "Some of those nights are booked. Try other dates.",
				});
				break;
			}
		}
	}
	if (request.adults < 1) {
		problems.push({ kind: "guests", message: "A booking needs at least one adult." });
	} else if (request.adults + request.children > stay.guests) {
		problems.push({ kind: "guests", message: `${stay.name} sleeps up to ${stay.guests}.` });
	}
	return problems;
}

/**
 * The first free stretch of `nights` nights from `from`, so a listing opened without dates can
 * suggest some that work.
 *
 * @returns Check-in and check-out, or `undefined` when nothing is free within the horizon.
 */
export function firstOpening(
	stay: Stay,
	from: string,
	nights: number,
	mine: ReadonlySet<string> = new Set(),
): { start: string; end: string } | undefined {
	for (let offset = 0; offset < BOOKING_HORIZON_DAYS - nights; offset++) {
		let start = addDays(from, offset);
		let free = true;
		for (let index = 0; index < nights && free; index++) {
			free = !isBooked(stay, addDays(start, index), mine);
		}
		if (free) return { start, end: addDays(start, nights) };
	}
	return undefined;
}
