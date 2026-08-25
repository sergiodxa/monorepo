/**
 * Tests for the two team-digest jobs' shared `perform()`: which class sends which digest, that
 * a membership is the unit of delivery, and that the send stamp moves only for the sends the
 * transport accepted.
 *
 * A fake `AuthSDK` stands in for the auth server, since a member's address is the one thing
 * this job cannot read from its own database.
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Transport } from "@pkg/mail";

import { AuthSDK, SubjectNotFoundError } from "@pkg/auth-sdk";
import { BatchedLogger } from "@pkg/logger";
import { Mailer, MailError } from "@pkg/mail";
import { MemoryTransport } from "@pkg/mail/memory";
import { failure, success } from "@pkg/result";
import { ServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { beforeEach, describe, expect, test } from "vitest";

import type { DigestPeriod } from "~/app/data/team-digest";
import type { MonitorStatus, SelectTeam } from "~/database/schema";

import Monitor from "~/app/data/monitor";
import { MAIL_FROM } from "~/app/emails/sender";
import { TeamDailyDigestEmail } from "~/app/emails/team-daily-digest";
import { TeamWeeklyDigestEmail } from "~/app/emails/team-weekly-digest";
import { SendTeamDailyDigestsJob, SendTeamWeeklyDigestsJob } from "~/app/jobs/send-team-digests";
import { createTestDatabase } from "~/app/lib/test/db";
import {
	memberships,
	monitorDailyStats,
	monitors,
	teams,
	userPreferences,
} from "~/database/schema";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

let transport = new MemoryTransport();

/**
 * Addresses the fake auth server can produce, by subject id. A subject with no entry is one
 * whose profile fails to resolve, which is what {@link seedMember} passing `null` sets up.
 */
let addresses = new Map<string, string>();

/** A transport that accepts nothing, for exercising what happens after a send fails. */
class RefusingTransport implements Transport {
	async send() {
		return failure(new MailError("provider unavailable"));
	}
}

/**
 * The auth server as this job sees it: a client-credentials exchange that succeeds, and one
 * profile lookup per member that answers only for the addresses a test seeded.
 */
function fakeSdk(): AuthSDK {
	return {
		authenticate: async () => success("token"),
		fetchSubjectById: async (subjectId: string) => {
			let email = addresses.get(subjectId);
			if (!email) return failure(new SubjectNotFoundError(subjectId));

			return success({
				id: subjectId,
				createdAt: new Date("2026-01-01T00:00:00Z"),
				updatedAt: new Date("2026-01-01T00:00:00Z"),
				displayName: `User ${subjectId}`,
				avatar: "",
				role: "user",
				username: subjectId,
				emailAddress: email,
			});
		},
	} as unknown as AuthSDK;
}

/** Runs one digest, the way a cron trigger's queue message would. */
async function runJob(db: Database, period: DigestPeriod, options: { transport?: Transport } = {}) {
	let container = new ServiceContainer();
	container.singleton(Database, () => db);
	container.singleton(
		Mailer,
		() => new Mailer({ transport: options.transport ?? transport, from: MAIL_FROM }),
	);
	container.instance(AuthSDK, fakeSdk());

	/** The period picks the class and its message type, exactly as the worker's routing does. */
	let [Digest, body] =
		period === "daily"
			? ([SendTeamDailyDigestsJob, { type: "sendTeamDailyDigests" }] as const)
			: ([SendTeamWeeklyDigestsJob, { type: "sendTeamWeeklyDigests" }] as const);
	let job = new Digest({ logger: new BatchedLogger("test") }, body);
	await container.scope(() => job.perform());
	return job;
}

async function seedTeam(db: Database, name: string): Promise<SelectTeam> {
	return await db.create(
		teams,
		{
			id: crypto.randomUUID(),
			owner_id: "owner-1",
			name,
			slug: `${name.toLowerCase()}-${crypto.randomUUID()}`,
			logo: null,
		},
		{ touch: true, returnRow: true },
	);
}

/**
 * A membership owed both digests, since neither stamp is set, plus the address the fake auth
 * server will resolve for it. `email` is `null` for the member whose profile cannot be resolved.
 */
async function seedMember(db: Database, teamId: string, subjectId: string, email: string | null) {
	if (email !== null) addresses.set(subjectId, email);

	return await db.create(
		memberships,
		{ id: crypto.randomUUID(), team_id: teamId, subject_id: subjectId, role: "member" },
		{ touch: true, returnRow: true },
	);
}

