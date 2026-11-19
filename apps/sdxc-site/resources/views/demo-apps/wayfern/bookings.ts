/**
 * What a booking post does for flights, cars and packages: read the form, check it, and add
 * the trip to the visitor's cookie, landing on its confirmation. A flight booking that can't go
 * through returns to its form with the problem named in the address, keeping every pick.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { calendarResponse } from "@sdxc/icalendar";
import { toICalendar } from "@sdxc/jscalendar/icalendar";
import { isFailure } from "@sdxc/result";

import type { DemoAppRedirect, DemoAppRequest } from "~/resources/views/demo-apps";

import type { CarExtra } from "./cars";
import type { Journey } from "./itinerary";
import type { CarTrip, FlightTrip, StayTrip, Traveller, Trip } from "./state";

import { CAR_EXTRAS, findCarOffer, readCarSearch, writeCarSearch } from "./cars";
import { findCard, findStay } from "./data";
import { addDays, readDay, today as todayKey } from "./days";
import { readFlightSearch, writeFlightSearch } from "./flight-query";
import { cabinOf, findFlight } from "./flights";
import { itemsOf, journeysOf, toGroup } from "./itinerary";
import { dealFor } from "./packages-view";
import { readSearch } from "./query";
import { heldNights, readTraveller, tripCode, tripsCookie } from "./state";

/** What each flight booking problem the address names says to the traveller. */
export const FLIGHT_PROBLEMS: Record<string, string> = {
	names: "Add a given name and surname for every traveller.",
	card: "Choose a saved card to pay with.",
	flights: "Those flights can't be booked any more. Pick them again.",
};

/** A form's text fields as address parameters, for the query readers. */
function asParams(form: FormData): URLSearchParams {
	let params = new URLSearchParams();
	for (let [name, value] of form) if (typeof value === "string") params.append(name, value);
	return params;
}

/** A new trip code, distinct from the visitor's existing ones. */
function newCode(traveller: Traveller, salt: number): string {
	let code = tripCode(Date.now() + salt + traveller.trips.length * 7919);
	while (traveller.trips.some((trip) => trip.id === code))
		code = tripCode(Date.now() + Math.random() * 1e6);
	return code;
}

/**
 * Books the flights a checkout form carries: every leg picked, a name for every traveller and
 * a saved card. Seats a segment lacks are filled with the first free one.
 */
export function bookFlights(
	form: FormData,
	request: DemoAppRequest,
	traveller: Traveller,
): DemoAppRedirect | null {
	void request;
	let params = asParams(form);
	let search = readFlightSearch(params);
	let given = params.getAll("given").map((name) => name.trim());
	let family = params.getAll("family").map((name) => name.trim());
	let travellers = search.adults + search.children;
	let problem: string | undefined;
	if (search.legs.length === 0 || search.picks.length !== search.legs.length) problem = "flights";
	else if (
		given.length < travellers ||
		[...given, ...family].slice(0, travellers * 2).some((name) => name === "" || name.length > 40)
	)
		problem = "names";
	else if (findCard(params.get("card") ?? "") === undefined) problem = "card";
	if (problem !== undefined) {
		let back = new URLSearchParams(writeFlightSearch(search, false));
		for (let seat of params.getAll("seat")) back.append("seat", seat);
		back.set("problem", problem);
		return { page: `flights/seats?${back}` };
	}
	let seats = params.getAll("seat");
	let at = 0;
	let legs = search.picks.map((id) => {
		let option = findFlight(id)!;
		return {
			option: id,
			fare: search.fare,
			seats: option.segments.map((segment) => {
				let picked = seats[at++];
				let free = cabinOf(segment)
					.rows.flatMap((row) => row.seats)
					.find((seat) => seat.status === "available");
				return picked !== undefined && /^\d{1,2}[A-K]$/.test(picked) ? picked : (free?.id ?? "1A");
			}),
		};
	});
	let trip: FlightTrip = {
		kind: "flight",
		id: newCode(traveller, 11),
		card: params.get("card")!,
		status: "confirmed",
		legs,
		adults: search.adults,
		children: search.children,
		lead: `${given[0]} ${family[0]}`.slice(0, 60),
	};
	return {
		page: `trips/${trip.id}`,
		toast: "booked",
		cookies: [tripsCookie([trip, ...traveller.trips])],
	};
}

