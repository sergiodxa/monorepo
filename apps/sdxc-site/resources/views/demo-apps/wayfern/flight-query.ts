/**
 * A flight search as its address carries it: the kind of trip, each leg's route and day, the
 * party, the flights already picked, and the filters on the list being chosen from. Every step
 * of choosing flights is a link, so the whole flow is an address someone can send.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { FareClass, FlightOption } from "./flights";

import { readDay } from "./days";
import { AIRLINES, findAirport, findFlight, flightsOn, journeyMinutes, localTime } from "./flights";

/** The kinds of trip the flight search offers. */
export type TripKind = "round" | "one" | "multi";

/** The departure windows the time filters offer, in local hours. */
export const WINDOWS = [
	{ id: "night", label: "Night", hint: "Before 6am", from: 0, to: 6 },
	{ id: "morning", label: "Morning", hint: "6am – noon", from: 6, to: 12 },
	{ id: "afternoon", label: "Afternoon", hint: "Noon – 6pm", from: 12, to: 18 },
	{ id: "evening", label: "Evening", hint: "After 6pm", from: 18, to: 24 },
] as const;

/** One departure window's id. */
export type Window = (typeof WINDOWS)[number]["id"];

/** The orders a flight list offers. */
export const FLIGHT_SORTS = [
	{ id: "best", label: "Best" },
	{ id: "cheapest", label: "Cheapest" },
	{ id: "fastest", label: "Fastest" },
	{ id: "earliest", label: "Earliest" },
] as const;

/** One flight list order. */
export type FlightSort = (typeof FLIGHT_SORTS)[number]["id"];

/** One leg of a search: where from, where to, and the day. */
export interface Leg {
	from: string;
	to: string;
	day: string;
}

/** A flight search and the choices made on it so far. */
export interface FlightSearch {
	trip: TripKind;
	legs: Leg[];
	adults: number;
	children: number;
	/** The options picked so far, one per leg in order. */
	picks: string[];
	fare: FareClass;
	stops: number[];
	departs: Window[];
	arrives: Window[];
	airlines: string[];
	/** The longest journey wanted, in hours. */
	maxHours?: number;
	/** The highest fare wanted, in whole dollars. */
	maxPrice?: number;
	sort: FlightSort;
}

/** Reads a count within bounds; the last value wins, so a stepper button can override a field. */
function readCount(
	params: URLSearchParams,
	name: string,
	fallback: number,
	low: number,
	high: number,
): number {
	let value = Number(params.getAll(name).at(-1));
	return Number.isInteger(value) ? Math.max(low, Math.min(high, value)) : fallback;
}

/** Reads one leg from `FROM.TO.YYYY-MM-DD`, or from separate fields. */
function readLeg(from: string | null, to: string | null, day: string | null): Leg | undefined {
	let origin = findAirport(from ?? "");
	let destination = findAirport(to ?? "");
	let date = readDay(day);
	if (
		origin === undefined ||
		destination === undefined ||
		date === undefined ||
		origin === destination
	)
		return undefined;
	return { from: origin.code, to: destination.code, day: date };
}

/**
 * Reads a flight search from an address. Legs that name unknown airports or days are dropped,
 * a round trip without a return becomes one-way, and picks are kept only while each still
 * matches its leg.
 *
 * @param params The address's query.
 */
export function readFlightSearch(params: URLSearchParams): FlightSearch {
	let named = params.get("trip");
	let trip: TripKind = named === "one" || named === "multi" ? named : "round";
	let legs: Leg[] = [];
	if (trip === "multi") {
		for (let text of params.getAll("leg")) {
			let [from = null, to = null, day = null] = text.split(".");
			let leg = readLeg(from, to, day);
			if (leg !== undefined) legs.push(leg);
		}
		let froms = params.getAll("from");
		let tos = params.getAll("to");
		let days = params.getAll("day");
		for (let index = 0; legs.length === 0 && index < froms.length; index++) {
			let leg = readLeg(froms[index] ?? null, tos[index] ?? null, days[index] ?? null);
			if (leg !== undefined) legs.push(leg);
		}
	} else {
		let out = readLeg(params.get("from"), params.get("to"), params.get("depart"));
		if (out !== undefined) {
			legs.push(out);
			let back = readDay(params.get("return"));
			if (trip === "round" && back !== undefined && back >= out.day)
				legs.push({ from: out.to, to: out.from, day: back });
		}
	}
	let picks: string[] = [];
	for (let [index, id] of params.getAll("pick").entries()) {
		let leg = legs[index];
		let option = findFlight(id);
		if (
			leg === undefined ||
			option === undefined ||
			!id.startsWith(`${leg.from}-${leg.to}-${leg.day}-`)
		)
			break;
		picks.push(id);
	}
	let fare = params.get("fare");
	let sort = params.get("sort");
	let maxHours = Number(params.get("maxhours"));
	let maxPrice = Number(params.get("maxprice"));
	return {
		trip,
		legs,
		adults: readCount(params, "adults", 1, 1, 9),
		children: readCount(params, "children", 0, 0, 8),
		picks,
		fare: fare === "basic" || fare === "flex" ? fare : "standard",
		stops: params
			.getAll("stops")
			.map(Number)
			.filter((value) => [0, 1, 2].includes(value)),
		departs: params
			.getAll("dep")
			.filter((id): id is Window => WINDOWS.some((entry) => entry.id === id)),
		arrives: params
			.getAll("arr")
			.filter((id): id is Window => WINDOWS.some((entry) => entry.id === id)),
		airlines: params
			.getAll("airline")
			.filter((code) => AIRLINES.some((airline) => airline.code === code)),
		maxHours: Number.isFinite(maxHours) && maxHours > 0 ? maxHours : undefined,
		maxPrice: Number.isFinite(maxPrice) && maxPrice > 0 ? maxPrice : undefined,
		sort: FLIGHT_SORTS.some((entry) => entry.id === sort) ? (sort as FlightSort) : "best",
	};
}