/** An enabled HTTP monitor, which is what makes its team's members due for a digest at all. */
async function seedMonitor(db: Database, teamId: string, name: string) {
	return await Monitor.create(db, teamId, "author-1", {
		name,
		url: `https://${name.toLowerCase()}.example.com`,
	});
}

/** One day of the roll-up the digests read, which is the only source either window has. */
async function seedDay(
	db: Database,
	monitorId: string,
	date: string,
	day: { checks: number; successful: number; status: MonitorStatus },
) {
	await db.create(
		monitorDailyStats,
		{
			id: crypto.randomUUID(),
			monitor_id: monitorId,
			monitor_type: "http",
			date,
			total_checks: day.checks,
			successful_checks: day.successful,
			failed_checks: day.checks - day.successful,
			avg_response_time_ms: null,
			max_response_time_ms: null,
			p95_response_time_ms: null,
			status: day.status,
		},
		{ touch: true, returnRow: true },
	);
}

/** The UTC day `daysAgo` days back, as the `YYYY-MM-DD` key the roll-up writes. */
function utcDay(daysAgo: number): string {
	return new Date(Date.now() - daysAgo * MS_PER_DAY).toISOString().slice(0, 10);
}

/** The same day as an English digest names it, for asserting which window an email covers. */
function dayLabel(daysAgo: number): string {
	return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeZone: "UTC" }).format(
		new Date(`${utcDay(daysAgo)}T00:00:00.000Z`),
	);
}

/**
 * Disables a monitor the moment `TeamDigest.listDue` has answered.
 *
 * The only way to reach the race the job guards against, since both queries require an
 * enabled monitor: this is the branch where the first query said yes and the second says no.
 */
function disableAfterListDue(db: Database, monitorId: string): void {
	let original = (db.exec as (...args: unknown[]) => Promise<unknown>).bind(db);

	(db as unknown as { exec: unknown }).exec = async (statement: unknown, values?: unknown[]) => {
		let result = await original(statement, values);

		if (typeof statement === "string" && statement.includes("subjectId")) {
			await db.update(monitors, monitorId, { enabled_at: null }, { touch: false });
		}

		return result;
	};
}

/**
 * Whether a rendered digest is the one about `teamName`, read off its heading and footer.
 * The body carries the team name as plain text, while the subject line renders through
 * i18next's plural keys with an interpolated `{{count}}`, so only the body is checked here.
 */
function namesTeam(text: string | undefined, teamName: string): boolean {
	return (text ?? "").includes(teamName);
}

/** Every daily digest the run handed the transport. */
function dailyDigests() {
	return transport.messages.filter((message) => message.email instanceof TeamDailyDigestEmail);
}

/** Every weekly one. */
function weeklyDigests() {
	return transport.messages.filter((message) => message.email instanceof TeamWeeklyDigestEmail);
}

beforeEach(() => {
	transport.clear();
	addresses.clear();
});

describe("SendTeamDigestsJob period", () => {
	test("sends the daily digest when the message names that period", async () => {
		let { db } = createTestDatabase();
		let team = await seedTeam(db, "Acme");
		await seedMember(db, team.id, "subject-1", "ada@example.com");
		let monitor = await seedMonitor(db, team.id, "Api");
		await seedDay(db, monitor.id, utcDay(1), { checks: 10, successful: 10, status: "up" });

		let job = await runJob(db, "daily");

		expect(dailyDigests()).toHaveLength(1);
		expect(weeklyDigests()).toHaveLength(0);
		expect(transport.last?.to).toEqual([{ email: "ada@example.com" }]);
		expect(namesTeam(transport.last?.text, "Acme")).toBe(true);

		let completed = job.logger.events.find(
			(event) => event.event === "job.send_team_digests.completed",
		);
		expect(completed?.period).toBe("daily");
		expect(completed?.sent).toBe(1);
		expect(completed?.skipped).toBe(0);
	});

	test("sends the weekly digest when the message names that period", async () => {
		let { db } = createTestDatabase();
		let team = await seedTeam(db, "Acme");
		await seedMember(db, team.id, "subject-1", "ada@example.com");
		let monitor = await seedMonitor(db, team.id, "Api");
		await seedDay(db, monitor.id, utcDay(1), { checks: 10, successful: 10, status: "up" });

		await runJob(db, "weekly");

		expect(weeklyDigests()).toHaveLength(1);
		expect(dailyDigests()).toHaveLength(0);
	});

	/**
	 * Two classes exist so each can report to its own cron-job monitor: a monitor holds one cron
	 * expression and `Job.run` reads `monitorId` off the class it was handed, so one class serving
	 * both periods could only ever ping one of them, leaving the other digest unwatched.
	 */
	test("gives each schedule its own cron-job monitor to report to", () => {
		let daily = SendTeamDailyDigestsJob.monitorId;
		let weekly = SendTeamWeeklyDigestsJob.monitorId;

		expect(daily).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
		expect(weekly).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
		expect(daily).not.toBe(weekly);
	});
});

