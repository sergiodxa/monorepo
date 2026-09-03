/**
 * Tests for identifiers and character runs: that a UUID carries the version and
 * variant bits its format requires, that a run holds only the characters of its
 * base, and that a nonsensical length is refused rather than rounded.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { createRandom } from "../random";

import { createStringModule } from "./string";

function module(seed: string) {
	return createStringModule(createRandom(seed), new Date("2026-06-15T12:00:00.000Z"));
}

describe("uuid", () => {
	test("stamps the version and variant a version 4 identifier declares", () => {
		let string = module("uuids");

		for (let count = 0; count < 200; count++) {
			let uuid = string.uuid();
			expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
		}
	});

	test("replays from the seed", () => {
		expect(module("ids").uuid()).toBe(module("ids").uuid());
	});

	test("returns a different identifier on each call", () => {
		let string = module("ids");
		let seen = new Set(Array.from({ length: 100 }, () => string.uuid()));

		expect(seen.size).toBe(100);
	});
});

describe("alphanumeric", () => {
	test("holds only digits and lowercase letters", () => {
		let string = module("runs");

		for (let count = 0; count < 100; count++) {
			expect(string.alphanumeric(24)).toMatch(/^[0-9a-z]{24}$/);
		}
	});

	test("reaches both the digits and the far end of the letters", () => {
		let string = module("coverage");
		let drawn = string.alphanumeric(2000);

		expect(drawn).toMatch(/[0-9]/);
		expect(drawn).toMatch(/z/);
	});

	test("returns nothing for a length of zero", () => {
		expect(module("empty").alphanumeric(0)).toBe("");
	});
});

describe("hex", () => {
	test("holds only hexadecimal digits", () => {
		let string = module("hex");

		for (let count = 0; count < 100; count++) {
			expect(string.hexadecimal(16)).toMatch(/^[0-9a-f]{16}$/);
		}
	});

	test("reaches every digit of the base", () => {
		let drawn = module("hex-coverage").hexadecimal(2000);

		expect(new Set(drawn).size).toBe(16);
	});
});

describe("a length that is not a count", () => {
	test("refuses a negative length", () => {
		expect(() => module("bad").alphanumeric(-1)).toThrow(/alphanumeric\(\) needs a length/);
	});

	test("refuses a fractional length", () => {
		expect(() => module("bad").hexadecimal(2.5)).toThrow(/hexadecimal\(\) needs a length/);
	});
});

describe("the other identifiers", () => {
	test("writes a ULID of the right length and alphabet", () => {
		let string = module("ulids");

		for (let count = 0; count < 50; count++) {
			expect(string.ulid()).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
		}
	});

	test("starts every ULID with the same timestamp, since the instant is frozen", () => {
		let string = module("ulids");

		expect(string.ulid().slice(0, 10)).toBe(string.ulid().slice(0, 10));
	});

	test("writes a nanoid of 21 characters by default", () => {
		let string = module("nanoids");

		expect(string.nanoid()).toMatch(/^[A-Za-z0-9_-]{21}$/);
		expect(string.nanoid(10)).toHaveLength(10);
	});
});

describe("the other runs", () => {
	test("writes letters, digits, and the bases", () => {
		let string = module("runs");

		expect(string.alpha(10)).toMatch(/^[a-z]{10}$/);
		expect(string.numeric(10)).toMatch(/^\d{10}$/);
		expect(string.binary(8)).toMatch(/^0b[01]{8}$/);
		expect(string.octal(8)).toMatch(/^0o[0-7]{8}$/);
		expect(string.symbol(8)).toMatch(/^[^\w\s]{8}$/);
		expect(string.sample(8)).toHaveLength(8);
	});

	test("cases letters as asked", () => {
		let string = module("casing");

		expect(string.alpha(20, { casing: "upper" })).toMatch(/^[A-Z]{20}$/);
		expect(string.alpha(20, { casing: "mixed" })).toMatch(/^[A-Za-z]{20}$/);
	});

	test("prefixes and cases hexadecimal as asked", () => {
		let string = module("hex");

		expect(string.hexadecimal(8, { prefix: "0x" })).toMatch(/^0x[0-9a-f]{8}$/);
		expect(string.hexadecimal(8, { casing: "upper" })).toMatch(/^[0-9A-F]{8}$/);
	});

	test("draws from a caller's own alphabet", () => {
		expect(module("custom").fromCharacters("ab", 12)).toMatch(/^[ab]{12}$/);
	});

	test("refuses an empty alphabet", () => {
		expect(() => module("custom").fromCharacters("", 4)).toThrow(RangeError);
	});
});
