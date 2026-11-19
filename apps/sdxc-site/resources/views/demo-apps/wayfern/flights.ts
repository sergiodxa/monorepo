/**
 * Wayfern's invented skies: airports, airlines and the flights between them, generated from a
 * seed per route and day so every visitor sees the same schedule and fares. Times are real
 * instants in each airport's own zone, so an itinerary exports to a calendar correctly.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { hashOf } from "./data";
import { addDays } from "./days";

/** One invented airport. */
export interface Airport {
	code: string;
	city: string;
	name: string;
	/** The IANA zone its clocks keep, which every departure and arrival is shown in. */
	timeZone: string;
	/** The Wayfern place it serves, when it is one of the stays' places. */
	place?: string;
	/** Where it sits on the region map, as `[longitude, latitude]`. */
	at: [number, number];
}

/** Every airport, home cities first, then the Lowmere coast's two. */
export const AIRPORTS: Airport[] = [
	{
		code: "SRL",
		city: "Sorrel City",
		name: "Sorrel City Harbourside",
		timeZone: "America/New_York",
		at: [-74.1, 40.6],
	},
	{
		code: "KSH",
		city: "Kestrel Harbour",
		name: "Kestrel Harbour International",
		timeZone: "America/Halifax",
		at: [-63.5, 44.7],
	},
	{
		code: "TMS",
		city: "Tamsin",
		name: "Tamsin Brandt Field",
		timeZone: "Europe/Berlin",
		at: [13.4, 52.4],
	},
	{
		code: "PAC",
		city: "Porto Alcina",
		name: "Porto Alcina Cliffs",
		timeZone: "Europe/Madrid",
		at: [-3.6, 40.4],
	},
	{
		code: "AMB",
		city: "Amberley Isles",
		name: "Amberley Isles Airfield",
		timeZone: "Atlantic/Canary",
		at: [-15.4, 28.1],
	},
	{
		code: "MRW",
		city: "Merrow Bay",
		name: "Merrow Bay Coastal",
		timeZone: "Atlantic/Azores",
		place: "merrow-bay",
		at: [-30.7475, 43.825],
	},
	{
		code: "VLS",
		city: "Vellis",
		name: "Vellis Market Field",
		timeZone: "Atlantic/Azores",
		place: "vellis",
		at: [-30.455, 44.55],
	},
];

/** One invented airline. */
export interface Airline {
	code: string;
	name: string;
	/** The hue its tail mark and boarding pass band are drawn in. */
	hue: number;
}

/** Every airline that flies Wayfern's routes. */
export const AIRLINES: Airline[] = [
	{ code: "LW", name: "Larkwing Air", hue: 150 },
	{ code: "PT", name: "Petrel Airways", hue: 230 },
	{ code: "HY", name: "Halcyon Regional", hue: 35 },
	{ code: "CV", name: "Corvid Atlantic", hue: 290 },
];

/** One leg flown on one aircraft. */
export interface Segment {
	airline: string;
	flight: string;
	from: string;
	to: string;
	/** Departure instant, as epoch milliseconds. */
	departs: number;
	arrives: number;
	aircraft: string;
}

/** One way to get from A to B on a day: its legs and lowest fare. */
export interface FlightOption {
	id: string;
	segments: Segment[];
	/** The Basic fare for one adult, in US cents. */
	price: number;
}

/** The fare classes every option is sold in, priced as a multiple of Basic. */
export const FARE_CLASSES = [
	{
		id: "basic",
		name: "Basic",
		factor: 1,
		features: [
			{ label: "Personal item", included: "yes" },
			{ label: "Carry-on bag", included: "fee" },
			{ label: "Seat choice", included: "fee" },
			{ label: "Changes", included: "no" },
		],
	},
	{
		id: "standard",
		name: "Standard",
		factor: 1.28,
		features: [
			{ label: "Personal item", included: "yes" },
			{ label: "Carry-on bag", included: "yes" },
			{ label: "Seat choice", included: "yes" },
			{ label: "Changes", included: "fee" },
		],
	},
	{
		id: "flex",
		name: "Flex",
		factor: 1.72,
		features: [
			{ label: "Personal item", included: "yes" },
			{ label: "Carry-on and checked bag", included: "yes" },
			{ label: "Seat choice, extra legroom", included: "yes" },
			{ label: "Free changes and refunds", included: "yes" },
		],
	},
] as const;

/** One fare class's id. */
export type FareClass = (typeof FARE_CLASSES)[number]["id"];

/** The aircraft a leg may fly, with its seat layout. */
const AIRCRAFT = [
	{ name: "Larkspur L-320", layout: "ABC DEF", rows: 30 },
	{ name: "Cormorant C-195", layout: "AC DF", rows: 22 },
	{ name: "Albatross A-787", layout: "ABC DEFG HJK", rows: 38 },
] as const;

