/**
 * Unit tests for the status-page status-derivation helpers: per-type mapping onto
 * the shared status scale, and the majority-based overall-status rule.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import {
	computeOverallStatus,
	deriveCronStatus,
	deriveDnsStatus,
	deriveHttpStatus,
	deriveTcpStatus,
} from "~/app/services/status-page";

describe("deriveHttpStatus", () => {
	test("maps each health value onto the shared scale", () => {
		expect(deriveHttpStatus("up")).toBe("operational");
		expect(deriveHttpStatus("degraded")).toBe("degraded");
		expect(deriveHttpStatus("down")).toBe("down");
		expect(deriveHttpStatus("pending")).toBe("unknown");
	});
});

describe("deriveDnsStatus", () => {
	test("maps each last_status value onto the shared scale", () => {
		expect(deriveDnsStatus("ok")).toBe("operational");
		expect(deriveDnsStatus("changed")).toBe("degraded");
		expect(deriveDnsStatus("error")).toBe("down");
		expect(deriveDnsStatus(null)).toBe("unknown");
	});
});

describe("deriveTcpStatus", () => {
	test("maps each last_status value onto the shared scale", () => {
		expect(deriveTcpStatus("up")).toBe("operational");
		expect(deriveTcpStatus("timeout")).toBe("degraded");
		expect(deriveTcpStatus("down")).toBe("down");
		expect(deriveTcpStatus(null)).toBe("unknown");
	});
});

describe("deriveCronStatus", () => {
	test("maps each status value onto the shared scale", () => {
		expect(deriveCronStatus("healthy")).toBe("operational");
		expect(deriveCronStatus("late")).toBe("degraded");
		expect(deriveCronStatus("missed")).toBe("down");
		expect(deriveCronStatus("new")).toBe("unknown");
	});
});

describe("computeOverallStatus", () => {
	test("is operational for an empty list", () => {
		expect(computeOverallStatus([])).toBe("operational");
	});

	test("is operational when every item is operational", () => {
		expect(computeOverallStatus(["operational", "operational"])).toBe("operational");
	});

	test("ignores unknown items entirely", () => {
		expect(computeOverallStatus(["unknown", "unknown"])).toBe("operational");
	});

	test("is degraded when some, but not most, items are down or degraded", () => {
		expect(computeOverallStatus(["operational", "operational", "degraded"])).toBe("degraded");
		expect(computeOverallStatus(["operational", "operational", "operational", "down"])).toBe(
			"degraded",
		);
	});

	test("is down when most items are down or degraded", () => {
		expect(computeOverallStatus(["down", "degraded", "operational"])).toBe("down");
		expect(computeOverallStatus(["down", "down"])).toBe("down");
	});
});
