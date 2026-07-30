/**
 * Tests the window arithmetic every counting adapter shares: how a configured
 * length is normalized, where the aligned bucket boundaries fall, and that a
 * decision's `reset` and `retryAfter` always describe the same instant.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import { fixedWindow, retryAfterSeconds, windowDecision, windowLengthMs } from "./window";

describe("windowLengthMs", () => {
	test("converts a duration string", () => {
		expect(windowLengthMs("10 seconds")).toBe(10_000);
		expect(windowLengthMs("1 minute")).toBe(60_000);
	});

	test("passes a bare number through as milliseconds", () => {
		expect(windowLengthMs(2500)).toBe(2500);
	});

	test("collapses a window that cannot count to 1 ms, so nothing is locked out", () => {
		expect(windowLengthMs(0)).toBe(1);
		expect(windowLengthMs(-5000)).toBe(1);
		expect(windowLengthMs("nonsense" as unknown as number)).toBe(1);
	});
});

describe("fixedWindow", () => {
	test("aligns the bucket to the epoch", () => {
		expect(fixedWindow("1 minute", 90_000)).toEqual({
			start: 60_000,
			end: 120_000,
			length: 60_000,
		});
	});

	test("keeps two instants inside one bucket in the same window", () => {
		let first = fixedWindow("10 seconds", 1_000_000_000);
		let second = fixedWindow("10 seconds", 1_000_009_999);
		expect(second.start).toBe(first.start);
	});

	test("moves to the next bucket once the boundary is crossed", () => {
		let first = fixedWindow("10 seconds", 1_000_000_000);
		let second = fixedWindow("10 seconds", 1_000_010_000);
		expect(second.start).toBe(first.end);
	});
});

describe("retryAfterSeconds", () => {
	test("rounds up so waiting the reported time clears the window", () => {
		expect(retryAfterSeconds(1000, 7400)).toBe(7);
		expect(retryAfterSeconds(0, 10_000)).toBe(10);
		expect(retryAfterSeconds(9500, 10_000)).toBe(1);
	});

	test("reports zero for an instant already passed", () => {
		expect(retryAfterSeconds(10_000, 10_000)).toBe(0);
		expect(retryAfterSeconds(20_000, 10_000)).toBe(0);
	});
});

describe("windowDecision", () => {
	test("derives reset and retryAfter from the same window boundary", () => {
		let decision = windowDecision({
			allowed: false,
			limit: 10,
			remaining: 0,
			window: fixedWindow("10 seconds", 1_000_003_000),
			now: 1_000_003_000,
		});

		expect(decision.reset.getTime()).toBe(1_000_010_000);
		expect(decision.retryAfter).toBe(7);
		expect(decision.limit).toBe(10);
		expect(decision.remaining).toBe(0);
		expect(decision.allowed).toBe(false);
	});

	test("keeps a null remaining null, for a backend that cannot report it", () => {
		let decision = windowDecision({
			allowed: true,
			limit: 10,
			remaining: null,
			window: fixedWindow("10 seconds", 1_000_000_000),
			now: 1_000_000_000,
		});

		expect(decision.remaining).toBeNull();
	});
});
