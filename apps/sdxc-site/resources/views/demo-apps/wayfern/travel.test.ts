/**
 * Holds Wayfern's travel rules to what a traveller relies on: flights keep their own zones and
 * stable schedules, flight searches survive the address, a trip's bookings gather into one
 * journey, and that journey exports to calendars with each flight landing at its local time.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { fetchApp } from "~/app/test/router";

import { carOffers, readCarSearch, writeCarSearch } from "./cars";
import { addDays, readDay, today } from "./days";
import { currentLeg, findFlights, readFlightSearch, writeFlightSearch } from "./flight-query";
import {
	findAirport,
	findFlight,
	flightsOn,
	journeyMinutes,
	localTime,
	zonedInstant,
} from "./flights";
import { journeysOf, toEvent, toGroup, toIcs } from "./itinerary";
import { readTraveller, tripsCookie } from "./state";
import { carQuote, flightQuote, packageSaving } from "./travel-pricing";

/** A day far enough ahead to fly, fixed relative to today. */
const DAY = addDays(today(), 40);

describe("Wayfern's flights", () => {
	test("reads local wall-clock times in each airport's zone", () => {
		let instant = zonedInstant("2026-07-01", 9 * 60, "America/New_York");
		expect(new Date(instant).toISOString()).toBe("2026-07-01T13:00:00.000Z");
		expect(localTime(instant, "Atlantic/Azores").time).toBe("13:00");
		expect(findAirport("Ponta Delgada (MRW)")?.code).toBe("MRW");
		expect(findAirport("vila franca")?.code).toBe("VLS");
	});

	test("generates the same schedule for a route and day, findable by id", () => {
		let options = flightsOn("SRL", "MRW", DAY);
		expect(options.length).toBeGreaterThan(4);
		expect(flightsOn("SRL", "MRW", DAY)).toEqual(options);
		let option = options[0]!;
		expect(findFlight(option.id)).toEqual(option);
		expect(option.segments[0]!.from).toBe("SRL");
		expect(option.segments.at(-1)!.to).toBe("MRW");
		expect(journeyMinutes(option)).toBeGreaterThan(180);
	});

	test("keeps a round trip, its picks and its filters in the address", () => {
		let search = readFlightSearch(
			new URLSearchParams(
				`from=New York (SRL)&to=MRW&depart=${DAY}&return=${addDays(DAY, 5)}&adults=2&stops=0&sort=cheapest`,
			),
		);
		expect(search.legs.map((leg) => `${leg.from}-${leg.to}`)).toEqual(["SRL-MRW", "MRW-SRL"]);
		expect(currentLeg(search)?.from).toBe("SRL");
		let pick = findFlights(search, search.legs[0]!)[0];
		let picked = readFlightSearch(
			new URLSearchParams(`${writeFlightSearch(search)}&pick=${pick?.id ?? ""}`),
		);
		expect(picked.picks).toEqual(pick === undefined ? [] : [pick.id]);
		expect(currentLeg(picked)?.from).toBe(pick === undefined ? "SRL" : "MRW");
		expect(
			findFlights(search, search.legs[0]!).every((option) => option.segments.length === 1),
		).toBe(true);
	});

	test("drops a pick that belongs to another leg", () => {
		let other = flightsOn("TMS", "MRW", DAY)[0]!;
		let search = readFlightSearch(
			new URLSearchParams(`trip=one&from=SRL&to=MRW&depart=${DAY}&pick=${other.id}`),
		);
		expect(search.picks).toEqual([]);
	});

	test("prices children below adults and adds taxes per traveller and leg", () => {
		let option = flightsOn("SRL", "MRW", DAY)[0]!;
		let adult = flightQuote([{ option, fare: "standard", seatFees: 0 }], 1, 0);
		let family = flightQuote([{ option, fare: "standard", seatFees: 0 }], 1, 1);
		expect(family.total).toBeGreaterThan(adult.total);
		expect(family.total).toBeLessThan(adult.total * 2);
		expect(family.total).toBe(family.lines.reduce((sum, line) => sum + line.cents, 0));
	});
});

describe("Wayfern's cars", () => {
	test("reads a car search and charges a one-way drop-off", () => {
		let search = readCarSearch(
			new URLSearchParams(
				`pickup=MRW&dropoff=vila-franca&pickupday=${DAY}&dropoffday=${addDays(DAY, 3)}&at=09:30`,
			),
			readDay,
		);
		expect(search.dropoff).toBe("vila-franca");
		expect(writeCarSearch(search)).toContain("at=09%3A30");
		let offer = carOffers("MRW")[0]!;
		let pickup = zonedInstant(DAY, 9 * 60 + 30, "Atlantic/Azores");
		let quote = carQuote(offer, pickup, pickup + 3 * 86_400_000, ["gps"], true);
		expect(quote.nights).toBe(3);
		expect(quote.lines.map((line) => line.label)).toContain("One-way drop-off");
		expect(packageSaving(100_000)).toBe(12_000);
	});
});

