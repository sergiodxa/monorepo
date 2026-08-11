/**
 * Unit tests for the `TeamDigest` read model: who is owed a digest, what a team's monitors did
 * over a window, and the stamp that says one went out.
 *
 * Three decisions carry all the weight here, and each is a place where a plausible query would
 * pass a careless test. The due-list is guarded by two independent conditions — a stamp that
 * predates the run's cutoff, and a team with something worth reporting — so a query that dropped
 * either would still return the obvious membership. The two periods keep separate stamps, which
 * is what makes a team that got its daily digest this morning still due its weekly one. And the
 * report is an *outer* join over four monitor tables, so a monitor with no rows at all has to
 * come back with no days rather than not come back.
 *
 * Rows are seeded directly instead of through the four monitor models: what is under test is one
 * SQL union over `enabled_at IS NOT NULL` and `is_enabled = 1`, and going through the models
 * would leave the disabled halves of that union unreachable. No `teams` row is created either,
 * because neither query joins that table — a team is only a `team_id` to the SQL being tested.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, test } from "bun:test";

import type { Database } from "remix/data-table";

import type { DailyStatsMonitorType } from "~/app/data/monitor-daily-stats";
import type { DigestPeriod } from "~/app/data/team-digest";
import type { MonitorStatus } from "~/database/schema";

import MonitorDailyStats from "~/app/data/monitor-daily-stats";
import TeamDigest from "~/app/data/team-digest";
import { createTestDatabase } from "~/app/lib/test/db";
import {
	cronJobMonitors,
	dnsMonitors,
	memberships,
	monitors,
	tcpMonitors,
} from "~/database/schema";

/** Every type the union covers, so a case that must hold for all four is written once. */
const MONITOR_TYPES = ["http", "dns", "tcp", "cron"] as const satisfies DailyStatsMonitorType[];

/** Both periods, for the cases that must hold whichever stamp is in play. */
const PERIODS = ["daily", "weekly"] as const satisfies DigestPeriod[];

const MS_PER_DAY = 24 * 60 * 60 * 1000;

let db: Database;

beforeEach(() => {
	db = createTestDatabase().db;
});

/** A membership of `teamId`, with the stamps and the creation instant overridable. */
async function seedMembership(
	teamId: string,
	overrides: {
		subjectId?: string;
		createdAt?: number;
		lastDailyDigestAt?: number | null;
		lastWeeklyDigestAt?: number | null;
	} = {},
) {
	let membership = await db.create(
		memberships,
		{
			id: crypto.randomUUID(),
			team_id: teamId,
			subject_id: overrides.subjectId ?? crypto.randomUUID(),
			role: "member",
			last_daily_digest_at: overrides.lastDailyDigestAt ?? null,
			last_weekly_digest_at: overrides.lastWeeklyDigestAt ?? null,
		},
		{ touch: true, returnRow: true },
	);

	/** Written after the fact, since `touch` owns `created_at` on the way in. */
	if (overrides.createdAt !== undefined) {
		await db.update(
			memberships,
			membership.id,
			{ created_at: overrides.createdAt },
			{
				touch: false,
			},
		);
	}

	return membership;
}

/**
 * One monitor of the given type on `teamId`, enabled unless told otherwise.
 *
 * The two spellings of "off" are the point: `monitors` and `cron_job_monitors` are disabled by a
 * null `enabled_at`, `dns_monitors` and `tcp_monitors` by `is_enabled = 0`.
 */