describe("SendTeamDigestsJob recipients", () => {
	test("sends one email per membership, each naming its own team", async () => {
		let { db } = createTestDatabase();
		let acme = await seedTeam(db, "Acme");
		let beta = await seedTeam(db, "Beta");
		await seedMember(db, acme.id, "subject-1", "ada@example.com");
		await seedMember(db, beta.id, "subject-1", "ada@example.com");
		let acmeMonitor = await seedMonitor(db, acme.id, "Api");
		let betaMonitor = await seedMonitor(db, beta.id, "Site");
		await seedDay(db, acmeMonitor.id, utcDay(1), { checks: 10, successful: 10, status: "up" });
		await seedDay(db, betaMonitor.id, utcDay(1), { checks: 10, successful: 10, status: "up" });

		await runJob(db, "daily");

		let digests = dailyDigests();
		expect(digests).toHaveLength(2);
		expect(digests.every((message) => message.to[0]?.email === "ada@example.com")).toBe(true);
		expect(digests.filter((message) => namesTeam(message.text, "Acme"))).toHaveLength(1);
		expect(digests.filter((message) => namesTeam(message.text, "Beta"))).toHaveLength(1);
	});

	test("sends every member of one team their own copy", async () => {
		let { db } = createTestDatabase();
		let team = await seedTeam(db, "Acme");
		await seedMember(db, team.id, "subject-1", "ada@example.com");
		await seedMember(db, team.id, "subject-2", "grace@example.com");
		let monitor = await seedMonitor(db, team.id, "Api");
		await seedDay(db, monitor.id, utcDay(1), { checks: 10, successful: 10, status: "up" });

		await runJob(db, "daily");

		let recipients = dailyDigests().flatMap((message) =>
			message.to.map((address) => address.email),
		);
		expect(recipients.sort()).toEqual(["ada@example.com", "grace@example.com"]);
	});

	test("sends nothing to a member who turned that digest off, and the other one still arrives", async () => {
		let { db } = createTestDatabase();
		let team = await seedTeam(db, "Acme");
		let membership = await seedMember(db, team.id, "subject-1", "ada@example.com");
		let monitor = await seedMonitor(db, team.id, "Api");
		await seedDay(db, monitor.id, utcDay(1), { checks: 10, successful: 10, status: "up" });
		await db.create(
			userPreferences,
			{
				id: crypto.randomUUID(),
				subject_id: "subject-1",
				unsubscribed_emails: ["teamDailyDigest"],
			},
			{ touch: true, returnRow: true },
		);

		let job = await runJob(db, "daily");

		expect(transport.messages).toHaveLength(0);
		expect(
			job.logger.events.find((event) => event.event === "job.send_team_digests.nobody_due"),
		).toBeDefined();
		expect((await db.find(memberships, membership.id))?.last_daily_digest_at).toBeNull();

		await runJob(db, "weekly");

		expect(weeklyDigests()).toHaveLength(1);
	});

	/** Left unstamped since the address may resolve tomorrow, and the digest itself was never sent. */
	test("skips a member whose profile does not resolve, without stamping it", async () => {
		let { db } = createTestDatabase();
		let team = await seedTeam(db, "Acme");
		let membership = await seedMember(db, team.id, "subject-1", null);
		let monitor = await seedMonitor(db, team.id, "Api");
		await seedDay(db, monitor.id, utcDay(1), { checks: 10, successful: 10, status: "up" });

		let job = await runJob(db, "daily");

		expect(transport.messages).toHaveLength(0);
		expect(
			job.logger.events.find((event) => event.event === "job.send_team_digests.profile_missing"),
		).toBeDefined();
		expect((await db.find(memberships, membership.id))?.last_daily_digest_at).toBeNull();
	});
});