/** Finds an airport by its code, its city, or a field's `City (CODE)` text. */
export function findAirport(code: string): Airport | undefined {
	let text = code.trim();
	let inParens = /\(([A-Za-z]{3})\)\s*$/.exec(text)?.[1];
	let wanted = (inParens ?? text).toUpperCase();
	return (
		AIRPORTS.find((airport) => airport.code === wanted) ??
		AIRPORTS.find((airport) => airport.city.toUpperCase() === wanted)
	);
}

/** An airport as a field shows and posts it: `Merrow Bay (MRW)`. */
export function airportLabel(airport: Airport): string {
	return `${airport.city} (${airport.code})`;
}

/** Finds an airline by its code. */
export function findAirline(code: string): Airline | undefined {
	return AIRLINES.find((airline) => airline.code === code);
}

/**
 * The offset of a zone from UTC at an instant, in minutes, read from `Intl` so daylight saving
 * time is always right.
 */
export function zoneOffset(timeZone: string, instant: number): number {
	let parts = Object.fromEntries(
		new Intl.DateTimeFormat("en-US", {
			timeZone,
			hourCycle: "h23",
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
		})
			.formatToParts(new Date(instant))
			.map((part) => [part.type, part.value]),
	);
	let local = Date.UTC(
		Number(parts.year),
		Number(parts.month) - 1,
		Number(parts.day),
		Number(parts.hour),
		Number(parts.minute),
	);
	return Math.round((local - Math.floor(instant / 60_000) * 60_000) / 60_000);
}

/**
 * The instant a local wall-clock time names in a zone.
 *
 * @param day The day, `YYYY-MM-DD`.
 * @param minutes Minutes after midnight.
 * @param timeZone The zone the clock keeps.
 */
export function zonedInstant(day: string, minutes: number, timeZone: string): number {
	let guess = Date.parse(`${day}T00:00:00Z`) + minutes * 60_000;
	let instant = guess - zoneOffset(timeZone, guess) * 60_000;
	return guess - zoneOffset(timeZone, instant) * 60_000;
}

/** A local wall-clock reading of an instant in a zone: its day, `HH:MM`, and minutes. */
export function localTime(
	instant: number,
	timeZone: string,
): { day: string; time: string; minutes: number } {
	let shifted = new Date(instant + zoneOffset(timeZone, instant) * 60_000);
	let iso = shifted.toISOString();
	return {
		day: iso.slice(0, 10),
		time: iso.slice(11, 16),
		minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
	};
}