async function seedMonitor(
	type: DailyStatsMonitorType,
	teamId: string,
	options: { id?: string; name?: string; enabled?: boolean } = {},
) {
	let id = options.id ?? crypto.randomUUID();
	let name = options.name ?? `${type} monitor`;
	let enabled = options.enabled ?? true;
	let shared = { id, team_id: teamId, name };
	let write = { touch: true, returnRow: true } as const;

	if (type === "http") {
		await db.create(
			monitors,
			{
				...shared,
				author_id: crypto.randomUUID(),
				url: "https://example.com",
				enabled_at: enabled ? Date.now() : null,
			},
			write,
		);
	}

	if (type === "dns") {
		await db.create(dnsMonitors, { ...shared, domain: "example.com", is_enabled: enabled }, write);
	}

	if (type === "tcp") {
		await db.create(
			tcpMonitors,
			{ ...shared, host: "db.example.com", port: 5432, is_enabled: enabled },
			write,
		);
	}

	if (type === "cron") {
		await db.create(
			cronJobMonitors,
			{ ...shared, cron_expression: "0 0 * * *", enabled_at: enabled ? Date.now() : null },
			write,
		);
	}

	return { id, type, name };
}

/** One day of the roll-up for a monitor, which is the only place the report reads from. */
async function seedDay(
	monitor: { id: string; type: DailyStatsMonitorType },
	date: string,
	counts: { total?: number; successful?: number; status?: MonitorStatus } = {},
) {
	let total = counts.total ?? 10;
	let successful = counts.successful ?? total;

	return await MonitorDailyStats.upsertDay(db, {
		monitor_id: monitor.id,
		monitor_type: monitor.type,
		date,
		total_checks: total,
		successful_checks: successful,
		failed_checks: total - successful,
		avg_response_time_ms: 40,
		max_response_time_ms: 60,
		status: counts.status ?? "up",
	});
}

