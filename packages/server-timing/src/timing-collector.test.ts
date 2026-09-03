/**
 * Tests for the request-scoped Server-Timing collector.
 *
 * Covers that a measured operation's value and its rejection both pass through untouched
 * while still being recorded, and that `toHeaders` returns the `Headers` it wrote to —
 * the return value the original implementation dropped, which is why it is pinned here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { TimingCollector } from "./timing-collector.js";

describe("TimingCollector#measure", () => {
	test("returns whatever the operation resolves to", async () => {
		let collector = new TimingCollector();

		let result = await collector.measure("db", "findUserById", async () => "ada");

		expect(result).toBe("ada");
	});

	test("records the measurement", async () => {
		let collector = new TimingCollector();

		await collector.measure("db", "findUserById", async () => "ada");

		expect(collector.toString()).toMatch(/^db;desc="findUserById"/);
	});

	test("re-throws a rejection but still records the measurement", async () => {
		let collector = new TimingCollector();

		let promise = collector.measure("db", "findUserById", async () => {
			throw new Error("boom");
		});

		await expect(promise).rejects.toThrow("boom");

		expect(collector.toString()).toMatch(/^db;desc="findUserById"/);
	});

	test("keeps measurements in the order they were taken", async () => {
		let collector = new TimingCollector();

		await collector.measure("auth", "authorize", async () => null);
		await collector.measure("db", "findUserById", async () => null);

		let [first, second] = collector.toString().split(", ");

		expect(first).toMatch(/^auth;desc="authorize"/);
		expect(second).toMatch(/^db;desc="findUserById"/);
	});
});

describe("TimingCollector#toString", () => {
	test("is empty when nothing was measured", () => {
		let collector = new TimingCollector();

		expect(collector.toString()).toBe("");
	});
});

describe("TimingCollector#toHeaders", () => {
	test("returns the headers it was given", async () => {
		let collector = new TimingCollector();
		await collector.measure("db", "findUserById", async () => null);
		let headers = new Headers();

		expect(collector.toHeaders(headers)).toBe(headers);
	});

	test("writes the measurements onto the given headers", async () => {
		let collector = new TimingCollector();
		await collector.measure("db", "findUserById", async () => null);
		let headers = new Headers();

		collector.toHeaders(headers);

		expect(headers.get("Server-Timing")).toMatch(/^db;desc="findUserById"/);
	});

	test("creates headers when none are given", async () => {
		let collector = new TimingCollector();
		await collector.measure("db", "findUserById", async () => null);

		let headers = collector.toHeaders();

		expect(headers).toBeInstanceOf(Headers);
		expect(headers.get("Server-Timing")).toMatch(/^db;desc="findUserById"/);
	});

	test("replaces an existing header instead of appending to it", async () => {
		let collector = new TimingCollector();
		await collector.measure("db", "findUserById", async () => null);
		let headers = new Headers({ "Server-Timing": "upstream;dur=1.00" });

		collector.toHeaders(headers);

		expect(headers.get("Server-Timing")).not.toContain("upstream");
	});
});
