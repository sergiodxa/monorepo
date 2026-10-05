/**
 * Tests for backoff schedules: each growth rule and the stepped table against
 * exact delays, the ceiling, free attempts, both jitter modes drawn from a
 * seeded stream, and the option validation `createBackoff` performs once.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { createRandom } from "@sdxc/random";
import { describe, expect, test } from "vitest";

import { createBackoff } from "./backoff.js";

/**
 * The delays a schedule answers for attempts 1 through `count`.
 */
function delays(backoff: { delay(attempt: number): number }, count: number): number[] {
	return Array.from({ length: count }, (_, index) => backoff.delay(index + 1));
}

describe("growth", () => {
	test("doubles from the base by default", () => {
		expect(delays(createBackoff({ base: "1 second" }), 5)).toEqual([
			1000, 2000, 4000, 8000, 16_000,
		]);
	});

	test("multiplies by a custom factor", () => {
		expect(delays(createBackoff({ base: 100, factor: 3 }), 4)).toEqual([100, 300, 900, 2700]);
	});

	test("adds the base per failure when linear", () => {
		expect(delays(createBackoff({ base: "1 minute", growth: "linear" }), 3)).toEqual([
			60_000, 120_000, 180_000,
		]);
	});

	test("repeats the base when constant", () => {
		expect(delays(createBackoff({ base: 500, growth: "constant" }), 3)).toEqual([500, 500, 500]);
	});

	test("caps every rule at max", () => {
		expect(delays(createBackoff({ base: "15 seconds", max: "1 minute" }), 5)).toEqual([
			15_000, 30_000, 60_000, 60_000, 60_000,
		]);
		expect(createBackoff({ base: "15 seconds", max: "12 hours" }).delay(20)).toBe(43_200_000);
		expect(createBackoff({ base: 10, growth: "linear", max: 25 }).delay(3)).toBe(25);
	});
});

describe("attempts", () => {
	test("answers 0 for a non-positive attempt", () => {
		let backoff = createBackoff({ base: 1000 });

		expect(backoff.delay(0)).toBe(0);
		expect(backoff.delay(-3)).toBe(0);
	});

	test("starts the curve after the free attempts", () => {
		expect(delays(createBackoff({ free: 3, base: "1 second" }), 6)).toEqual([
			0, 0, 0, 1000, 2000, 4000,
		]);
	});

	test("adds the delay to now", () => {
		expect(createBackoff({ base: 1000 }).at(3, 1_700_000_000_000)).toBe(1_700_000_004_000);
		expect(createBackoff({ free: 1, base: 1000 }).at(1, 50)).toBe(50);
	});
});

describe("steps", () => {
	test("follows the table and repeats its last step", () => {
		let backoff = createBackoff({ steps: ["15 seconds", "1 minute", "5 minutes"] });

		expect(delays(backoff, 5)).toEqual([15_000, 60_000, 300_000, 300_000, 300_000]);
	});

	test("shifts the table past free attempts", () => {
		expect(delays(createBackoff({ free: 1, steps: [10, 20] }), 4)).toEqual([0, 10, 20, 20]);
	});
});

describe("jitter", () => {
	test("spreads delays at the ceiling within the fraction", () => {
		let backoff = createBackoff({
			base: "1 second",
			max: "1 minute",
			jitter: 0.5,
			random: createRandom("ceiling"),
		});

		let spread = [backoff.delay(10), backoff.delay(10), backoff.delay(10)];

		expect(new Set(spread).size).toBe(3);
		for (let delay of spread) expect(delay).toBeGreaterThanOrEqual(30_000);
		for (let delay of spread) expect(delay).toBeLessThanOrEqual(90_000);
	});

	test("answers the same sequence for the same seed", () => {
		let schedule = () => createBackoff({ base: 1000, jitter: 0.2, random: createRandom("replay") });

		expect(delays(schedule(), 6)).toEqual(delays(schedule(), 6));
	});

	test("scales the base delay by a draw from 1 ± fraction", () => {
		let draws = createRandom("scale");
		let expected = Math.round(4000 * draws.float(0.8, 1.2));

		let backoff = createBackoff({ base: 1000, jitter: 0.2, random: createRandom("scale") });

		expect(backoff.delay(3)).toBe(expected);
	});

	test("draws from [0, delay] when full", () => {
		let backoff = createBackoff({ base: 1000, jitter: "full", random: createRandom("full") });

		for (let count = 0; count < 200; count++) {
			let delay = backoff.delay(4);
			expect(delay).toBeGreaterThanOrEqual(0);
			expect(delay).toBeLessThanOrEqual(8000);
			expect(Number.isInteger(delay)).toBe(true);
		}
	});

	test("leaves free attempts at 0", () => {
		let backoff = createBackoff({ free: 2, base: 1000, jitter: "full" });

		expect(backoff.delay(2)).toBe(0);
	});

	test("draws from the system stream when no random is given", () => {
		let backoff = createBackoff({ base: 1000, jitter: 0.5 });
		let delay = backoff.delay(1);

		expect(delay).toBeGreaterThanOrEqual(500);
		expect(delay).toBeLessThanOrEqual(1500);
	});
});

describe("validation", () => {
	test.each([
		["a negative base", { base: -1 }],
		["a factor below 1", { base: 10, factor: 0.5 }],
		["a max below base", { base: "1 minute", max: "1 second" }],
		["a negative jitter", { base: 10, jitter: -0.1 }],
		["a jitter above 1", { base: 10, jitter: 1.5 }],
		["empty steps", { steps: [] }],
		["a negative step", { steps: [10, -1] }],
		["a negative free count", { base: 10, free: -1 }],
		["a fractional free count", { base: 10, free: 1.5 }],
	] as const)("rejects %s", (_, options) => {
		expect(() => createBackoff(options)).toThrow(RangeError);
	});

	test("accepts the edges of the jitter range", () => {
		expect(createBackoff({ base: 10, jitter: 0 }).delay(1)).toBe(10);
		expect(() => createBackoff({ base: 10, jitter: 1 })).not.toThrow();
	});
});
