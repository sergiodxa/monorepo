/**
 * Wayfern's invented car rentals: three companies, five classes of car and the extras a desk
 * offers, priced per day from a seed per place, so every visitor sees the same offers. A rental
 * runs from a pickup place and time to a drop-off, which may be somewhere else for a fee.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { hashOf } from "./data";

/** One invented rental company. */
export interface RentalCompany {
	id: string;
	name: string;
	rating: number;
	hue: number;
}

/** The companies with desks at the Lowmere coast's airports and towns. */
export const RENTAL_COMPANIES: RentalCompany[] = [
	{ id: "tallow", name: "Tallow Rent", rating: 4.6, hue: 140 },
	{ id: "roamwell", name: "Roamwell", rating: 4.3, hue: 30 },
	{ id: "kestrel", name: "Kestrel Cars", rating: 4.8, hue: 215 },
];

/** One class of car, with what it carries. */
export interface CarClass {
	id: string;
	name: string;
	/** An invented example model, shown "or similar". */
	model: string;
	seats: number;
	bags: number;
	transmission: "Manual" | "Automatic";
	fuel: "Petrol" | "Hybrid" | "Electric";
	/** A weekday's rate, in US cents. */
	daily: number;
	/** The shape the card's drawing takes. */
	body: "hatch" | "sedan" | "suv" | "van" | "wagon";
	hue: number;
}

/** Every class, smallest first. */
export const CAR_CLASSES: CarClass[] = [
	{
		id: "mini",
		name: "Mini",
		model: "Velo C1",
		seats: 4,
		bags: 1,
		transmission: "Manual",
		fuel: "Petrol",
		daily: 3_400,
		body: "hatch",
		hue: 20,
	},
	{
		id: "compact",
		name: "Compact",
		model: "Velo C3",
		seats: 5,
		bags: 2,
		transmission: "Automatic",
		fuel: "Hybrid",
		daily: 4_600,
		body: "hatch",
		hue: 200,
	},
	{
		id: "estate",
		name: "Estate",
		model: "Orrin Tourer",
		seats: 5,
		bags: 4,
		transmission: "Automatic",
		fuel: "Petrol",
		daily: 5_900,
		body: "wagon",
		hue: 140,
	},
	{
		id: "suv",
		name: "SUV",
		model: "Harrow X5 Trail",
		seats: 5,
		bags: 3,
		transmission: "Automatic",
		fuel: "Electric",
		daily: 7_800,
		body: "suv",
		hue: 260,
	},
	{
		id: "van",
		name: "People carrier",
		model: "Ostra Nine",
		seats: 8,
		bags: 5,
		transmission: "Automatic",
		fuel: "Petrol",
		daily: 9_400,
		body: "van",
		hue: 50,
	},
];

/** The extras a desk offers, each per day unless `once`. */
export const CAR_EXTRAS = [
	{ id: "child-seat", label: "Child seat", daily: 900 },
	{ id: "gps", label: "Navigation unit", daily: 700 },
	{ id: "driver", label: "Additional driver", daily: 1_200 },
	{ id: "cover", label: "Full damage cover", daily: 1_900 },
] as const;

/** One extra's id. */
export type CarExtra = (typeof CAR_EXTRAS)[number]["id"];

/** Where a car can be picked up or dropped off. */
export const RENTAL_PLACES = [
	{ id: "MRW", name: "Merrow Bay Coastal airport" },
	{ id: "VLS", name: "Vellis Market Field airport" },
	{ id: "merrow-bay", name: "Merrow Bay harbour office" },
	{ id: "vellis", name: "Vellis town office" },
	{ id: "tallow-pines", name: "Tallow Pines visitor centre" },
] as const;

/** The fee for leaving a car somewhere other than where it was picked up, in US cents. */
export const ONE_WAY_FEE = 4_500;

/** One car on offer: a class from a company at a place. */
export interface CarOfferData {
	id: string;
	company: RentalCompany;
	car: CarClass;
	/** This offer's rate per day, in US cents. */
	daily: number;
	/** Free cancellation until pickup. */
	freeCancel: boolean;
}

