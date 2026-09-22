/**
 * Proves `projectsWithinStorageCeiling` at both ends: a small import against a
 * near-empty database projects within the ceiling, and a huge one against a
 * database already near it projects outside it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { projectsWithinStorageCeiling } from "./storage-ceiling";

describe("projectsWithinStorageCeiling", () => {
	test("a small import against a near-empty database stays within the ceiling", () => {
		let within = projectsWithinStorageCeiling({
			currentDatabaseSize: 1024,
			estimatedRows: 100,
		});

		expect(within).toBe(true);
	});

	test("a huge import against a database already near the ceiling does not fit", () => {
		let within = projectsWithinStorageCeiling({
			currentDatabaseSize: 8 * 1024 * 1024 * 1024,
			estimatedRows: 1_000_000,
		});

		expect(within).toBe(false);
	});

	test("a measured average row size overrides the default estimate", () => {
		let withDefault = projectsWithinStorageCeiling({
			currentDatabaseSize: 0,
			estimatedRows: 10_000_000,
		});

		let withMeasured = projectsWithinStorageCeiling({
			currentDatabaseSize: 0,
			estimatedRows: 10_000_000,
			averageRowBytes: 1,
		});

		expect(withDefault).toBe(false);
		expect(withMeasured).toBe(true);
	});
});