describe("TeamDigest.listDue", () => {
	let cutoff = Date.parse("2026-08-03T00:00:00Z");

	test("returns a membership that has never been sent this digest", async () => {
		await seedMonitor("http", "team-a");
		let membership = await seedMembership("team-a");

		let due = await TeamDigest.listDue(db, "daily", cutoff);

		expect(due).toEqual([
			{ id: membership.id, teamId: "team-a", subjectId: membership.subject_id },
		]);
	});

	test("returns a membership whose stamp predates the cutoff", async () => {
		await seedMonitor("http", "team-a");
		let membership = await seedMembership("team-a", { lastDailyDigestAt: cutoff - 1 });

		expect((await TeamDigest.listDue(db, "daily", cutoff)).map((each) => each.id)).toEqual([
			membership.id,
		]);
	});

	/** The bound is exclusive at the cutoff, which is what makes a redelivered trigger a no-op. */
	test("excludes a membership stamped at the cutoff", async () => {
		await seedMonitor("http", "team-a");
		await seedMembership("team-a", { lastDailyDigestAt: cutoff });

		expect(await TeamDigest.listDue(db, "daily", cutoff)).toBeEmpty();
	});

	test("excludes a membership stamped after the cutoff", async () => {
		await seedMonitor("http", "team-a");
		await seedMembership("team-a", { lastDailyDigestAt: cutoff + MS_PER_DAY });

		expect(await TeamDigest.listDue(db, "daily", cutoff)).toBeEmpty();
	});

	/**
	 * The reason the stamps are two columns and not one. The weekly trigger fires on a morning
	 * the daily one has already run, so a shared stamp would suppress every weekly digest.
	 */
	test("leaves the weekly digest due to a membership already sent today's daily one", async () => {
		await seedMonitor("http", "team-a");
		let membership = await seedMembership("team-a", { lastDailyDigestAt: cutoff });

		expect(await TeamDigest.listDue(db, "daily", cutoff)).toBeEmpty();
		expect((await TeamDigest.listDue(db, "weekly", cutoff)).map((each) => each.id)).toEqual([
			membership.id,
		]);
	});

	test("leaves the daily digest due to a membership already sent this week's weekly one", async () => {
		await seedMonitor("http", "team-a");
		let membership = await seedMembership("team-a", { lastWeeklyDigestAt: cutoff });

		expect(await TeamDigest.listDue(db, "weekly", cutoff)).toBeEmpty();
		expect((await TeamDigest.listDue(db, "daily", cutoff)).map((each) => each.id)).toEqual([
			membership.id,
		]);
	});

	test("returns every member of a team, oldest membership first", async () => {
		await seedMonitor("http", "team-a");
		let second = await seedMembership("team-a", { createdAt: cutoff - MS_PER_DAY });
		let first = await seedMembership("team-a", { createdAt: cutoff - 2 * MS_PER_DAY });

		expect((await TeamDigest.listDue(db, "daily", cutoff)).map((each) => each.id)).toEqual([
			first.id,
			second.id,
		]);
	});

	/** The grouping the job relies on to build each team's report once. */
	test("keeps each team's members together", async () => {
		await seedMonitor("http", "team-a");
		await seedMonitor("http", "team-b");
		await seedMembership("team-a", { createdAt: cutoff - 3 * MS_PER_DAY });
		await seedMembership("team-b", { createdAt: cutoff - 2 * MS_PER_DAY });
		await seedMembership("team-a", { createdAt: cutoff - 1 * MS_PER_DAY });

		expect((await TeamDigest.listDue(db, "daily", cutoff)).map((each) => each.teamId)).toEqual([
			"team-a",
			"team-a",
			"team-b",
		]);
	});

	/**
	 * A digest of nothing is not worth an email, and skipping the team here is also what keeps
	 * the job from resolving an address it will not use.
	 */
	test("excludes a membership of a team with no monitors at all", async () => {
		await seedMembership("team-a");

		expect(await TeamDigest.listDue(db, "daily", cutoff)).toBeEmpty();
	});

	test("excludes a membership of a team whose only monitor belongs to another team", async () => {
		await seedMonitor("http", "team-b");
		await seedMembership("team-a");

		expect(await TeamDigest.listDue(db, "daily", cutoff)).toBeEmpty();
	});

	for (let type of MONITOR_TYPES) {
		test(`includes a team whose only monitor is a ${type} monitor`, async () => {
			await seedMonitor(type, "team-a");
			let membership = await seedMembership("team-a");

			expect((await TeamDigest.listDue(db, "daily", cutoff)).map((each) => each.id)).toEqual([
				membership.id,
			]);
		});

		test(`excludes a team whose only ${type} monitor is disabled`, async () => {
			await seedMonitor(type, "team-a", { enabled: false });
			await seedMembership("team-a");

			expect(await TeamDigest.listDue(db, "daily", cutoff)).toBeEmpty();
		});
	}

	test("includes a team that still has one enabled monitor beside a disabled one", async () => {
		await seedMonitor("http", "team-a", { enabled: false });
		await seedMonitor("tcp", "team-a", { enabled: true });
		let membership = await seedMembership("team-a");

		expect((await TeamDigest.listDue(db, "daily", cutoff)).map((each) => each.id)).toEqual([
			membership.id,
		]);
	});

	/** Why the monitor condition is an `EXISTS` and not a join: a join would mail one copy each. */
	test("returns a membership once, however many monitors the team runs", async () => {
		for (let type of MONITOR_TYPES) {
			await seedMonitor(type, "team-a");
			await seedMonitor(type, "team-a");
		}
		await seedMembership("team-a");

		expect(await TeamDigest.listDue(db, "daily", cutoff)).toHaveLength(1);
	});

	test("returns nothing when there are no memberships at all", async () => {
		await seedMonitor("http", "team-a");

		expect(await TeamDigest.listDue(db, "daily", cutoff)).toBeEmpty();
	});
});

