/**
 * Holds Wayfern's server side to what a traveller relies on: a quote adds up to its total, a
 * request can't cross a booked night or overfill a stay, filters in the address find the right
 * stays, and saving, booking and cancelling survive in cookies and only return to Wayfern.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { fetchApp } from "~/app/test/router";

import { findStay } from "./data";
import { addDays, nightsBetween, readDay, today, weekday } from "./days";
import { checkRequest, firstOpening, isBooked, nightPrice, quote } from "./pricing";
import { findStays, readSearch, writeSearch } from "./query";
import { readTraveller, savedCookie, tripsCookie } from "./state";

/** A Monday far enough ahead to book, so tests never depend on today's weekday. */
const MONDAY = (() => {
	let day = addDays(today(), 30);
	while (weekday(day) !== 1) day = addDays(day, 1);
	return day;
})();

/** Posts a form to a Wayfern action path with the given cookie. */
async function post(page: string, fields: Record<string, string>, cookie = "") {
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

describe("Wayfern's days", () => {
	test("reads real days only and counts nights across a year end", () => {
		expect(readDay("2026-02-30")).toBeUndefined();
		expect(readDay("2026-12-31")).toBe("2026-12-31");
		expect(nightsBetween("2026-12-30", addDays("2026-12-30", 4))).toBe(4);
		expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
	});
});

describe("Wayfern's pricing", () => {
	test("charges more for Friday and Saturday nights, and the total is the sum of its lines", () => {
		let stay = findStay("gullwing-cottage")!;
		let friday = addDays(MONDAY, 4);
		expect(nightPrice(stay, friday)).toBeGreaterThan(nightPrice(stay, MONDAY));
		let price = quote(stay, MONDAY, addDays(MONDAY, 7));
		expect(price.nights).toBe(7);
		expect(price.lines.some((line) => line.key === "discount" && line.cents < 0)).toBe(true);
		expect(price.total).toBe(price.lines.reduce((sum, line) => sum + line.cents, 0));
		expect(
			quote(stay, MONDAY, addDays(MONDAY, 3)).lines.some((line) => line.key === "discount"),
		).toBe(false);
	});

	test("refuses a stay below the minimum, too big a party, or across a booked night", () => {
		let stay = findStay("lantern-house")!;
		let base = { adults: 2, children: 0 };
		expect(
			checkRequest(stay, { ...base, start: MONDAY, end: addDays(MONDAY, 1) }, today())[0]?.message,
		).toMatch(/3-night minimum/);
		expect(
			checkRequest(stay, { adults: 6, children: 4, start: undefined, end: undefined }, today()).map(
				(p) => p.kind,
			),
		).toEqual(["dates", "guests"]);
		let open = firstOpening(stay, MONDAY, 3)!;
		expect(checkRequest(stay, { ...base, ...open }, today())).toEqual([]);
		let held = new Set([open.start]);
		expect(checkRequest(stay, { ...base, ...open }, today(), held)[0]?.message).toMatch(/booked/);
		expect(isBooked(stay, open.start, held)).toBe(true);
	});
});

describe("Wayfern's search", () => {
	test("drops a check-out before check-in and filters it doesn't offer", () => {
		let search = readSearch(
			new URLSearchParams(
				"where=tallow&checkin=2026-12-10&checkout=2026-12-09&type=igloo&amenity=sauna",
			),
		);
		expect(search.place).toBe("tallow-pines");
		expect(search.end).toBeUndefined();
		expect(search.types).toEqual([]);
		expect(search.amenities).toEqual(["sauna"]);
		expect(writeSearch(search)).toBe("where=tallow-pines&checkin=2026-12-10&amenity=sauna");
	});

	test("finds stays by place, type, amenity, price and party", () => {
		let ids = (query: string) =>
			findStays(readSearch(new URLSearchParams(query))).map((stay) => stay.id);
		expect(ids("where=ondine-lakes").every((id) => findStay(id)?.place === "ondine-lakes")).toBe(
			true,
		);
		expect(ids("type=treehouse")).toEqual(["the-canopy"]);
		expect(ids("amenity=sauna&amenity=pets")).toEqual(["pinecone-a-frame"]);
		expect(ids("max=100").every((id) => findStay(id)!.nightly <= 10_000)).toBe(true);
		expect(ids("adults=9")).toEqual(["orchard-farmhouse"]);
		expect(ids("sort=price-low")[0]).toBe("cloudberry-bothy");
	});
});

describe("Wayfern's visitor state", () => {
	test("starts with saved stays and a trip of every kind, and drops anything tampered", () => {
		let traveller = readTraveller(null, today());
		expect(traveller.saved).toContain("the-canopy");
		expect(traveller.trips.map((trip) => trip.id)).toEqual([
			"WF-8F2TL",
			"WF-7M3QK",
			"WF-3CRV9",
			"WF-2D9LX",
		]);
		let tampered = readTraveller(
			"wayfern.saved=the-canopy%2Cnope; wayfern.trips=WF-AAAAA.nope.2026-01-01.2026-01-03.2.0.fern-visa.confirmed",
			today(),
		);
		expect(tampered.saved).toEqual(["the-canopy"]);
		expect(tampered.trips).toEqual([]);
	});

	test("puts a saved stay first and keeps a trip through its cookie", () => {
		let traveller = readTraveller(null, today());
		let saved = savedCookie(traveller, "dune-hollow", true).split(";")[0]!;
		expect(readTraveller(saved, today()).saved[0]).toBe("dune-hollow");
		let trips = tripsCookie(traveller.trips).split(";")[0]!;
		expect(readTraveller(trips, today()).trips).toEqual(traveller.trips);
	});
});

describe("Wayfern's posts", () => {
	test("saving a stay sets its cookie and returns to the page, never off Wayfern", async () => {
		let back = await post("saved/dune-hollow", { on: "true", back: "s?where=saltmarsh-reach" });
		expect(back.status).toBe(303);
		expect(back.headers.get("Location")).toMatch(
			/^\/demo\/apps\/wayfern\/s\?where=saltmarsh-reach&toast=saved-dune-hollow\./,
		);
		expect(cookiesOf(back)).toMatch(/^wayfern\.saved=dune-hollow%2C/);
		let away = await post("saved/dune-hollow", { on: "true", back: "https://example.com" });
		expect(away.headers.get("Location")).toMatch(
			/^\/demo\/apps\/wayfern\/stay\/dune-hollow\?toast=/,
		);
	});

	test("booking makes a trip, lands on its confirmation and shows it under Trips", async () => {
		let stay = findStay("the-canopy")!;
		let open = firstOpening(stay, MONDAY, 2)!;
		let response = await post("book/the-canopy", {
			checkin: open.start,
			checkout: open.end,
			adults: "2",
			children: "0",
			card: "sky-mastercard",
		});
		expect(response.status).toBe(303);
		let location = response.headers.get("Location") ?? "";
		expect(location).toMatch(/^\/demo\/apps\/wayfern\/trips\/WF-[A-Z0-9]{5}\?toast=booked\./);
		let cookie = cookiesOf(response);
		let code = /trips\/(WF-[A-Z0-9]{5})/.exec(location)![1]!;
		let trip = await (
			await fetchApp(`/demo/apps/wayfern/trips/${code}`, { headers: { Cookie: cookie } })
		).text();
		expect(trip).toContain("The Canopy, Tallow Pines");
		expect(trip).toContain("Mastercard ending in 5100");
		let calendar = await (
			await fetchApp("/demo/apps/wayfern/stay/the-canopy", { headers: { Cookie: cookie } })
		).text();
		expect(calendar).not.toMatch(new RegExp(`<a[^>]*data-date="${open.start}"`));
	});

	test("a checkout without a card re-renders with the problem and keeps the note", async () => {
		let stay = findStay("dune-hollow")!;
		let open = firstOpening(stay, MONDAY, 2)!;
		let response = await post("book/dune-hollow", {
			checkin: open.start,
			checkout: open.end,
			card: "",
			message: "Two of us and a terrier.",
		});
		expect(response.status).toBe(400);
		let body = await response.text();
		expect(body).toContain("Choose a saved card to pay with.");
		expect(body).toContain("Two of us and a terrier.");
	});

	test("cancelling marks the trip cancelled, and Undo restores it", async () => {
		let cancel = await post("trips/WF-7M3QK/cancel", {});
		expect(cancel.headers.get("Location")).toMatch(
			/^\/demo\/apps\/wayfern\/trips\/WF-7M3QK\?toast=cancelled\./,
		);
		let cookie = cookiesOf(cancel);
		expect(readTraveller(cookie, today()).trips[0]?.status).toBe("cancelled");
		let restore = await post("trips/restore", {}, cookie);
		expect(
			readTraveller(cookiesOf(restore), today()).trips.find((trip) => trip.id === "WF-7M3QK")
				?.status,
		).toBe("confirmed");
	});

	test("rejects a post for a stay Wayfern lacks or a choice it cannot read", async () => {
		expect((await post("saved/nope", { on: "true" })).status).toBe(400);
		expect((await post("saved/dune-hollow", { on: "maybe" })).status).toBe(400);
		expect((await post("trips/WF-ZZZZZ/cancel", {})).status).toBe(400);
	});
});
