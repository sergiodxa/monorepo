/**
 * Unit tests for the alert-scope vocabulary: the match test dispatch runs, how a stored
 * row's scope is read (including the pre-`monitor_type` shape), and the encode/parse
 * round-trip the single scope `<select>` depends on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "bun:test";

import {
	ALERT_SCOPE_TYPES,
	alertScopeMatches,
	encodeAlertScope,
	parseAlertScope,
	storedAlertScope,
	TEAM_WIDE_ALERT_SCOPE,
} from "~/app/lib/alert-scope";

describe("alertScopeMatches", () => {
	test("a team-wide scope matches every monitor of every type", () => {
		for (let type of ALERT_SCOPE_TYPES) {
			expect(alertScopeMatches(TEAM_WIDE_ALERT_SCOPE, type, "any-monitor")).toBe(true);
		}
	});

	test("a type scope matches only that type, whichever monitor it is", () => {
		let scope = { monitorType: "dns", monitorId: null } as const;

		expect(alertScopeMatches(scope, "dns", "dns-1")).toBe(true);
		expect(alertScopeMatches(scope, "dns", "dns-2")).toBe(true);
		expect(alertScopeMatches(scope, "http", "http-1")).toBe(false);
		expect(alertScopeMatches(scope, "tcp", "tcp-1")).toBe(false);
	});

	test("a monitor scope matches only that monitor", () => {
		let scope = { monitorType: "dns", monitorId: "dns-1" } as const;

		expect(alertScopeMatches(scope, "dns", "dns-1")).toBe(true);
		expect(alertScopeMatches(scope, "dns", "dns-2")).toBe(false);
		expect(alertScopeMatches(scope, "http", "dns-1")).toBe(false);
	});
});

describe("storedAlertScope", () => {
	test("reads a row with neither column as team-wide", () => {
		expect(storedAlertScope({ monitor_type: null, monitor_id: null })).toEqual(
			TEAM_WIDE_ALERT_SCOPE,
		);
	});

	test("reads both columns as written", () => {
		expect(storedAlertScope({ monitor_type: "tcp", monitor_id: "tcp-1" })).toEqual({
			monitorType: "tcp",
			monitorId: "tcp-1",
		});
	});

	/** The shape every alert had before the column existed; widening it would over-notify. */
	test("reads a monitor id with no type as HTTP-scoped, never as team-wide", () => {
		expect(storedAlertScope({ monitor_type: null, monitor_id: "monitor-1" })).toEqual({
			monitorType: "http",
			monitorId: "monitor-1",
		});
	});
});

describe("encodeAlertScope / parseAlertScope", () => {
	test("round-trips every scope the product offers", () => {
		let scopes = [
			TEAM_WIDE_ALERT_SCOPE,
			...ALERT_SCOPE_TYPES.map((monitorType) => ({ monitorType, monitorId: null })),
			...ALERT_SCOPE_TYPES.map((monitorType) => ({ monitorType, monitorId: `${monitorType}-1` })),
		];

		for (let scope of scopes) {
			expect(parseAlertScope(encodeAlertScope(scope))).toEqual(scope);
		}
	});

	/** Rejected rather than defaulted: a fallback to team-wide would widen an alert silently. */
	test("rejects values no form of ours produces", () => {
		for (let value of [
			"type:pigeon",
			"monitor:pigeon:1",
			"monitor:dns:",
			"monitor:dns",
			"type:dns:extra",
			"dns",
			"monitor",
		]) {
			expect(parseAlertScope(value)).toBeNull();
		}
	});
});
