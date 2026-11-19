/**
 * What flights, cars and packages cost: the lines a checkout prints for each, built from the
 * same rules a results card quotes, so a total never changes between the list and the receipt.
 * Every amount is whole US cents.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CarExtra, CarOfferData } from "./cars";
import type { FareClass, FlightOption } from "./flights";
import type { Quote, QuoteLine } from "./pricing";

import { CAR_EXTRAS, ONE_WAY_FEE, rentalDays } from "./cars";
import { FARE_CLASSES, farePrice } from "./flights";

/** Airport and security charges added to every ticket, per traveller and leg. */
const TICKET_TAXES = 3_850;

/** The share a package takes off its flights and stay booked apart. */
export const PACKAGE_SAVING = 0.12;

/** Local tax on a car rental. */
const CAR_TAX = 0.09;

/** A child's ticket costs this share of an adult's. */
const CHILD_FARE = 0.75;

/** The price of a seat pick, in US cents, on a fare that charges for seats. */
export function seatFee(fare: FareClass, price: number): number {
	return fare === "basic" ? price : 0;
}

/**
 * The fares of a flight booking: each leg at its fare class for the adults and children, the
 * taxes per traveller and leg, and any seat fees.
 *
 * @param legs Each picked option with its fare class and the fee of each seat picked.
 * @param adults Adults travelling.
 * @param children Children travelling.
 */
export function flightQuote(
	legs: Array<{ option: FlightOption; fare: FareClass; seatFees: number }>,
	adults: number,
	children: number,
): Quote {
	let travellers = adults + children;
	let lines: QuoteLine[] = [];
	let base = 0;
	for (let leg of legs) {
		let each = farePrice(leg.option, leg.fare);
		base += Math.round(each * adults + each * CHILD_FARE * children);
	}
	let fareName = FARE_CLASSES.find((entry) => entry.id === legs[0]?.fare)?.name ?? "Standard";
	lines.push({
		key: "nights",
		label: `${legs.length === 1 ? "One flight" : `${legs.length} flights`}`,
		detail: `${fareName} fare · ${travellers} ${travellers === 1 ? "traveller" : "travellers"}`,
		cents: base,
	});
	let seats = legs.reduce((sum, leg) => sum + leg.seatFees, 0);
	if (seats > 0) lines.push({ key: "cleaning", label: "Seat selection", cents: seats });
	lines.push({
		key: "taxes",
		label: "Taxes and airport charges",
		cents: TICKET_TAXES * travellers * legs.length,
	});
	return {
		nights: legs.length,
		average: base,
		lines,
		total: lines.reduce((sum, line) => sum + line.cents, 0),
	};
}

/**
 * The cost of a car: its days at the offer's rate, each extra per day, a fee for returning it
 * somewhere else, and local tax.
 *
 * @param offer The car on offer.
 * @param pickup Pickup instant.
 * @param dropoff Drop-off instant.
 * @param extras The extras chosen.
 * @param oneWay Whether it goes back to another place.
 */
export function carQuote(
	offer: CarOfferData,
	pickup: number,
	dropoff: number,
	extras: CarExtra[],
	oneWay: boolean,
): Quote {
	let days = rentalDays(pickup, dropoff);
	let lines: QuoteLine[] = [
		{
			key: "nights",
			label: `${days} ${days === 1 ? "day" : "days"}`,
			detail: `${offer.car.name} at $${(offer.daily / 100).toFixed(0)} a day`,
			cents: offer.daily * days,
		},
	];
	for (let id of extras) {
		let extra = CAR_EXTRAS.find((entry) => entry.id === id);
		if (extra !== undefined)
			lines.push({ key: "cleaning", label: extra.label, cents: extra.daily * days });
	}
	if (oneWay) lines.push({ key: "service", label: "One-way drop-off", cents: ONE_WAY_FEE });
	let subtotal = lines.reduce((sum, line) => sum + line.cents, 0);
	lines.push({ key: "taxes", label: "Local tax", cents: Math.round(subtotal * CAR_TAX) });
	return {
		nights: days,
		average: offer.daily,
		lines,
		total: lines.reduce((sum, line) => sum + line.cents, 0),
	};
}

/**
 * The saving a package earns on its flights and stay together.
 *
 * @param separately What they cost booked apart, in US cents.
 */
export function packageSaving(separately: number): number {
	return Math.round((separately * PACKAGE_SAVING) / 100) * 100;
}