/**
 * Writes a flight search back to a query, leaving out defaults, in a fixed order so equal
 * searches share one address.
 *
 * @param search The search.
 * @param keepFilters Whether the list filters ride along; a new leg's list starts unfiltered.
 */
export function writeFlightSearch(search: FlightSearch, keepFilters = true): string {
	let params = new URLSearchParams();
	if (search.trip !== "round") params.set("trip", search.trip);
	if (search.trip === "multi") {
		for (let leg of search.legs) params.append("leg", `${leg.from}.${leg.to}.${leg.day}`);
	} else if (search.legs[0] !== undefined) {
		params.set("from", search.legs[0].from);
		params.set("to", search.legs[0].to);
		params.set("depart", search.legs[0].day);
		if (search.trip === "round" && search.legs[1] !== undefined)
			params.set("return", search.legs[1].day);
	}
	if (search.adults !== 1) params.set("adults", String(search.adults));
	if (search.children !== 0) params.set("children", String(search.children));
	for (let pick of search.picks) params.append("pick", pick);
	if (search.fare !== "standard") params.set("fare", search.fare);
	if (keepFilters) {
		for (let stop of search.stops) params.append("stops", String(stop));
		for (let window of search.departs) params.append("dep", window);
		for (let window of search.arrives) params.append("arr", window);
		for (let airline of search.airlines) params.append("airline", airline);
		if (search.maxHours !== undefined) params.set("maxhours", String(search.maxHours));
		if (search.maxPrice !== undefined) params.set("maxprice", String(search.maxPrice));
		if (search.sort !== "best") params.set("sort", search.sort);
	}
	return params.toString();
}

/** The leg being chosen now: the first without a pick, or `undefined` once every leg has one. */
export function currentLeg(search: FlightSearch): Leg | undefined {
	return search.legs[search.picks.length];
}

/** The hour of a local wall-clock reading, for the window filters. */
function hourIn(instant: number, airport: string): number {
	return localTime(instant, findAirport(airport)!.timeZone).minutes / 60;
}

/** Whether an hour falls in any of the windows; no windows means any hour. */
function inWindows(hour: number, windows: Window[]): boolean {
	return (
		windows.length === 0 ||
		windows.some((id) => {
			let window = WINDOWS.find((entry) => entry.id === id)!;
			return hour >= window.from && hour < window.to;
		})
	);
}

/**
 * The options for a leg after the filters, in the search's order. "Best" weighs price against
 * time and stops, the way an airline's default list does.
 *
 * @param search The search, whose filters and sort apply.
 * @param leg The leg listed.
 */
export function findFlights(search: FlightSearch, leg: Leg): FlightOption[] {
	let found = flightsOn(leg.from, leg.to, leg.day).filter((option) => {
		let first = option.segments[0]!;
		let last = option.segments.at(-1)!;
		if (search.stops.length > 0 && !search.stops.includes(Math.min(2, option.segments.length - 1)))
			return false;
		if (!inWindows(hourIn(first.departs, first.from), search.departs)) return false;
		if (!inWindows(hourIn(last.arrives, last.to), search.arrives)) return false;
		if (search.airlines.length > 0 && !search.airlines.includes(first.airline)) return false;
		if (search.maxHours !== undefined && journeyMinutes(option) > search.maxHours * 60)
			return false;
		return search.maxPrice === undefined || option.price <= search.maxPrice * 100;
	});
	let score = (option: FlightOption) =>
		option.price / 100 + journeyMinutes(option) * 0.6 + (option.segments.length - 1) * 60;
	if (search.sort === "cheapest") return found.sort((a, b) => a.price - b.price);
	if (search.sort === "fastest") return found.sort((a, b) => journeyMinutes(a) - journeyMinutes(b));
	if (search.sort === "earliest") return found;
	return found.sort((a, b) => score(a) - score(b));
}

/** Labels the cheapest and fastest of a list, the badges a results list marks. */
export function standouts(options: FlightOption[]): { cheapest?: string; fastest?: string } {
	if (options.length === 0) return {};
	let cheapest = options.reduce((best, option) => (option.price < best.price ? option : best));
	let fastest = options.reduce((best, option) =>
		journeyMinutes(option) < journeyMinutes(best) ? option : best,
	);
	return { cheapest: cheapest.id, fastest: fastest.id };
}
