/**
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { isUUID } from "./index.js";

/** Loads a fresh copy of the module, so each test starts from an unset clock. */
async function load() {
	vi.resetModules();
	let { generateUUID } = await import("./v7.js");
	return generateUUID;
}

/** Reads the 48-bit millisecond timestamp a UUIDv7 starts with. */
function timestampOf(id: string) {
	return Number.parseInt(id.replace(/-/g, "").slice(0, 12), 16);
}

/** Reads the 12-bit counter stored in `rand_a`. */
function counterOf(id: string) {
	return Number.parseInt(id.replace(/-/g, "").slice(13, 16), 16);
}

describe("generateUUID", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(1_000_000_000_000);
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	test("returns a valid UUID", async () => {
		let generateUUID = await load();

		expect(isUUID(generateUUID())).toBe(true);
	});

	test("carries version 7 and the RFC 9562 variant", async () => {
		let generateUUID = await load();
		let id = generateUUID();

		expect(id[14]).toBe("7");
		expect(["8", "9", "a", "b"]).toContain(id[19]);
	});

	test("encodes the current time in its first 48 bits", async () => {
		let generateUUID = await load();

		expect(timestampOf(generateUUID())).toBe(1_000_000_000_000);
	});

	test("sorts by millisecond of generation", async () => {
		let generateUUID = await load();
		let first = generateUUID();

		vi.setSystemTime(1_000_000_000_001);
		let second = generateUUID();

		expect(first < second).toBe(true);
	});

	test("sorts in call order within a single millisecond", async () => {
		let generateUUID = await load();
		let ids = Array.from({ length: 1000 }, () => generateUUID());

		expect([...ids].sort()).toEqual(ids);
		expect(new Set(ids.map(timestampOf))).toEqual(new Set([1_000_000_000_000]));
	});

	test("starts each millisecond's counter in its lower half", async () => {
		let generateUUID = await load();

		expect(counterOf(generateUUID())).toBeLessThanOrEqual(0x7ff);
	});

	test("advances the timestamp once the counter is exhausted", async () => {
		let generateUUID = await load();
		let ids = Array.from({ length: 5000 }, () => generateUUID());

		expect([...ids].sort()).toEqual(ids);
		expect(timestampOf(ids.at(-1)!)).toBe(1_000_000_000_001);
	});

	test("keeps sorting after the clock moves backwards", async () => {
		let generateUUID = await load();
		let first = generateUUID();

		vi.setSystemTime(999_999_999_000);
		let second = generateUUID();

		expect(first < second).toBe(true);
		expect(timestampOf(second)).toBe(1_000_000_000_000);
	});
});