describe("TeamDigest.listMonitors", () => {
	let since = "2026-07-27";
	let until = "2026-08-02";

	test("groups a monitor's days into one entry, oldest first", async () => {
		let monitor = await seedMonitor("http", "team-a", { name: "Homepage" });
		// Seeded out of order, so the ordering can only come from the query.
		await seedDay(monitor, "2026-08-01", { total: 20, successful: 19, status: "degraded" });
		await seedDay(monitor, "2026-07-27", { total: 10, successful: 10 });
		await seedDay(monitor, "2026-07-30", { total: 15, successful: 0, status: "down" });

		let [report] = await TeamDigest.listMonitors(db, "team-a", since, until);

		expect(report?.id).toBe(monitor.id);
		expect(report?.type).toBe("http");
		expect(report?.name).toBe("Homepage");
		expect(report?.days).toEqual([
			{ date: "2026-07-27", totalChecks: 10, successfulChecks: 10, status: "up" },
			{ date: "2026-07-30", totalChecks: 15, successfulChecks: 0, status: "down" },
			{ date: "2026-08-01", totalChecks: 20, successfulChecks: 19, status: "degraded" },
		]);
	});

	/**
	 * The outer join's whole reason: a monitor enabled yesterday is part of what the team runs,
	 * and an email that says how many monitors it covers must not quietly cover fewer.
	 */
	test("returns an enabled monitor with no stats rows at all, with no days", async () => {
		let monitor = await seedMonitor("http", "team-a", { name: "Fresh" });

		expect(await TeamDigest.listMonitors(db, "team-a", since, until)).toEqual([
			{ id: monitor.id, type: "http", name: "Fresh", days: [] },
		]);
	});

	test("excludes days before the window and after it, keeping both bounds", async () => {
		let monitor = await seedMonitor("http", "team-a");
		await seedDay(monitor, "2026-07-26");
		await seedDay(monitor, since);
		await seedDay(monitor, until);
		await seedDay(monitor, "2026-08-03");

		let [report] = await TeamDigest.listMonitors(db, "team-a", since, until);

		expect(report?.days.map((day) => day.date)).toEqual([since, until]);
	});

	/** Days outside the window drop out of the join, not the monitor along with them. */
	test("still returns a monitor whose only days fall outside the window", async () => {
		let monitor = await seedMonitor("http", "team-a", { name: "Old" });
		await seedDay(monitor, "2026-07-01");

		expect(await TeamDigest.listMonitors(db, "team-a", since, until)).toEqual([
			{ id: monitor.id, type: "http", name: "Old", days: [] },
		]);
	});

	test("excludes another team's monitors and their days", async () => {
		let mine = await seedMonitor("http", "team-a", { name: "Mine" });
		let theirs = await seedMonitor("http", "team-b", { name: "Theirs" });
		await seedDay(mine, since);
		await seedDay(theirs, since);

		expect(
			(await TeamDigest.listMonitors(db, "team-a", since, until)).map((each) => each.name),
		).toEqual(["Mine"]);
	});

	test("excludes a disabled monitor even when it has days in the window", async () => {
		let disabled = await seedMonitor("dns", "team-a", { name: "Off", enabled: false });
		await seedMonitor("dns", "team-a", { name: "On" });
		await seedDay(disabled, since);

		expect(
			(await TeamDigest.listMonitors(db, "team-a", since, until)).map((each) => each.name),
		).toEqual(["On"]);
	});

	test("reports all four monitor types, ordered by name", async () => {
		await seedMonitor("tcp", "team-a", { name: "Database" });
		await seedMonitor("http", "team-a", { name: "Homepage" });
		await seedMonitor("cron", "team-a", { name: "Nightly" });
		await seedMonitor("dns", "team-a", { name: "Apex" });

		let report = await TeamDigest.listMonitors(db, "team-a", since, until);

		expect(report.map((each) => [each.name, each.type])).toEqual([
			["Apex", "dns"],
			["Database", "tcp"],
			["Homepage", "http"],
			["Nightly", "cron"],
		]);
	});

	/**
	 * The four monitor tables mint their ids independently, so one id can name a monitor in two
	 * of them. Both the stats rows and the join are keyed on the pair, and this is the case that
	 * tells a pair-keyed join apart from an id-keyed one.
	 */
	test("never gives one monitor's days to another type sharing its id", async () => {
		let shared = crypto.randomUUID();
		let http = await seedMonitor("http", "team-a", { id: shared, name: "Http" });
		await seedMonitor("dns", "team-a", { id: shared, name: "Dns" });
		await seedDay(http, since);

		let report = await TeamDigest.listMonitors(db, "team-a", since, until);

		expect(report.map((each) => [each.name, each.days.length])).toEqual([
			["Dns", 0],
			["Http", 1],
		]);
	});

	test("returns nothing for a team with no monitors", async () => {
		await seedMonitor("http", "team-b");

		expect(await TeamDigest.listMonitors(db, "team-a", since, until)).toBeEmpty();
	});

	/** The one-day window both bounds collapse to, which is what the daily digest asks for. */
	test("reads a single day when since and until are the same", async () => {
		let monitor = await seedMonitor("cron", "team-a");
		await seedDay(monitor, "2026-08-01");
		await seedDay(monitor, "2026-08-02");

		let [report] = await TeamDigest.listMonitors(db, "team-a", "2026-08-02", "2026-08-02");

		expect(report?.days.map((day) => day.date)).toEqual(["2026-08-02"]);
	});
});

