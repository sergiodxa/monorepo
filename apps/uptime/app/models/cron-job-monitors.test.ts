/**
 * Tests the cron-job monitors model against a migrated in-memory database: team-scoped reads,
 * ping history through the single `recordPing` write, the sweep's `actionable` scope, and
 * `calculateNextExpected`, including the two inputs that leave a monitor unscheduled.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { unwrap } from "@sdxc/result";
import { beforeEach, describe, expect, test } from "vitest";

import type { UptimeModels } from "~/app/models";

import { createTestDatabase } from "~/app/lib/test/db";
import { bindModels, recordJobs } from "~/app/lib/test/models";
import { calculateNextExpected } from "~/app/models/cron-job-monitors";
import { cronJobPings } from "~/database/schema";

let db: Database;
let models: UptimeModels;

beforeEach(() => {
	db = createTestDatabase().db;
	models = bindModels(db, recordJobs().jobs);
});

describe("cronJobMonitors.create", () => {
	test("computes next_expected_at when created enabled", async () => {
		let enabledAt = Date.now();
		let monitor = unwrap(
			await models.cronJobMonitors.create({
				team_id: "team-1",
				name: "Nightly backup",
				description: null,
				cron_expression: "0 0 * * *",
				timezone: "UTC",
				enabled_at: enabledAt,
			}),
		);

		expect(monitor.id).toBeTruthy();
		expect(monitor.team_id).toBe("team-1");
		expect(monitor.status).toBe("new");
		expect(monitor.next_expected_at).not.toBeNull();
		expect(typeof monitor.next_expected_at).toBe("number");
	});

	test("leaves next_expected_at null when created disabled", async () => {
		let monitor = unwrap(
			await models.cronJobMonitors.create({
				team_id: "team-1",
				name: "Disabled job",
				description: null,
				cron_expression: "0 0 * * *",
				timezone: "UTC",
				enabled_at: null,
			}),
		);

		expect(monitor.next_expected_at).toBeNull();
	});
});

describe("cronJobMonitors.inTeam listing", () => {
	test("lists only the team's monitors, newest first", async () => {
		let first = unwrap(
			await models.cronJobMonitors.create({
				team_id: "team-1",
				name: "First",
				description: null,
				cron_expression: "0 0 * * *",
				timezone: "UTC",
				enabled_at: null,
			}),
		);
		let second = unwrap(
			await models.cronJobMonitors.create({
				team_id: "team-1",
				name: "Second",
				description: null,
				cron_expression: "0 0 * * *",
				timezone: "UTC",
				enabled_at: null,
			}),
		);
		unwrap(
			await models.cronJobMonitors.create({
				team_id: "team-2",
				name: "Other team",
				description: null,
				cron_expression: "0 0 * * *",
				timezone: "UTC",
				enabled_at: null,
			}),
		);

		unwrap(await models.cronJobMonitors.update(first.id, { created_at: Date.now() - 60_000 }));

		let monitors = await models.cronJobMonitors
			.inTeam("team-1")
			.orderBy("created_at", "desc")
			.all();
		expect(monitors.map((monitor) => monitor.id)).toEqual([second.id, first.id]);
	});
});

describe("cronJobMonitors.inTeam lookup", () => {
	test("finds a monitor scoped to its team", async () => {
		let monitor = unwrap(
			await models.cronJobMonitors.create({
				team_id: "team-1",
				name: "A",
				description: null,
				cron_expression: "0 0 * * *",
				timezone: "UTC",
				enabled_at: null,
			}),
		);

		expect(await models.cronJobMonitors.inTeam("team-1").where({ id: monitor.id }).first()).toEqual(
			monitor,
		);
	});

	test("returns null when the monitor belongs to a different team", async () => {
		let monitor = unwrap(
			await models.cronJobMonitors.create({
				team_id: "team-1",
				name: "A",
				description: null,
				cron_expression: "0 0 * * *",
				timezone: "UTC",
				enabled_at: null,
			}),
		);

		expect(
			await models.cronJobMonitors.inTeam("team-2").where({ id: monitor.id }).first(),
		).toBeNull();
	});

	test("returns null for a missing id", async () => {
		expect(
			await models.cronJobMonitors.inTeam("team-1").where({ id: "missing" }).first(),
		).toBeNull();
	});
});

describe("cronJobMonitors.find", () => {
	test("finds a monitor by id regardless of team, for the public ping endpoint", async () => {
		let monitor = unwrap(
			await models.cronJobMonitors.create({
				team_id: "team-1",
				name: "A",
				description: null,
				cron_expression: "0 0 * * *",
				timezone: "UTC",
				enabled_at: null,
			}),
		);

		expect(await models.cronJobMonitors.find(monitor.id)).toEqual(monitor);
	});

	test("returns null for a missing id", async () => {
		expect(await models.cronJobMonitors.find("missing")).toBeNull();
	});
});

describe("cronJobMonitors.update", () => {
	test("updates a monitor's editable fields", async () => {
		let monitor = unwrap(
			await models.cronJobMonitors.create({
				team_id: "team-1",
				name: "A",
				description: null,
				cron_expression: "0 0 * * *",
				timezone: "UTC",
				enabled_at: null,
			}),
		);

		let updated = unwrap(
			await models.cronJobMonitors.update(monitor.id, {
				name: "Renamed",
				grace_period_seconds: 600,
			}),
		);

		expect(updated.name).toBe("Renamed");
		expect(updated.grace_period_seconds).toBe(600);
	});
});

describe("cronJobMonitors.delete", () => {
	test("deletes a monitor and its ping history", async () => {
		let monitor = unwrap(
			await models.cronJobMonitors.create({
				team_id: "team-1",
				name: "A",
				description: null,
				cron_expression: "0 0 * * *",
				timezone: "UTC",
				enabled_at: Date.now(),
			}),
		);
		await models.cronJobMonitors.recordPing(monitor, true, {
			sourceIp: "1.2.3.4",
			userAgent: "curl/8.0",
		});

		unwrap(await models.cronJobMonitors.delete(monitor.id));

		expect(await models.cronJobMonitors.find(monitor.id)).toBeNull();
		expect(await db.findMany(cronJobPings, { where: { cron_job_monitor_id: monitor.id } })).toEqual(
			[],
		);
	});
});

describe("cronJobPings.recent", () => {
	test("lists a monitor's pings, newest first", async () => {
		let monitor = unwrap(
			await models.cronJobMonitors.create({
				team_id: "team-1",
				name: "A",
				description: null,
				cron_expression: "0 0 * * *",
				timezone: "UTC",
				enabled_at: Date.now(),
			}),
		);

		await models.cronJobMonitors.recordPing(monitor, true, { sourceIp: null, userAgent: null });
		await new Promise((resolve) => setTimeout(resolve, 2));
		await models.cronJobMonitors.recordPing(monitor, false, { sourceIp: null, userAgent: null });

		let pings = await models.cronJobPings.recent(monitor.id);
		expect(pings).toHaveLength(2);
		expect(pings[0]?.was_on_time).toBeFalsy();
		expect(pings[1]?.was_on_time).toBeTruthy();
	});

	test("caps ping history at 50 entries", async () => {
		let monitor = unwrap(
			await models.cronJobMonitors.create({
				team_id: "team-1",
				name: "A",
				description: null,
				cron_expression: "0 0 * * *",
				timezone: "UTC",
				enabled_at: Date.now(),
			}),
		);

		for (let index = 0; index < 55; index++) {
			await db.create(
				cronJobPings,
				{
					id: crypto.randomUUID(),
					cron_job_monitor_id: monitor.id,
					was_on_time: true,
					source_ip: null,
					user_agent: null,
					created_at: Date.now() + index,
				},
				{ touch: false, returnRow: true },
			);
		}

		let pings = await models.cronJobPings.recent(monitor.id);
		expect(pings).toHaveLength(50);
	});

	test("does not include another monitor's pings", async () => {
		let monitorA = unwrap(
			await models.cronJobMonitors.create({
				team_id: "team-1",
				name: "A",
				description: null,
				cron_expression: "0 0 * * *",
				timezone: "UTC",
				enabled_at: Date.now(),
			}),
		);
		let monitorB = unwrap(
			await models.cronJobMonitors.create({
				team_id: "team-1",
				name: "B",
				description: null,
				cron_expression: "0 0 * * *",
				timezone: "UTC",
				enabled_at: Date.now(),
			}),
		);
		await models.cronJobMonitors.recordPing(monitorB, true, { sourceIp: null, userAgent: null });

		expect(await models.cronJobPings.recent(monitorA.id)).toEqual([]);
	});
});

describe("cronJobMonitors.actionable", () => {
	test("only includes enabled, scheduled monitors that are healthy or late", async () => {
		let healthy = unwrap(
			await models.cronJobMonitors.create({
				team_id: "team-1",
				name: "Healthy",
				description: null,
				cron_expression: "0 0 * * *",
				timezone: "UTC",
				enabled_at: Date.now(),
			}),
		);
		unwrap(await models.cronJobMonitors.update(healthy.id, { status: "healthy" }));

		let late = unwrap(
			await models.cronJobMonitors.create({
				team_id: "team-1",
				name: "Late",
				description: null,
				cron_expression: "0 0 * * *",
				timezone: "UTC",
				enabled_at: Date.now(),
			}),
		);
		unwrap(await models.cronJobMonitors.update(late.id, { status: "late" }));

		let missed = unwrap(
			await models.cronJobMonitors.create({
				team_id: "team-1",
				name: "Missed",
				description: null,
				cron_expression: "0 0 * * *",
				timezone: "UTC",
				enabled_at: Date.now(),
			}),
		);
		unwrap(await models.cronJobMonitors.update(missed.id, { status: "missed" }));

		/** Still "new": awaiting its first ping, with `next_expected_at` still null. */
		unwrap(
			await models.cronJobMonitors.create({
				team_id: "team-1",
				name: "New",
				description: null,
				cron_expression: "0 0 * * *",
				timezone: "UTC",
				enabled_at: null,
			}),
		);

		let disabled = unwrap(
			await models.cronJobMonitors.create({
				team_id: "team-1",
				name: "Disabled",
				description: null,
				cron_expression: "0 0 * * *",
				timezone: "UTC",
				enabled_at: Date.now(),
			}),
		);
		unwrap(await models.cronJobMonitors.update(disabled.id, { status: "healthy" }));
		unwrap(await models.cronJobMonitors.update(disabled.id, { enabled_at: null }));

		let actionable = await models.cronJobMonitors.actionable().all();
		expect(new Set(actionable.map((monitor) => monitor.id))).toEqual(
			new Set([healthy.id, late.id]),
		);
	});
});