describe("SendTeamDigestsJob stamp", () => {
	/**
	 * The weekly digest is a different schedule with its own stamp, so it stays untouched here and
	 * Monday's run still finds this membership due.
	 */
	test("stamps only the period that was sent, so a second run the same day sends nothing", async () => {
		let { db } = createTestDatabase();
		let team = await seedTeam(db, "Acme");
		let membership = await seedMember(db, team.id, "subject-1", "ada@example.com");
		let monitor = await seedMonitor(db, team.id, "Api");
		await seedDay(db, monitor.id, utcDay(1), { checks: 10, successful: 10, status: "up" });

		await runJob(db, "daily");
		await runJob(db, "daily");

		expect(dailyDigests()).toHaveLength(1);

		let row = await db.find(memberships, membership.id);
		expect(row?.last_daily_digest_at).not.toBeNull();
		expect(row?.last_weekly_digest_at).toBeNull();
	});

	test("leaves the stamp untouched when the transport refuses the digest", async () => {
		let { db } = createTestDatabase();
		let team = await seedTeam(db, "Acme");
		let membership = await seedMember(db, team.id, "subject-1", "ada@example.com");
		let monitor = await seedMonitor(db, team.id, "Api");
		await seedDay(db, monitor.id, utcDay(1), { checks: 10, successful: 10, status: "up" });

		let job = await runJob(db, "daily", { transport: new RefusingTransport() });

		expect(
			job.logger.events.find((event) => event.event === "job.send_team_digests.email_failed"),
		).toBeDefined();
		expect((await db.find(memberships, membership.id))?.last_daily_digest_at).toBeNull();

		await runJob(db, "daily");

		expect(dailyDigests()).toHaveLength(1);
	});

	test("sends nothing and stamps nothing when the team's last monitor is disabled mid-run", async () => {
		let { db } = createTestDatabase();
		let team = await seedTeam(db, "Acme");
		let membership = await seedMember(db, team.id, "subject-1", "ada@example.com");
		let monitor = await seedMonitor(db, team.id, "Api");
		await seedDay(db, monitor.id, utcDay(1), { checks: 10, successful: 10, status: "up" });
		disableAfterListDue(db, monitor.id);

		let job = await runJob(db, "daily");

		expect(transport.messages).toHaveLength(0);
		expect(
			job.logger.events.find((event) => event.event === "job.send_team_digests.nothing_to_report"),
		).toBeDefined();
		expect((await db.find(memberships, membership.id))?.last_daily_digest_at).toBeNull();
	});
});

describe("SendTeamDigestsJob window", () => {
	/**
	 * A window of just yesterday reads "Up 100.0%"; folding in the day before, which was fully
	 * down, would read "Down 50.0%" instead — the whole difference a one-day window makes.
	 */
	test("reports yesterday in the daily digest and nothing before it", async () => {
		let { db } = createTestDatabase();
		let team = await seedTeam(db, "Acme");
		await seedMember(db, team.id, "subject-1", "ada@example.com");
		let monitor = await seedMonitor(db, team.id, "Api");
		await seedDay(db, monitor.id, utcDay(1), { checks: 10, successful: 10, status: "up" });
		await seedDay(db, monitor.id, utcDay(2), { checks: 10, successful: 0, status: "down" });

		await runJob(db, "daily");

		let text = transport.last?.text ?? "";
		expect(text).toContain("Up 100.0%");
		expect(text).not.toContain("50.0%");
		expect(text).not.toContain("Down");
	});

	/**
	 * Fifteen of twenty checks across the two included days reads 75.0%; the eighth day would
	 * pull it to 50.0% and dropping the seventh would read 100.0%. The bar's captions are the
	 * window's own ends — seven days ago and yesterday — never today or the eighth day back.
	 */
	test("reports the seven days ending yesterday in the weekly digest", async () => {
		let { db } = createTestDatabase();
		let team = await seedTeam(db, "Acme");
		await seedMember(db, team.id, "subject-1", "ada@example.com");
		let monitor = await seedMonitor(db, team.id, "Api");
		await seedDay(db, monitor.id, utcDay(1), { checks: 10, successful: 10, status: "up" });
		await seedDay(db, monitor.id, utcDay(7), { checks: 10, successful: 5, status: "degraded" });
		await seedDay(db, monitor.id, utcDay(8), { checks: 10, successful: 0, status: "down" });

		await runJob(db, "weekly");

		let text = transport.last?.text ?? "";
		expect(text).toContain("75.0%");
		expect(text).not.toContain("50.0%");
		expect(text).toContain(dayLabel(7));
		expect(text).toContain(dayLabel(1));
		expect(text).not.toContain(dayLabel(0));
		expect(text).not.toContain(dayLabel(8));
	});
});