/** A duration in minutes as people read it on a ticket: `7h 25m`. */
export function formatMinutes(minutes: number): string {
	let hours = Math.floor(minutes / 60);
	let rest = minutes % 60;
	if (hours === 0) return `${rest}m`;
	return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/** Great-circle distance between two airports, in kilometres, which sets flying time. */
function distance(from: Airport, to: Airport): number {
	let rad = Math.PI / 180;
	let [lon1, lat1] = from.at;
	let [lon2, lat2] = to.at;
	let a =
		Math.sin(((lat2 - lat1) * rad) / 2) ** 2 +
		Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(((lon2 - lon1) * rad) / 2) ** 2;
	return 2 * 6371 * Math.asin(Math.sqrt(a));
}

/** Minutes in the air between two airports, taxi included. */
function flyingMinutes(from: Airport, to: Airport): number {
	return Math.round((35 + distance(from, to) / 13.5) / 5) * 5;
}

/** The airport a one-stop route connects through, picked so it is not either end. */
function hubFor(from: string, to: string, seed: number): string {
	let hubs = ["KSH", "PAC", "AMB", "TMS"].filter((code) => code !== from && code !== to);
	return hubs[seed % hubs.length]!;
}

/**
 * Every flight from one airport to another on a day, generated from the route and the day so
 * the schedule is stable. Some days are pricier than others, which the fare calendar shows.
 *
 * @param from Origin code.
 * @param to Destination code.
 * @param day Departure day in the origin's zone.
 * @returns Options sorted by departure.
 */
export function flightsOn(from: string, to: string, day: string): FlightOption[] {
	let origin = findAirport(from);
	let destination = findAirport(to);
	if (origin === undefined || destination === undefined || origin === destination) return [];
	let options: FlightOption[] = [];
	let count = 5 + (hashOf(`${from}${to}${day}`) % 4);
	for (let index = 0; index < count; index++) {
		let seed = hashOf(`${from}-${to}-${day}-${index}`);
		let airline = AIRLINES[seed % AIRLINES.length]!;
		let stops = distance(origin, destination) < 900 ? 0 : [0, 0, 1, 1, 2][(seed >>> 3) % 5]!;
		let departMinutes = 6 * 60 + ((seed >>> 6) % 64) * 15;
		let departs = zonedInstant(day, departMinutes % (24 * 60), origin.timeZone);
		let route = [origin.code];
		if (stops >= 1) route.push(hubFor(from, to, seed >>> 9));
		if (stops === 2) route.push(hubFor(from, to, (seed >>> 9) + 1));
		route.push(destination.code);
		let segments: Segment[] = [];
		let clock = departs;
		for (let leg = 0; leg < route.length - 1; leg++) {
			let a = findAirport(route[leg]!)!;
			let b = findAirport(route[leg + 1]!)!;
			if (a === b) continue;
			let minutes = flyingMinutes(a, b);
			let aircraft = AIRCRAFT[(seed >>> (leg + 12)) % AIRCRAFT.length]!;
			segments.push({
				airline: airline.code,
				flight: `${airline.code} ${100 + ((seed >>> (leg * 4)) % 880)}`,
				from: a.code,
				to: b.code,
				departs: clock,
				arrives: clock + minutes * 60_000,
				aircraft: aircraft.name,
			});
			clock += (minutes + 55 + ((seed >>> (leg + 20)) % 6) * 25) * 60_000;
		}
		let weekdayFactor = [1.18, 0.92, 0.88, 0.9, 1.08, 1.24, 1.12][
			new Date(`${day}T00:00:00Z`).getUTCDay()
		]!;
		let base = 9_000 + distance(origin, destination) * 7.5;
		let swing = 0.82 + ((seed >>> 14) % 40) / 100;
		let price =
			Math.round((base * weekdayFactor * swing * (stops === 0 ? 1.15 : 1 - stops * 0.08)) / 100) *
			100;
		options.push({ id: `${from}-${to}-${day}-${index}`, segments, price });
	}
	return options.sort((a, b) => a.segments[0]!.departs - b.segments[0]!.departs);
}

/** Finds one flight option by its id, which names its route, day and index. */
export function findFlight(id: string): FlightOption | undefined {
	let [from = "", to = "", ...rest] = id.split("-");
	let day = rest.slice(0, 3).join("-");
	return flightsOn(from, to, day).find((option) => option.id === id);
}

/** The cheapest Basic fare on a route for a day, or `undefined` when nothing flies. */
export function cheapestOn(from: string, to: string, day: string): number | undefined {
	let prices = flightsOn(from, to, day).map((option) => option.price);
	return prices.length === 0 ? undefined : Math.min(...prices);
}

/** An option's whole journey time, departure to final arrival, in minutes. */
export function journeyMinutes(option: FlightOption): number {
	return Math.round((option.segments.at(-1)!.arrives - option.segments[0]!.departs) / 60_000);
}

/** The price of an option in a fare class for one traveller, in US cents. */
export function farePrice(option: FlightOption, fare: FareClass): number {
	let factor = FARE_CLASSES.find((entry) => entry.id === fare)?.factor ?? 1;
	return Math.round((option.price * factor) / 100) * 100;
}

/** A seat in a cabin, as the seat map draws it. */
export interface Seat {
	id: string;
	status: "available" | "taken";
	kind: "standard" | "extra-legroom" | "exit";
	/** What choosing it costs on a Basic fare, in US cents. */
	price: number;
}

/** A seat's kind: the exit rows' extra room, the first rows' legroom, or standard. */
function seatKind(row: number, exits: number[]): Seat["kind"] {
	if (exits.includes(row)) return "exit";
	return row <= 4 ? "extra-legroom" : "standard";
}

/**
 * The cabin of a segment: its layout and every seat, about two thirds taken, placed by the
 * flight and day so a seat map stays the same between visits.
 */
export function cabinOf(segment: Segment): {
	layout: string;
	rows: Array<{ number: number; seats: Seat[] }>;
	exits: number[];
} {
	let aircraft = AIRCRAFT.find((entry) => entry.name === segment.aircraft) ?? AIRCRAFT[0];
	let letters = aircraft.layout.replaceAll(" ", "").split("");
	let exits = [Math.round(aircraft.rows * 0.4), Math.round(aircraft.rows * 0.4) + 1];
	let rows = Array.from({ length: aircraft.rows }, (_, index) => {
		let number = index + 1;
		return {
			number,
			seats: letters.map((letter) => {
				let seed = hashOf(`${segment.flight}${segment.departs}${number}${letter}`);
				let kind = seatKind(number, exits);
				return {
					id: `${number}${letter}`,
					status: seed % 100 < 62 ? "taken" : "available",
					kind,
					price:
						kind === "standard"
							? 1_500 + (letter === "A" || letter === letters.at(-1) ? 800 : 0)
							: 4_200,
				} satisfies Seat;
			}),
		};
	});
	return { layout: aircraft.layout, rows, exits };
}

/**
 * Days around a departure for the fare calendar and the strip above results.
 *
 * @param day The day searched.
 * @param before How many days before it.
 * @param after How many days after it.
 */
export function daysAround(day: string, before: number, after: number): string[] {
	return Array.from({ length: before + after + 1 }, (_, index) => addDays(day, index - before));
}
