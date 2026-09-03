/**
 * Tests for phone numbers: that every style stays in the range reserved for
 * fiction, and that an IMEI carries the check digit that makes it well-formed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { createRandom } from "../random";

import { createPhoneModule } from "./phone";

function module(seed: string) {
	return createPhoneModule(createRandom(seed));
}

/** The Luhn sum of a whole number, zero when the check digit is right. */
function luhnRemainder(digits: string): number {
	let sum = 0;
	let double = false;
	for (let index = digits.length - 1; index >= 0; index--) {
		let digit = Number(digits.charAt(index));
		if (double) {
			digit *= 2;
			if (digit > 9) digit -= 9;
		}
		double = !double;
		sum += digit;
	}
	return sum % 10;
}

describe("number", () => {
	test("writes the local form by default", () => {
		let phone = module("numbers");

		for (let count = 0; count < 100; count++) {
			expect(phone.number()).toMatch(/^555-01\d{2}$/);
		}
	});

	test("writes the national form on request", () => {
		expect(module("numbers").number({ style: "national" })).toMatch(/^\(555\) 555-01\d{2}$/);
	});

	test("writes the international form on request", () => {
		expect(module("numbers").number({ style: "international" })).toMatch(/^\+1 555-555-01\d{2}$/);
	});

	test("keeps every style inside the range reserved for fiction", () => {
		let phone = module("reserved");

		for (let style of ["human", "national", "international"] as const) {
			for (let count = 0; count < 50; count++) {
				let digits = phone.number({ style }).replace(/\D/g, "");
				expect(digits.endsWith("55501" + digits.slice(-2))).toBe(true);
			}
		}
	});
});

describe("imei", () => {
	test("returns fifteen digits", () => {
		let phone = module("imei");

		for (let count = 0; count < 50; count++) {
			expect(phone.imei()).toMatch(/^\d{15}$/);
		}
	});

	test("closes with a check digit that validates", () => {
		let phone = module("imei");

		for (let count = 0; count < 50; count++) {
			expect(luhnRemainder(phone.imei())).toBe(0);
		}
	});
});
