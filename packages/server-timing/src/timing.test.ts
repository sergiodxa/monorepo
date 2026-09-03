/**
 * Tests for a single Server-Timing measurement.
 *
 * The formatting is pinned entry by entry because the output goes straight onto the wire:
 * a missing quote or a stray semicolon makes the whole header unparseable. The duration
 * rules are checked at their boundaries — never ended, ended, and read twice after ending.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { setTimeout as sleep } from "node:timers/promises";

import { describe, expect, test } from "vitest";

import { Timing } from "./timing.js";

/** Long enough that `performance.now()` has certainly advanced on any runtime. */
const MEASURABLE_DELAY_MS = 5;

describe("Timing", () => {
	test("has no description by default", () => {
		let timing = new Timing("db");

		expect(timing.description).toBe("");
	});

	test("reports no duration while still running", () => {
		let timing = new Timing("db", "findUserById");

		expect(timing.duration).toBe(0);
	});

	test("reports the elapsed time after ending", async () => {
		let timing = new Timing("db", "findUserById");
		await sleep(MEASURABLE_DELAY_MS);
		timing.end();

		expect(timing.duration).toBeGreaterThan(0);
	});

	test("freezes the duration once ended", async () => {
		let timing = new Timing("db", "findUserById");
		timing.end();
		let first = timing.duration;
		await sleep(MEASURABLE_DELAY_MS);

		expect(timing.duration).toBe(first);
	});

	test("formats a name-only entry", () => {
		let timing = new Timing("db");

		expect(timing.toString()).toBe("db");
	});

	test("formats a described entry with no duration", () => {
		let timing = new Timing("db", "findUserById");

		expect(timing.toString()).toBe('db;desc="findUserById"');
	});

	test("formats a completed entry with a two-decimal duration", async () => {
		let timing = new Timing("db", "findUserById");
		await sleep(MEASURABLE_DELAY_MS);
		timing.end();

		expect(timing.toString()).toMatch(/^db;desc="findUserById";dur=\d+\.\d{2}$/);
	});
});
