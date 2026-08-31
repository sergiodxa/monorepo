/**
 * Unit tests for the status-page status-derivation helpers: per-type mapping onto
 * the shared status scale, and the majority-based overall-status rule.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import {
	computeOverallStatus,
	deriveCronStatus,
	deriveDnsStatus,
	deriveFlowStatus,
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

describe("deriveFlowStatus", () => {
	test("maps each last_status value onto the shared scale", () => {
		expect(deriveFlowStatus("up")).toBe("operational");
		expect(deriveFlowStatus("down")).toBe("down");
		expect(deriveFlowStatus(null)).toBe("unknown");
	});

	/**
	 * An `error` is this app failing to find out. Publishing it as an outage would tell a
	 * customer's own users their service is down for a reason that belongs to us.
	 */
	test("reads an error run as unknown rather than as an outage", () => {
		expect(deriveFlowStatus("error")).toBe("unknown");
	});

	test("keeps an error run out of the page's overall status entirely", () => {
		expect(computeOverallStatus([deriveFlowStatus("error")])).toBe("operational");
		expect(computeOverallStatus(["operational", deriveFlowStatus("error")])).toBe("operational");
		expect(computeOverallStatus(["down", deriveFlowStatus("error")])).toBe("down");
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