/** Books one car offer with its extras for the form's pickup and drop-off. */
export function bookCar(
	offerId: string,
	form: FormData,
	traveller: Traveller,
): DemoAppRedirect | null {
	let params = asParams(form);
	let search = readCarSearch(params, readDay);
	let offer = findCarOffer(search.place, offerId);
	let card = params.get("card") ?? "";
	if (offer === undefined || findCard(card) === undefined || search.pickupDay === undefined)
		return null;
	let dropoffDay = search.dropoffDay ?? addDays(search.pickupDay, 3);
	let trip: CarTrip = {
		kind: "car",
		id: newCode(traveller, 23),
		card,
		status: "confirmed",
		place: search.place,
		dropoff: search.dropoff,
		offer: offer.id,
		pickupAt: `${search.pickupDay}T${search.pickupTime}`,
		dropoffAt: `${dropoffDay}T${search.dropoffTime}`,
		extras: params
			.getAll("extra")
			.filter((id): id is CarExtra => CAR_EXTRAS.some((extra) => extra.id === id)),
	};
	if (trip.dropoffAt <= trip.pickupAt)
		return { page: `cars/${offer.id}?${writeCarSearch(search)}` };
	return {
		page: `trips/${trip.id}`,
		toast: "booked",
		cookies: [tripsCookie([trip, ...traveller.trips])],
	};
}

/**
 * Books a package: the stay and both flights as two trips sharing one package code, priced
 * again on the server so a stale page can't book a stay someone else took.
 */
export function bookPackage(
	stayId: string,
	form: FormData,
	traveller: Traveller,
	today: string,
): DemoAppRedirect | null {
	let params = asParams(form);
	let stay = findStay(stayId);
	let card = params.get("card") ?? "";
	if (stay === undefined || findCard(card) === undefined) return null;
	let search = readSearch(params);
	let deal = dealFor(
		stay,
		params.get("origin") ?? "SRL",
		search,
		today,
		heldNights(traveller, stay.id),
	);
	if (deal === undefined) return { page: `stay/${stay.id}` };
	let bundle = newCode(traveller, 37);
	let stayTrip: StayTrip = {
		kind: "stay",
		id: newCode(traveller, 41),
		card,
		status: "confirmed",
		bundle,
		stay: stay.id,
		start: search.start!,
		end: search.end!,
		adults: search.adults,
		children: search.children,
	};
	let flightTrip: FlightTrip = {
		kind: "flight",
		id: bundle,
		card,
		status: "confirmed",
		bundle,
		legs: [
			{ option: deal.out.id, fare: "standard", seats: deal.out.segments.map(() => "12C") },
			{ option: deal.back.id, fare: "standard", seats: deal.back.segments.map(() => "12C") },
		],
		adults: search.adults,
		children: search.children,
		lead: "Sam Rivers",
	};
	let trips: Trip[] = [flightTrip, stayTrip, ...traveller.trips];
	return { page: `trips/${stayTrip.id}`, toast: "booked", cookies: [tripsCookie(trips)] };
}

/** One booking alone as a journey, so its items export without the rest of the trip. */
function bookingJourney(traveller: Traveller, code: string): Journey | undefined {
	let trip = traveller.trips.find((entry) => entry.id === code);
	if (trip === undefined) return undefined;
	let items = itemsOf(trip);
	return {
		id: code,
		title: code,
		items,
		starts: items[0]?.starts ?? 0,
		ends: items.at(-1)?.ends ?? 0,
	};
}

/**
 * The `.ics` download of a whole journey or one booking, read from the visitor's own cookie,
 * so a link only ever exports the trips of the browser that follows it.
 *
 * @param kind A journey, named by its first booking's code, or one booking.
 * @param code The trip code.
 * @param cookie The request's `Cookie` header.
 */
export function icsFile(
	kind: "journey" | "booking",
	code: string,
	cookie: string | null,
): Response | null {
	let traveller = readTraveller(cookie, todayKey());
	let journey =
		kind === "journey"
			? journeysOf(traveller).find((entry) => entry.id === code)
			: bookingJourney(traveller, code);
	if (journey === undefined || journey.items.length === 0) return null;
	let converted = toICalendar(toGroup(journey), { productId: "-//Wayfern demo//Trips//EN" });
	if (isFailure(converted)) return null;
	return calendarResponse(converted.data, { filename: `wayfern-${code}.ics` });
}