/** Finds a rental place by id. */
export function findRentalPlace(id: string): (typeof RENTAL_PLACES)[number] | undefined {
	return RENTAL_PLACES.find((place) => place.id === id);
}

/**
 * The offers at a pickup place, one per company and class that company keeps there, each
 * priced from a seed so the same search always shows the same prices.
 *
 * @param place A {@link RENTAL_PLACES} id.
 */
export function carOffers(place: string): CarOfferData[] {
	let offers: CarOfferData[] = [];
	for (let company of RENTAL_COMPANIES) {
		for (let car of CAR_CLASSES) {
			let seed = hashOf(`${place}:${company.id}:${car.id}`);
			if (seed % 4 === 0) continue;
			offers.push({
				id: `${company.id}.${car.id}`,
				company,
				car,
				daily: Math.round((car.daily * (0.86 + (seed % 30) / 100)) / 100) * 100,
				freeCancel: seed % 3 !== 0,
			});
		}
	}
	return offers.sort((a, b) => a.daily - b.daily);
}

/** Finds one offer at a place by its `company.class` id. */
export function findCarOffer(place: string, id: string): CarOfferData | undefined {
	return carOffers(place).find((offer) => offer.id === id);
}

/** Rental days between two instants: every started 24 hours counts as a day, at least one. */
export function rentalDays(pickup: number, dropoff: number): number {
	return Math.max(1, Math.ceil((dropoff - pickup) / 86_400_000));
}

/** A car search as its address carries it. */
export interface CarSearch {
	place: string;
	/** Where the car goes back; the pickup place unless the visitor picked another. */
	dropoff: string;
	pickupDay?: string;
	/** `HH:MM`, on the half hour. */
	pickupTime: string;
	dropoffDay?: string;
	dropoffTime: string;
	/** Car classes to show; every class when empty. */
	classes: string[];
	sort: "price" | "rating";
}

/** Reads a half-hour time, falling back when the text is anything else. */
function readTime(text: string | null, fallback: string): string {
	return text !== null && /^([01]\d|2[0-3]):(00|30)$/.test(text) ? text : fallback;
}

/**
 * Reads a car search from an address: unknown places fall back to the coast's main airport,
 * and a drop-off on or before the pickup is dropped.
 *
 * @param params The address's query.
 * @param readDay Reads a day key, rejecting impossible dates.
 */
export function readCarSearch(
	params: URLSearchParams,
	readDay: (key: string | null) => string | undefined,
): CarSearch {
	let place = findRentalPlace(params.get("pickup") ?? "")?.id ?? "MRW";
	let dropoff = findRentalPlace(params.get("dropoff") ?? "")?.id ?? place;
	let pickupDay = readDay(params.get("pickupday"));
	let dropoffDay = readDay(params.get("dropoffday"));
	if (pickupDay === undefined || dropoffDay === undefined || dropoffDay < pickupDay)
		dropoffDay = undefined;
	let sort: CarSearch["sort"] = params.get("sort") === "rating" ? "rating" : "price";
	return {
		place,
		dropoff,
		pickupDay,
		pickupTime: readTime(params.get("at"), "10:00"),
		dropoffDay,
		dropoffTime: readTime(params.get("until"), "10:00"),
		classes: params.getAll("class").filter((id) => CAR_CLASSES.some((car) => car.id === id)),
		sort,
	};
}

/** Writes a car search back to a query, leaving out defaults. */
export function writeCarSearch(search: CarSearch): string {
	let params = new URLSearchParams();
	params.set("pickup", search.place);
	if (search.dropoff !== search.place) params.set("dropoff", search.dropoff);
	if (search.pickupDay !== undefined) params.set("pickupday", search.pickupDay);
	if (search.dropoffDay !== undefined) params.set("dropoffday", search.dropoffDay);
	if (search.pickupTime !== "10:00") params.set("at", search.pickupTime);
	if (search.dropoffTime !== "10:00") params.set("until", search.dropoffTime);
	for (let id of search.classes) params.append("class", id);
	if (search.sort !== "price") params.set("sort", search.sort);
	return params.toString();
}
