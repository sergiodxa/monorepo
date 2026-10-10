/**
 * Tests the flow monitors model against a migrated in-memory database: the selectable
 * intervals a write accepts, team-scoped reads, `recordCheckResult`'s history insert and
 * cached-fields update, the delete cascade, and the `next_due_at` scheduling.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure, unwrap } from "@sdxc/result";
import { ValidationError } from "@sdxc/validate";
import { describe, expect, test } from "vitest";

import type { FlowCheckResult } from "~/app/services/flow-check";

import { DEFAULT_FLOW_INTERVAL_SECONDS } from "~/app/lib/pricing";
import { createTestDatabase } from "~/app/lib/test/db";
import { bindModels, recordJobs } from "~/app/lib/test/models";
import { flowMonitorResults, flowMonitors } from "~/database/schema";

/** A spec source the model stores verbatim; no run reads it here. */
const SOURCE = 'test("home", async () => {});';

/** Models over a fresh database, with the raw database for reading what a write left. */
function setup() {
	let { db } = createTestDatabase();
	return { db, models: bindModels(db, recordJobs().jobs) };
}

/** A passing run's outcome, with any field overridable per test. */
function outcome(overrides: Partial<FlowCheckResult> = {}): FlowCheckResult {
	return {
		status: "up",
		testsTotal: 2,
		testsPassed: 2,
		testsFailed: 0,
		requestsMade: 3,
		failedTest: null,
		failedAtLine: null,
		failureDetail: null,
		durationMs: 120,
		errorMessage: null,
		...overrides,
	};
}

describe("flowMonitors.create", () => {
	test("creates a flow monitor for a team, hourly and due at once", async () => {
		let { models } = setup();

		let monitor = unwrap(
			await models.flowMonitors.create({ team_id: "team-1", name: "Checkout", source: SOURCE }),
		);

		expect(monitor.team_id).toBe("team-1");
		expect(monitor.interval_seconds).toBe(DEFAULT_FLOW_INTERVAL_SECONDS);
		expect(monitor.is_enabled).toBeTruthy();
		expect(monitor.next_due_at).not.toBeNull();
		expect(monitor.next_due_at).toBeLessThanOrEqual(Date.now());
	});

	test("leaves a monitor created with checking disabled unscheduled", async () => {
		let { models } = setup();

		let monitor = unwrap(
			await models.flowMonitors.create({
				team_id: "team-1",
				name: "Checkout",
				source: SOURCE,
				is_enabled: false,
			}),
		);

		expect(monitor.next_due_at).toBeNull();
	});

	test("refuses an interval outside the selectable list, writing nothing", async () => {
		let { db, models } = setup();

		let result = await models.flowMonitors.create({
			team_id: "team-1",
			name: "Checkout",
			source: SOURCE,
			interval_seconds: 60,
		});

		expect(isFailure(result) && result.error).toBeInstanceOf(ValidationError);
		expect(await db.count(flowMonitors)).toBe(0);
	});
});

describe("flowMonitors.update", () => {
	test("refuses an interval outside the selectable list, leaving the row as it was", async () => {
		let { models } = setup();
		let monitor = unwrap(
			await models.flowMonitors.create({ team_id: "team-1", name: "Checkout", source: SOURCE }),
		);

		let result = await models.flowMonitors.update(monitor.id, { interval_seconds: 60 });

		expect(isFailure(result)).toBe(true);
		expect((await models.flowMonitors.find(monitor.id))?.interval_seconds).toBe(3_600);
	});

	test("unschedules a disabled monitor and reschedules a re-enabled one", async () => {
		let { models } = setup();
		let monitor = unwrap(
			await models.flowMonitors.create({ team_id: "team-1", name: "Checkout", source: SOURCE }),
		);

		let disabled = unwrap(await models.flowMonitors.update(monitor.id, { is_enabled: false }));
		expect(disabled.next_due_at).toBeNull();

		let enabled = unwrap(await models.flowMonitors.update(monitor.id, { is_enabled: true }));
		expect(enabled.next_due_at).not.toBeNull();
	});

	test("re-anchors the schedule when the interval changes", async () => {
		let { db, models } = setup();
		let monitor = unwrap(
			await models.flowMonitors.create({ team_id: "team-1", name: "Checkout", source: SOURCE }),
		);
		await db.update(
			flowMonitors,
			monitor.id,
			{ next_due_at: Date.now() + 86_400_000 },
			{ touch: false },
		);

		await models.flowMonitors.update(monitor.id, { interval_seconds: 900 });

		expect(await models.flowMonitors.claimDue(Date.now() + 1000)).toHaveLength(1);
	});
});

