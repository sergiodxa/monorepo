/**
 * Tests for the rate-limit mock: counters are real, so the allow/deny sequence a caller
 * sees is the one the threshold produces, keys are independent, and a window rollover
 * clears the count.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "vitest";

import { createRateLimit } from "./rate-limit.js";

describe("createRateLimit", () => {
	test("allows requests up to the limit, then denies", async () => {
		let limiter = createRateLimit({ limit: 2 });

		expect((await limiter.limit({ key: "ip" })).success).toBe(true);
		expect((await limiter.limit({ key: "ip" })).success).toBe(true);
		expect((await limiter.limit({ key: "ip" })).success).toBe(false);
	});

	test("counts each key independently", async () => {
		let limiter = createRateLimit({ limit: 1 });

		expect((await limiter.limit({ key: "a" })).success).toBe(true);
		expect((await limiter.limit({ key: "b" })).success).toBe(true);
		expect((await limiter.limit({ key: "a" })).success).toBe(false);
	});

	test("exposes the count for a key", async () => {
		let limiter = createRateLimit({ limit: 5 });

		expect(limiter.count("ip")).toBe(0);
		await limiter.limit({ key: "ip" });
		await limiter.limit({ key: "ip" });

		expect(limiter.count("ip")).toBe(2);
	});

	test("clears the count when the window rolls over", async () => {
		let clock = 0;
		let limiter = createRateLimit({ limit: 1, period: 10, now: () => clock });

		expect((await limiter.limit({ key: "ip" })).success).toBe(true);
		expect((await limiter.limit({ key: "ip" })).success).toBe(false);

		clock += 10_000;

		expect(limiter.count("ip")).toBe(0);
		expect((await limiter.limit({ key: "ip" })).success).toBe(true);
	});

	test("keeps counting inside the same window", async () => {
		let clock = 0;
		let limiter = createRateLimit({ limit: 1, period: 60, now: () => clock });

		await limiter.limit({ key: "ip" });
		clock += 59_000;

		expect((await limiter.limit({ key: "ip" })).success).toBe(false);
	});

	test("resets every counter on demand", async () => {
		let limiter = createRateLimit({ limit: 1 });
		await limiter.limit({ key: "ip" });

		limiter.reset();

		expect(limiter.count("ip")).toBe(0);
		expect((await limiter.limit({ key: "ip" })).success).toBe(true);
	});

	test("gives every limiter its own isolated counters", async () => {
		let first = createRateLimit({ limit: 1 });
		let second = createRateLimit({ limit: 1 });

		await first.limit({ key: "ip" });

		expect((await second.limit({ key: "ip" })).success).toBe(true);
	});
});