describe("cronJobMonitors.update (status)", () => {
	test("sets the monitor's status directly", async () => {
		let monitor = unwrap(
			await models.cronJobMonitors.create({
				team_id: "team-1",
				name: "A",
				description: null,
				cron_expression: "0 0 * * *",
				timezone: "UTC",
				enabled_at: null,
			}),
		);

		let updated = unwrap(await models.cronJobMonitors.update(monitor.id, { status: "missed" }));
		expect(updated.status).toBe("missed");
	});
});

describe("cronJobMonitors.recordPing", () => {
	test("records an on-time ping as healthy and refreshes next_expected_at", async () => {
		let monitor = unwrap(
			await models.cronJobMonitors.create({
				team_id: "team-1",
				name: "A",
				description: null,
				cron_expression: "0 0 * * *",
				timezone: "UTC",
				enabled_at: Date.now(),
			}),
		);
		unwrap(await models.cronJobMonitors.update(monitor.id, { status: "late" }));

		await models.cronJobMonitors.recordPing(monitor, true, {
			sourceIp: "1.2.3.4",
			userAgent: "curl/8.0",
		});

		let pings = await models.cronJobPings.recent(monitor.id);
		expect(pings).toHaveLength(1);
		expect(pings[0]?.was_on_time).toBeTruthy();
		expect(pings[0]?.source_ip).toBe("1.2.3.4");
		expect(pings[0]?.user_agent).toBe("curl/8.0");

		let updated = await models.cronJobMonitors.find(monitor.id);
		expect(updated?.status).toBe("healthy");
		expect(typeof updated?.last_ping_at).toBe("number");
		expect(typeof updated?.next_expected_at).toBe("number");
	});

	test("records a late ping and marks the monitor late, never missed", async () => {
		let monitor = unwrap(
			await models.cronJobMonitors.create({
				team_id: "team-1",
				name: "A",
				description: null,
				cron_expression: "0 0 * * *",
				timezone: "UTC",
				enabled_at: Date.now(),
			}),
		);

		await models.cronJobMonitors.recordPing(monitor, false, { sourceIp: null, userAgent: null });

		let updated = await models.cronJobMonitors.find(monitor.id);
		expect(updated?.status).toBe("late");
	});
});