describe("flowMonitors.inTeam", () => {
	test("finds a monitor on its own team only", async () => {
		let { models } = setup();
		let monitor = unwrap(
			await models.flowMonitors.create({ team_id: "team-1", name: "Checkout", source: SOURCE }),
		);

		expect(await models.flowMonitors.inTeam("team-1").where({ id: monitor.id }).first()).toEqual(
			monitor,
		);
		expect(await models.flowMonitors.inTeam("team-2").where({ id: monitor.id }).first()).toBeNull();
	});
});

describe("flowMonitors.claimDue", () => {
	test("projects only the columns a run reads, and never claims twice", async () => {
		let { models } = setup();
		let monitor = unwrap(
			await models.flowMonitors.create({ team_id: "team-1", name: "Checkout", source: SOURCE }),
		);
		let scheduledAt = Date.now() + 1000;

		expect(await models.flowMonitors.claimDue(scheduledAt)).toEqual([
			{ id: monitor.id, team_id: "team-1", source: SOURCE, last_status: null },
		]);
		expect(await models.flowMonitors.claimDue(scheduledAt + 7000)).toEqual([]);
	});
});

describe("flowMonitors.recordCheckResult", () => {
	test("inserts a history row and updates the monitor's cached fields", async () => {
		let { models } = setup();
		let monitor = unwrap(
			await models.flowMonitors.create({ team_id: "team-1", name: "Checkout", source: SOURCE }),
		);

		let id = await models.flowMonitors.recordCheckResult(
			monitor.id,
			outcome({
				status: "down",
				testsPassed: 1,
				testsFailed: 1,
				failedTest: "home",
				failedAtLine: 3,
				failureDetail: "expected 200, got 500",
			}),
		);

		let [result] = await models.flowMonitorResults.recent(monitor.id);
		expect(result?.id).toBe(id);
		expect(result?.status).toBe("down");
		expect(result?.requests_made).toBe(3);
		expect(result?.failed_test).toBe("home");
		expect(result?.failed_at_line).toBe(3);

		let updated = await models.flowMonitors.find(monitor.id);
		expect(updated?.last_status).toBe("down");
		expect(updated?.last_checked_at).toBe(result?.checked_at);
	});
});

describe("flowMonitorResults.recent", () => {
	test("lists a monitor's results newest first, capped at the limit", async () => {
		let { models } = setup();
		let monitor = unwrap(
			await models.flowMonitors.create({ team_id: "team-1", name: "Checkout", source: SOURCE }),
		);
		let other = unwrap(
			await models.flowMonitors.create({ team_id: "team-1", name: "Signup", source: SOURCE }),
		);

		await models.flowMonitors.recordCheckResult(monitor.id, outcome({ status: "up" }));
		await new Promise((resolve) => setTimeout(resolve, 2));
		await models.flowMonitors.recordCheckResult(monitor.id, outcome({ status: "error" }));
		await models.flowMonitors.recordCheckResult(other.id, outcome());

		let results = await models.flowMonitorResults.recent(monitor.id);
		expect(results.map((result) => result.status)).toEqual(["error", "up"]);
		expect(await models.flowMonitorResults.recent(monitor.id, 1)).toHaveLength(1);
	});
});

describe("flowMonitors.delete", () => {
	test("deletes a monitor and its run history, leaving other monitors' history", async () => {
		let { db, models } = setup();
		let monitor = unwrap(
			await models.flowMonitors.create({ team_id: "team-1", name: "Checkout", source: SOURCE }),
		);
		let other = unwrap(
			await models.flowMonitors.create({ team_id: "team-1", name: "Signup", source: SOURCE }),
		);
		await models.flowMonitors.recordCheckResult(monitor.id, outcome());
		await models.flowMonitors.recordCheckResult(other.id, outcome());

		unwrap(await models.flowMonitors.delete(monitor.id));

		expect(await models.flowMonitors.find(monitor.id)).toBeNull();
		expect(await db.count(flowMonitorResults, { where: { flow_monitor_id: monitor.id } })).toBe(0);
		expect(await db.count(flowMonitorResults, { where: { flow_monitor_id: other.id } })).toBe(1);
	});
});