describe("Wayfern's itinerary", () => {
	test("gathers the starting trip's flights, stay and car into one journey", () => {
		let traveller = readTraveller(null, today());
		let journeys = journeysOf(traveller);
		let upcoming = journeys.find((journey) =>
			journey.items.some((item) => item.kind === "flight"),
		)!;
		expect(new Set(upcoming.items.map((item) => item.kind))).toEqual(
			new Set(["flight", "stay", "car"]),
		);
		expect(upcoming.title).toBe("Furnas");
	});

	test("survives the trips cookie with every kind of booking", () => {
		let traveller = readTraveller(null, today());
		let cookie = tripsCookie(traveller.trips).split(";")[0]!;
		expect(readTraveller(cookie, today()).trips).toEqual(traveller.trips);
		expect(readTraveller("wayfern.trips=not-base64!!", today()).trips).toEqual([]);
	});

	test("exports a flight in its departure zone with the arrival zone on its end location", () => {
		let traveller = readTraveller(null, today());
		let flight = journeysOf(traveller)
			.flatMap((journey) => journey.items)
			.find((item) => item.kind === "flight")!;
		let event = toEvent(flight);
		expect(event.timeZone).toBe(flight.startZone);
		expect(event.locations?.end?.timeZone).toBe(flight.endZone);
		expect(event.duration).toMatch(/^PT\d+H(\d+M)?$/);
		let ics = toIcs(toGroup(journeysOf(traveller)[0]!));
		expect(ics).toContain("BEGIN:VCALENDAR");
		expect(ics).toContain("BEGIN:VEVENT");
	});
});

/** Posts a form to a Wayfern action path with the given cookie. */
async function post(page: string, fields: Array<[string, string]>, cookie = "") {
	return await fetchApp(`/demo/apps/wayfern/${page}`, {
		method: "POST",
		body: new URLSearchParams(fields),
		headers: cookie === "" ? {} : { Cookie: cookie },
		redirect: "manual",
	});
}

/** The `name=value` part of every `Set-Cookie` a response carries. */
function cookiesOf(response: Response): string {
	return response.headers
		.getSetCookie()
		.map((cookie) => cookie.split(";")[0])
		.join("; ");
}

describe("Wayfern's travel bookings", () => {
	test("books a round trip's flights and shows a boarding pass per segment", async () => {
		let out = flightsOn("SRL", "MRW", DAY)[0]!;
		let back = flightsOn("MRW", "SRL", addDays(DAY, 5))[0]!;
		let response = await post("flights/book", [
			["from", "SRL"],
			["to", "MRW"],
			["depart", DAY],
			["return", addDays(DAY, 5)],
			["pick", out.id],
			["pick", back.id],
			["fare", "flex"],
			["given", "Ada"],
			["family", "Okafor"],
			["card", "fern-visa"],
		]);
		let location = response.headers.get("Location") ?? "";
		expect(location).toMatch(/^\/demo\/apps\/wayfern\/trips\/WF-[A-Z0-9]{5}\?toast=booked\./);
		let page = await (
			await fetchApp(location.split("?")[0]!, { headers: { Cookie: cookiesOf(response) } })
		).text();
		let segments = out.segments.length + back.segments.length;
		expect(page.match(/Boarding pass for /g)?.length).toBe(segments);
		expect(page).toContain("ADA OKAFOR");
	});

	test("sends a flight booking without names back to its form, keeping the picks", async () => {
		let out = flightsOn("SRL", "MRW", DAY)[0]!;
		let response = await post("flights/book", [
			["trip", "one"],
			["from", "SRL"],
			["to", "MRW"],
			["depart", DAY],
			["pick", out.id],
			["given", ""],
			["family", ""],
			["card", "fern-visa"],
		]);
		let location = response.headers.get("Location") ?? "";
		expect(location).toContain("/demo/apps/wayfern/flights/seats?");
		expect(location).toContain(`pick=${out.id}`);
		expect(location).toContain("problem=names");
	});

	test("books a car one way and a package as a flight and a stay", async () => {
		let car = await post(`cars/${carOffers("MRW")[0]!.id}/book`, [
			["pickup", "MRW"],
			["dropoff", "vila-franca"],
			["pickupday", DAY],
			["dropoffday", addDays(DAY, 3)],
			["extra", "gps"],
			["card", "dune-amex"],
		]);
		expect(car.headers.get("Location")).toMatch(/\/trips\/WF-[A-Z0-9]{5}\?toast=booked/);
		let trips = readTraveller(cookiesOf(car), today()).trips;
		expect(trips[0]).toMatchObject({ kind: "car", dropoff: "vila-franca", extras: ["gps"] });
		let pack = await post("packages/the-canopy/book", [
			["checkin", addDays(DAY, 60)],
			["checkout", addDays(DAY, 63)],
			["origin", "SRL"],
			["card", "fern-visa"],
		]);
		let booked = readTraveller(cookiesOf(pack), today()).trips;
		expect(booked.slice(0, 2).map((trip) => trip.kind)).toEqual(["flight", "stay"]);
		expect(booked[0]!.bundle).toBe(booked[1]!.bundle);
	});

	test("downloads a journey as iCalendar with every flight, the stay and the car", async () => {
		let response = await fetchApp("/demo/apps/wayfern/files/journey/WF-8F2TL.ics");
		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toContain("text/calendar");
		let ics = await response.text();
		expect(ics.match(/BEGIN:VEVENT/g)?.length).toBeGreaterThanOrEqual(4);
		expect(ics).toContain("UID:WF-7M3QK-stay@wayfern.demo");
		expect((await fetchApp("/demo/apps/wayfern/files/journey/WF-ZZZZZ.ics")).status).toBe(404);
	});
});

describe("Wayfern's content security policy", () => {
	test("allows the map's tile host on Wayfern's pages and on no other demo", async () => {
		let wayfern =
			(await fetchApp("/demo/apps/wayfern/s")).headers.get("Content-Security-Policy-Report-Only") ??
			"";
		expect(wayfern).toMatch(/connect-src[^;]*https:\/\/tiles\.openfreemap\.org/);
		expect(wayfern).toMatch(/img-src[^;]*https:\/\/tiles\.openfreemap\.org[^;]*blob:/);
		expect(wayfern).toMatch(/worker-src[^;]*blob:/);
		let pulse =
			(await fetchApp("/demo/apps/pulse")).headers.get("Content-Security-Policy-Report-Only") ?? "";
		expect(pulse).not.toContain("openfreemap");
	});
});
