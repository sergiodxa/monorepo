/**
 * Tests for the Analytics Engine mock: data points are recorded as written, snapshots are
 * detached from the caller's objects, and the platform's cardinality and size limits are
 * enforced rather than silently swallowed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { describe, expect, test } from "bun:test";

import { createAnalyticsEngine } from "./analytics-engine";

describe("createAnalyticsEngine", () => {
	test("records a data point with blobs, doubles, and indexes", () => {
		let analytics = createAnalyticsEngine();

		analytics.writeDataPoint({ blobs: ["hit", "GET"], doubles: [1, 2], indexes: ["tenant-1"] });

		expect(analytics.dataPoints).toEqual([
			{ blobs: ["hit", "GET"], doubles: [1, 2], indexes: ["tenant-1"] },
		]);
	});

	test("records data points in write order", () => {
		let analytics = createAnalyticsEngine();

		analytics.writeDataPoint({ blobs: ["first"] });
		analytics.writeDataPoint({ blobs: ["second"] });

		expect(analytics.dataPoints.map((point) => point.blobs?.[0])).toEqual(["first", "second"]);
	});

	test("records an empty data point when no event is given", () => {
		let analytics = createAnalyticsEngine();

		analytics.writeDataPoint();

		expect(analytics.dataPoints).toEqual([{}]);
	});

	test("detaches the recorded point from the caller's object", () => {
		let analytics = createAnalyticsEngine();
		let event = { blobs: ["original"] };

		analytics.writeDataPoint(event);
		event.blobs[0] = "mutated";

		expect(analytics.dataPoints[0]?.blobs?.[0]).toBe("original");
	});

	test("rejects more than one index, which the platform does not accept", () => {
		let analytics = createAnalyticsEngine();

		expect(() => analytics.writeDataPoint({ indexes: ["a", "b"] })).toThrow(/indexes/);
	});

	test("rejects more than twenty blobs", () => {
		let analytics = createAnalyticsEngine();
		let blobs = Array.from({ length: 21 }, () => "x");

		expect(() => analytics.writeDataPoint({ blobs })).toThrow(/blobs/);
	});

	test("rejects blobs over the combined byte budget", () => {
		let analytics = createAnalyticsEngine();

		expect(() => analytics.writeDataPoint({ blobs: ["x".repeat(6000)] })).toThrow(/total/);
	});

	test("rejects an index longer than the platform allows", () => {
		let analytics = createAnalyticsEngine();

		expect(() => analytics.writeDataPoint({ indexes: ["x".repeat(200)] })).toThrow(/index of/);
	});

	test("gives every dataset its own isolated recording", () => {
		let first = createAnalyticsEngine();
		let second = createAnalyticsEngine();

		first.writeDataPoint({ blobs: ["a"] });

		expect(second.dataPoints).toHaveLength(0);
	});
	test("clears its recording on reset, so a shared binding starts each test empty", () => {
		let analytics = createAnalyticsEngine();
		analytics.writeDataPoint({ blobs: ["a"] });

		analytics.reset();

		expect(analytics.dataPoints).toHaveLength(0);

		analytics.writeDataPoint({ blobs: ["b"] });
		expect(analytics.dataPoints).toEqual([{ blobs: ["b"] }]);
	});
});