describe("calculateNextExpected", () => {
	test("computes the next UTC run for a daily cron expression", () => {
		let next = calculateNextExpected("0 0 * * *", "UTC", new Date("2026-01-05T10:00:00Z"));
		expect(next).toBe(new Date("2026-01-06T00:00:00.000Z").getTime());
	});

	test("honors the given timezone", () => {
		let from = new Date("2026-01-05T10:00:00Z");
		let utc = calculateNextExpected("0 9 * * *", "UTC", from);
		let ny = calculateNextExpected("0 9 * * *", "America/New_York", from);

		expect(utc).not.toBeNull();
		expect(ny).not.toBeNull();
		expect(new Date(utc ?? 0).toISOString()).toBe("2026-01-06T09:00:00.000Z");
		expect(new Date(ny ?? 0).toISOString()).toBe("2026-01-05T14:00:00.000Z");
	});

	test("accepts the macros the parser expands", () => {
		let from = new Date("2026-01-05T10:00:00Z");
		expect(calculateNextExpected("@daily", "UTC", from)).toBe(
			new Date("2026-01-06T00:00:00.000Z").getTime(),
		);
	});

	test("returns null for an expression that doesn't parse, rather than throwing", () => {
		expect(calculateNextExpected("not-a-cron", "UTC")).toBeNull();
	});

	test("returns null for a timezone the runtime doesn't know, rather than storing NaN", () => {
		expect(calculateNextExpected("0 0 * * *", "Mars/Olympus_Mons")).toBeNull();
	});
});
