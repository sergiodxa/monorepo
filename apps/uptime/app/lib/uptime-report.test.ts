/**
 * Unit tests for the rules every uptime report shares: folding statuses together
 * keeps the worst of them, any measurement outranks an unobserved period, and
 * uptime is weighted by checks and prints as a plain one-decimal magnitude.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import { formatUptime, uptimeRatio, worstStatus } from "~/app/lib/uptime-report";

describe("worstStatus", () => {
	test("keeps the worse of two measured statuses, either way round", () => {
		expect(worstStatus("up", "degraded")).toBe("degraded");
		expect(worstStatus("degraded", "up")).toBe("degraded");
		expect(worstStatus("degraded", "down")).toBe("down");
		expect(worstStatus("down", "degraded")).toBe("down");
	});

	test("keeps the status when both sides agree", () => {
		expect(worstStatus("up", "up")).toBe("up");
		expect(worstStatus("down", "down")).toBe("down");
	});

	test("lets any measurement win over no data, either way round", () => {
		expect(worstStatus(null, "up")).toBe("up");
		expect(worstStatus("up", null)).toBe("up");
	});

	test("reports no data only when neither side has any", () => {
		expect(worstStatus(null, null)).toBeNull();
	});
});

describe("formatUptime", () => {
	test("prints one decimal and no sign", () => {
		expect(formatUptime(0.994)).toBe("99.4");
		expect(formatUptime(1)).toBe("100.0");
		expect(formatUptime(0)).toBe("0.0");
	});
});

describe("uptimeRatio", () => {
	test("divides passed checks by every check", () => {
		expect(uptimeRatio(437, 500)).toBe(0.874);
		expect(uptimeRatio(0, 10)).toBe(0);
		expect(uptimeRatio(10, 10)).toBe(1);
	});

	test("reports nothing measured when no check ran", () => {
		expect(uptimeRatio(0, 0)).toBeNull();
	});
});
