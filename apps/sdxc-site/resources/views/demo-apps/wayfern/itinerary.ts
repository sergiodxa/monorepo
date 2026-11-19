/**
 * Everything a traveller booked as one itinerary: each stay, flight segment and car rental as
 * an item with real instants in its own zones, gathered into journeys, and each journey as a
 * JSCalendar group that exports to iCalendar or imports into a calendar app.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { JSCalendar } from "@sdxc/jscalendar";

import { stringify as stringifyICalendar } from "@sdxc/icalendar";
import { toICalendar } from "@sdxc/jscalendar/icalendar";
import { isFailure } from "@sdxc/result";

import type { Traveller, Trip } from "./state";

import { CAR_CLASSES, findCarOffer, findRentalPlace } from "./cars";
import { findStay, placeOf } from "./data";
import { findAirline, findAirport, findFlight, localTime, zonedInstant } from "./flights";

/** The zone every place on the Lowmere coast keeps, where stays and cars start and end. */
export const COAST_ZONE = "Atlantic/Azores";

/** Check-in and check-out times on the coast, in minutes after midnight. */
const CHECK_IN = 15 * 60;
const CHECK_OUT = 11 * 60;

/** Two bookings this close in time belong to the same journey. */
const JOURNEY_GAP_MS = 2 * 86_400_000;

/** One thing on the itinerary: a stay, one flight segment, or a car rental. */
export interface ItineraryItem {
	/** Stable across visits, used as the calendar event's uid. */
	uid: string;
	trip: string;
	kind: "stay" | "flight" | "car";
	title: string;
	/** Where it starts and, for a flight or a one-way rental, where it ends. */
	from: string;
	to?: string;
	starts: number;
	ends: number;
	startZone: string;
	endZone: string;
	status: "confirmed" | "cancelled";
	/** A short line under the title, such as the seat or the car class. */
	detail: string;
}

/** A run of bookings close together in time, shown and exported as one trip. */
export interface Journey {
	id: string;
	title: string;
	items: ItineraryItem[];
	starts: number;
	ends: number;
}

/** A local `YYYY-MM-DDTHH:MM` reading in the coast's zone as an instant. */
function coastInstant(local: string): number {
	return zonedInstant(
		local.slice(0, 10),
		Number(local.slice(11, 13)) * 60 + Number(local.slice(14, 16)),
		COAST_ZONE,
	);
}

/**
 * One booking's items: a stay is one item, a flight one per segment of every leg, a car one.
 *
 * @param trip The booking.
 */
export function itemsOf(trip: Trip): ItineraryItem[] {
	if (trip.kind === "stay") {
		let stay = findStay(trip.stay);
		if (stay === undefined) return [];
		return [
			{
				uid: `${trip.id}-stay@wayfern.demo`,
				trip: trip.id,
				kind: "stay",
				title: `Stay at ${stay.name}`,
				from: `${stay.name}, ${placeOf(stay).name}`,
				starts: zonedInstant(trip.start, CHECK_IN, COAST_ZONE),
				ends: zonedInstant(trip.end, CHECK_OUT, COAST_ZONE),
				startZone: COAST_ZONE,
				endZone: COAST_ZONE,
				status: trip.status,
				detail: `${trip.adults + trip.children} guests · confirmation ${trip.id}`,
			},
		];
	}
	if (trip.kind === "car") {
		let offer = findCarOffer(trip.place, trip.offer);
		let pickup = findRentalPlace(trip.place)?.name ?? trip.place;
		let dropoff = findRentalPlace(trip.dropoff)?.name ?? trip.dropoff;
		return [
			{
				uid: `${trip.id}-car@wayfern.demo`,
				trip: trip.id,
				kind: "car",
				title: `${offer?.company.name ?? "Rental"} car`,
				from: pickup,
				to: trip.dropoff === trip.place ? undefined : dropoff,
				starts: coastInstant(trip.pickupAt),
				ends: coastInstant(trip.dropoffAt),
				startZone: COAST_ZONE,
				endZone: COAST_ZONE,
				status: trip.status,
				detail: `${CAR_CLASSES.find((car) => car.id === offer?.car.id)?.name ?? "Car"} · ${offer?.car.model ?? ""} or similar`,
			},
		];
	}
	let items: ItineraryItem[] = [];
	let count = 0;
	for (let leg of trip.legs) {
		let option = findFlight(leg.option);
		if (option === undefined) continue;
		option.segments.forEach((segment, index) => {
			count += 1;
			let from = findAirport(segment.from)!;
			let to = findAirport(segment.to)!;
			items.push({
				uid: `${trip.id}-flight-${count}@wayfern.demo`,
				trip: trip.id,
				kind: "flight",
				title: `${segment.flight} ${from.code} → ${to.code}`,
				from: `${from.city} (${from.code})`,
				to: `${to.city} (${to.code})`,
				starts: segment.departs,
				ends: segment.arrives,
				startZone: from.timeZone,
				endZone: to.timeZone,
				status: trip.status,
				detail: `${findAirline(segment.airline)?.name ?? segment.airline} · seat ${leg.seats[index] ?? "—"}`,
			});
		});
	}
	return items;
}

