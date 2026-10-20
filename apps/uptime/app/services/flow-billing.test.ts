/**
 * Tests the billing plan for a flow result: HTTP-only runs become pings, browser runs
 * become one flow-run event and browser-seconds, and a pre-start refusal bills nothing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { describe, expect, test } from "vitest";

import type { FlowCheckResult } from "~/app/services/flow-check";

import { planFlowBilling } from "~/app/services/flow-billing";

/** A completed HTTP-only run. */
function httpResult(overrides: Partial<FlowCheckResult> = {}): FlowCheckResult {
	return {
		status: "up",
		testsTotal: 1,
		testsPassed: 1,
		testsFailed: 0,
		requestsMade: 2,
		usedBrowser: false,
		failedTest: null,
		failedAtLine: null,
		failureDetail: null,
		durationMs: 800,
		errorMessage: null,
		traceJson: null,
		...overrides,
	};
}

/** A completed browser run. */
function browserResult(overrides: Partial<FlowCheckResult> = {}): FlowCheckResult {
	return httpResult({
		usedBrowser: true,
		requestsMade: 4,
		durationMs: 12_500,
		...overrides,
	});
}

const SUBJECT = {
	resultId: "result-1",
	ownerId: "owner-1",
	teamId: "team-1",
	monitorId: "monitor-1",
};

describe(planFlowBilling.name, () => {
	test("an HTTP-only run bills one ping per request", () => {
		let plan = planFlowBilling(httpResult(), SUBJECT);

		expect(plan.flowRuns).toEqual([]);
		expect(plan.browserSeconds).toBe(0);
		expect(plan.pings.map((ping) => ping.externalId)).toEqual([
			"ping:result-1:0",
			"ping:result-1:1",
		]);
	});

	test("a browser run bills one flow-run event and browser-seconds, never pings", () => {
		let plan = planFlowBilling(browserResult(), SUBJECT);

		expect(plan.pings).toEqual([]);
		expect(plan.browserSeconds).toBe(12.5);
		expect(plan.flowRuns).toEqual([
			{
				externalId: "flow_run:result-1",
				ownerId: "owner-1",
				teamId: "team-1",
				monitorId: "monitor-1",
				durationSeconds: 12.5,
			},
		]);
	});

	test("a browser source that never started bills nothing", () => {
		let plan = planFlowBilling(
			browserResult({
				status: "error",
				requestsMade: 0,
				durationMs: null,
				errorMessage: "Browser Run is not configured",
			}),
			SUBJECT,
		);

		expect(plan).toEqual({ pings: [], flowRuns: [], browserSeconds: 0 });
	});

	test("an HTTP run that made no requests bills nothing", () => {
		let plan = planFlowBilling(httpResult({ requestsMade: 0 }), SUBJECT);

		expect(plan).toEqual({ pings: [], flowRuns: [], browserSeconds: 0 });
	});
});