describe("TeamDigest.markSent", () => {
	let sentAt = Date.parse("2026-08-03T01:15:00Z");

	for (let period of PERIODS) {
		test(`stamps the ${period} digest and leaves the other one alone`, async () => {
			let membership = await seedMembership("team-a");

			await TeamDigest.markSent(db, membership.id, period, sentAt);
			let stored = await db.findOne(memberships, { where: { id: membership.id } });

			expect(stored?.[period === "daily" ? "last_daily_digest_at" : "last_weekly_digest_at"]).toBe(
				sentAt,
			);
			expect(
				stored?.[period === "daily" ? "last_weekly_digest_at" : "last_daily_digest_at"],
			).toBeNull();
		});

		test(`is what takes the membership out of the ${period} due list for the day`, async () => {
			await seedMonitor("http", "team-a");
			let membership = await seedMembership("team-a");
			let today = Date.parse("2026-08-03T00:00:00Z");
			let tomorrow = Date.parse("2026-08-04T00:00:00Z");

			await TeamDigest.markSent(db, membership.id, period, sentAt);

			expect(await TeamDigest.listDue(db, period, today)).toBeEmpty();
			// And due again once the bound has moved, which is what the next trigger passes.
			expect((await TeamDigest.listDue(db, period, tomorrow)).map((each) => each.id)).toEqual([
				membership.id,
			]);
		});
	}

	test("keeps an earlier stamp of the other period when it writes its own", async () => {
		let earlier = sentAt - 7 * MS_PER_DAY;
		let membership = await seedMembership("team-a", { lastWeeklyDigestAt: earlier });

		await TeamDigest.markSent(db, membership.id, "daily", sentAt);
		let stored = await db.findOne(memberships, { where: { id: membership.id } });

		expect(stored?.last_daily_digest_at).toBe(sentAt);
		expect(stored?.last_weekly_digest_at).toBe(earlier);
	});

	test("moves the stamp forward on a later send", async () => {
		let membership = await seedMembership("team-a", { lastDailyDigestAt: sentAt - MS_PER_DAY });

		await TeamDigest.markSent(db, membership.id, "daily", sentAt);

		expect(
			(await db.findOne(memberships, { where: { id: membership.id } }))?.last_daily_digest_at,
		).toBe(sentAt);
	});

	test("stamps one membership and never another of the same team", async () => {
		let mailed = await seedMembership("team-a");
		let other = await seedMembership("team-a");

		await TeamDigest.markSent(db, mailed.id, "daily", sentAt);

		expect(
			(await db.findOne(memberships, { where: { id: other.id } }))?.last_daily_digest_at,
		).toBeNull();
	});
});