/**
 * The traveller's journeys, soonest first: confirmed and cancelled bookings alike, each item
 * placed with the bookings it overlaps or nearly touches.
 *
 * @param traveller The visitor.
 */
export function journeysOf(traveller: Traveller): Journey[] {
	let items = traveller.trips.flatMap(itemsOf).sort((a, b) => a.starts - b.starts);
	let journeys: Journey[] = [];
	for (let item of items) {
		let last = journeys.at(-1);
		if (last !== undefined && item.starts - last.ends <= JOURNEY_GAP_MS) {
			last.items.push(item);
			last.ends = Math.max(last.ends, item.ends);
			continue;
		}
		journeys.push({
			id: item.trip,
			title: "",
			items: [item],
			starts: item.starts,
			ends: item.ends,
		});
	}
	for (let journey of journeys) journey.title = journeyTitle(journey);
	return journeys;
}

/** A journey's name: where its stay or its last flight lands, such as "Tallow Pines". */
function journeyTitle(journey: Journey): string {
	let stay = journey.items.find((item) => item.kind === "stay");
	if (stay !== undefined) return stay.from.split(", ").at(-1) ?? stay.from;
	let flight = journey.items.find((item) => item.kind === "flight");
	return flight?.to ?? journey.items[0]?.from ?? "Trip";
}

/** Minutes as an RFC 8984 duration, such as `P3DT20H`. */
function duration(milliseconds: number): string {
	let minutes = Math.max(0, Math.round(milliseconds / 60_000));
	let days = Math.floor(minutes / 1440);
	let hours = Math.floor((minutes % 1440) / 60);
	let rest = minutes % 60;
	let time = `${hours > 0 ? `${hours}H` : ""}${rest > 0 ? `${rest}M` : ""}`;
	if (time === "") return days > 0 ? `P${days}D` : "PT0M";
	return `P${days > 0 ? `${days}D` : ""}T${time}`;
}

/**
 * An item as a JSCalendar event: its start read in its own zone, its duration, and where it
 * starts and ends, the arrival zone on the end location so a flight lands at the local time.
 *
 * @param item The itinerary item.
 */
export function toEvent(item: ItineraryItem): JSCalendar.Event {
	let start = localTime(item.starts, item.startZone);
	let locations: Record<string, JSCalendar.Location> = {
		start: { "@type": "Location", name: item.from, relativeTo: "start", timeZone: item.startZone },
	};
	if (item.to !== undefined) {
		locations.end = {
			"@type": "Location",
			name: item.to,
			relativeTo: "end",
			timeZone: item.endZone,
		};
	}
	return {
		"@type": "Event",
		uid: item.uid,
		title: item.title,
		description: item.detail,
		start: `${start.day}T${start.time}:00`,
		timeZone: item.startZone,
		duration: duration(item.ends - item.starts),
		status: item.status,
		locations,
	};
}

/**
 * A journey as a JSCalendar group of its events, the document "Add to calendar" exports and a
 * calendar app imports.
 *
 * @param journey The journey.
 */
export function toGroup(journey: Journey): JSCalendar.Group {
	return {
		"@type": "Group",
		uid: `${journey.id}-journey@wayfern.demo`,
		prodId: "-//Wayfern demo//Trips//EN",
		title: `Trip to ${journey.title}`,
		entries: journey.items.map(toEvent),
	};
}

/**
 * A group or a single event as an iCalendar document, for an `.ics` download.
 *
 * @param object What to export.
 * @returns The `.ics` text, or `null` when the conversion refused it.
 */
export function toIcs(object: JSCalendar.Group | JSCalendar.Event): string | null {
	let converted = toICalendar(object);
	return isFailure(converted) ? null : stringifyICalendar(converted.data);
}
