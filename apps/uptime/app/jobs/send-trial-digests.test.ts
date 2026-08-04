/**
 * Unit tests for `SendTrialDigestsJob.perform()`: which leads a run picks up, that a lead
 * watching three URLs gets exactly one email covering all three rather than three emails,
 * that a lead with no active watch gets none at all, and that the stamp is what moves the
 * next digest to the following day.
 *
 * The signup-day rule is tested directly, because it is the one that fails quietly: the
 * window is counted from `created_at` when no digest has been sent, so somebody who tried a
 * URL an hour ago must not be sent a summary of that hour.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, test } from "bun:test";

import type { Transport } from "@pkg/mail";

import { BatchedLogger } from "@pkg/logger";
import { Mailer, MailError } from "@pkg/mail";
import { MemoryTransport } from "@pkg/mail/memory";
import { failure } from "@pkg/result";
import { ServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";

import type { MonitorStatus, SelectLead, SelectTrialWatch } from "~/database/schema";

import Lead from "~/app/data/lead";
import TrialWatch from "~/app/data/trial-watch";
import { MAIL_FROM } from "~/app/emails/sender";
import { TrialDailyDigestEmail } from "~/app/emails/trial-daily-digest";
import { SendTrialDigestsJob } from "~/app/jobs/send-trial-digests";
import { createTestDatabase } from "~/app/lib/test/db";
import { leads, trialWatches } from "~/database/schema";

const MS_PER_HOUR = 60 * 60 * 1000;
const MS_PER_DAY = 24 * MS_PER_HOUR;

let transport = new MemoryTransport();

/** A transport that accepts nothing, for the cases about what a failed send must not do. */
class RefusingTransport implements Transport {
	async send() {
		return failure(new MailError("provider unavailable"));
	}
}

async function runJob(db: Database) {
	let container = new ServiceContainer();
	container.singleton(Database, () => db);
	container.singleton(Mailer, () => new Mailer({ transport, from: MAIL_FROM }));

	let job = new SendTrialDigestsJob({ logger: new BatchedLogger("test") }, {});
	await container.scope(() => job.perform());
	return job;
}

/**
 * Seeds a lead that is already owed a digest. Backdated, because the window is counted from
 * `created_at` until a digest has been sent and a lead created now is not due until tomorrow.
 */
async function seedDueLead(db: Database, email = "visitor@example.com"): Promise<SelectLead> {
	let lead = await Lead.upsertByEmail(db, {
		email,
		locale: "en",
		consented: false,
	});

	await db.update(leads, lead.id, { created_at: Date.now() - 2 * MS_PER_DAY }, { touch: false });

	let row = await Lead.findById(db, lead.id);
	if (!row) throw new Error("Seeded lead disappeared");
	return row;
}

async function seedWatch(
	db: Database,
	leadId: string,
	url: string,
	overrides: Partial<SelectTrialWatch> = {},
): Promise<SelectTrialWatch> {
	let created = await TrialWatch.create(db, leadId, { url });
	if (!created) throw new Error("Failed to seed trial watch");

	if (Object.keys(overrides).length > 0) {
		await db.update(trialWatches, created.id, overrides, { touch: false });
	}

	let row = await TrialWatch.findById(db, created.id);
	if (!row) throw new Error("Seeded trial watch disappeared");
	return row;
}

/** Records one completed check `hoursAgo` back, which is what a digest's bar is drawn from. */
async function seedResult(
	db: Database,
	watchId: string,
	hoursAgo: number,
	status: MonitorStatus,
	responseTimeMs: number | null = 100,
) {
	await db.exec(
		`INSERT INTO trial_watch_results (id, trial_watch_id, status, response_time_ms, checked_at)
		 VALUES (?, ?, ?, ?, ?)`,
		[
			`result-${watchId}-${hoursAgo}`,
			watchId,
			status,
			responseTimeMs,
			Date.now() - hoursAgo * MS_PER_HOUR,
		],
	);
}

/** Every daily digest the run handed the transport. */
function digests() {
	return transport.messages.filter((message) => message.email instanceof TrialDailyDigestEmail);
}

beforeEach(() => {
	transport.clear();
});

describe("SendTrialDigestsJob", () => {
	test("sends one lead watching three URLs exactly one email", async () => {
		let { db } = createTestDatabase();
		let lead = await seedDueLead(db);
		let first = await seedWatch(db, lead.id, "https://one.example.com", { last_status: "up" });
		await seedWatch(db, lead.id, "https://two.example.com", { last_status: "down" });
		await seedWatch(db, lead.id, "https://three.example.com", { last_status: "degraded" });
		await seedResult(db, first.id, 3, "up");

		let job = await runJob(db);

		expect(digests()).toHaveLength(1);
		expect(transport.last?.to).toEqual([{ email: "visitor@example.com" }]);
		// Three URLs, one reader, one inbox — the subject counts them rather than naming one.
		expect(transport.last?.subject).toContain("3");

		let completed = job.logger.events.find(
			(event) => event.event === "job.send_trial_digests.completed",
		);
		expect(completed?.total).toBe(1);
		expect(completed?.sent).toBe(1);
	});

	test("sends a lead with no active watch nothing at all", async () => {
		let { db } = createTestDatabase();
		let lead = await seedDueLead(db);
		// A watch whose week is over: `next_due_at` is null, which is what "active" means.
		await seedWatch(db, lead.id, "https://done.example.com", {
			next_due_at: null,
			last_status: "up",
		});

		let job = await runJob(db);

		expect(transport.messages).toHaveLength(0);

		let completed = job.logger.events.find(
			(event) => event.event === "job.send_trial_digests.completed",
		);
		expect(completed?.total).toBe(0);
	});

	test("sends a lead with no watches at all nothing", async () => {
		let { db } = createTestDatabase();
		await seedDueLead(db);

		await runJob(db);

		expect(transport.messages).toHaveLength(0);
	});

	test("sends nothing on the day someone signed up", async () => {
		let { db } = createTestDatabase();
		let lead = await Lead.upsertByEmail(db, {
			email: "fresh@example.com",
			locale: "en",
			consented: false,
		});
		await seedWatch(db, lead.id, "https://example.com", { last_status: "up" });

		await runJob(db);

		expect(transport.messages).toHaveLength(0);
	});

	test("stamps the lead so the next run sends nothing", async () => {
		let { db } = createTestDatabase();
		let lead = await seedDueLead(db);
		await seedWatch(db, lead.id, "https://example.com", { last_status: "up" });

		await runJob(db);
		await runJob(db);

		expect(digests()).toHaveLength(1);
		expect((await Lead.findById(db, lead.id))?.last_digest_at).not.toBeNull();
	});

	test("sends one email per lead, not one per lead per URL", async () => {
		let { db } = createTestDatabase();
		let first = await seedDueLead(db, "one@example.com");
		let second = await seedDueLead(db, "two@example.com");
		await seedWatch(db, first.id, "https://a.example.com", { last_status: "up" });
		await seedWatch(db, first.id, "https://b.example.com", { last_status: "up" });
		await seedWatch(db, second.id, "https://c.example.com", { last_status: "up" });

		await runJob(db);

		let recipients = digests().flatMap((message) => message.to.map((address) => address.email));

		expect(digests()).toHaveLength(2);
		expect(recipients.sort()).toEqual(["one@example.com", "two@example.com"]);
	});

	test("skips a watch that has never completed a check and has no cached status", async () => {
		let { db } = createTestDatabase();
		let lead = await seedDueLead(db);
		await seedWatch(db, lead.id, "https://unknown.example.com", { last_status: null });

		let job = await runJob(db);

		expect(transport.messages).toHaveLength(0);
		expect(
			job.logger.events.find((event) => event.event === "job.send_trial_digests.nothing_to_report"),
		).toBeDefined();
		// Nothing was sent, so nothing is stamped and tomorrow's run tries again.
		expect((await Lead.findById(db, lead.id))?.last_digest_at).toBeNull();
	});

	test("reports the last day and ignores checks older than the window", async () => {
		let { db } = createTestDatabase();
		let lead = await seedDueLead(db);
		let watch = await seedWatch(db, lead.id, "https://example.com", { last_status: "up" });
		await seedResult(db, watch.id, 2, "up", 100);
		await seedResult(db, watch.id, 5, "down", null);
		await seedResult(db, watch.id, 40, "down", null);

		await runJob(db);

		// Two checks inside the 24-hour window, one of them healthy; the third is older than
		// the window and is neither counted nor drawn.
		expect(transport.last?.text).toContain("Checks run 2");
		expect(transport.last?.text).toContain("Uptime 50.0%");
		expect(transport.last?.text).toContain("Slowest response 100ms");
	});

	/**
	 * The funnel's email counter is read as "emails this person received", so it is gated on
	 * exactly what the digest stamp is gated on. A counter incremented next to `send()` rather
	 * than after it would measure what was attempted, which is a different number and the one
	 * nobody asked for.
	 */
	test("counts the digest against the lead once it has been accepted", async () => {
		let { db } = createTestDatabase();
		let lead = await seedDueLead(db);
		await seedWatch(db, lead.id, "https://example.com", { last_status: "up" });

		await runJob(db);

		expect((await Lead.findById(db, lead.id))?.emails_sent).toBe(1);
	});

	test("counts nothing when the transport refuses the digest", async () => {
		let { db } = createTestDatabase();
		let lead = await seedDueLead(db);
		await seedWatch(db, lead.id, "https://example.com", { last_status: "up" });

		let container = new ServiceContainer();
		container.singleton(Database, () => db);
		container.singleton(
			Mailer,
			() => new Mailer({ transport: new RefusingTransport(), from: MAIL_FROM }),
		);
		let job = new SendTrialDigestsJob({ logger: new BatchedLogger("test") }, {});
		await container.scope(() => job.perform());

		let row = await Lead.findById(db, lead.id);
		expect(row?.emails_sent).toBe(0);
		// And the digest stays owed, which is the existing rule this one is tied to.
		expect(row?.last_digest_at).toBeNull();
	});
});

/**
 * The `funnel.trial_progress_email_sent` event. It is emitted on the same condition as the
 * stamp — a send the transport accepted — because a report of an email nobody received would
 * overstate the only engagement measure this funnel has.
 */
describe("SendTrialDigestsJob funnel events", () => {
	/** Every progress-email event a run emitted. */
	function funnelEvents(job: { logger: BatchedLogger }) {
		return job.logger.events.filter((event) => event.event === "funnel.trial_progress_email_sent");
	}

	test("reports one event per email, with the target count the email covered", async () => {
		let { db } = createTestDatabase();
		let lead = await seedDueLead(db);
		await seedWatch(db, lead.id, "https://one.example.com", { last_status: "up" });
		await seedWatch(db, lead.id, "https://two.example.com", { last_status: "up" });

		let job = await runJob(db);

		expect(funnelEvents(job)).toHaveLength(1);
		expect(funnelEvents(job)[0]).toMatchObject({
			leadId: lead.id,
			period: "daily",
			targets: 2,
			hadIncident: false,
		});
	});

	test("flags a window in which any target was unhealthy", async () => {
		let { db } = createTestDatabase();
		let lead = await seedDueLead(db);
		await seedWatch(db, lead.id, "https://one.example.com", { last_status: "up" });
		await seedWatch(db, lead.id, "https://two.example.com", { last_status: "down" });

		let job = await runJob(db);

		expect(funnelEvents(job)[0]).toMatchObject({ targets: 2, hadIncident: true });
	});

	test("names no address and no URL, only the lead's opaque id", async () => {
		let { db } = createTestDatabase();
		let lead = await seedDueLead(db, "reader@example.com");
		await seedWatch(db, lead.id, "https://private.example.com/admin", { last_status: "up" });

		let job = await runJob(db);

		let [event] = funnelEvents(job);
		expect(event).toBeDefined();
		for (let value of Object.values(event ?? {})) {
			if (typeof value !== "string") continue;
			expect(value).not.toContain("reader@example.com");
			expect(value).not.toContain("private.example.com");
		}
	});

	test("emits nothing for a lead with nothing to report", async () => {
		let { db } = createTestDatabase();
		await seedDueLead(db);

		let job = await runJob(db);

		expect(funnelEvents(job)).toBeEmpty();
	});

	test("emits nothing when the transport refuses the digest", async () => {
		let { db } = createTestDatabase();
		let lead = await seedDueLead(db);
		await seedWatch(db, lead.id, "https://example.com", { last_status: "up" });

		let container = new ServiceContainer();
		container.singleton(Database, () => db);
		container.singleton(
			Mailer,
			() => new Mailer({ transport: new RefusingTransport(), from: MAIL_FROM }),
		);
		let job = new SendTrialDigestsJob({ logger: new BatchedLogger("test") }, {});
		await container.scope(() => job.perform());

		expect(funnelEvents(job)).toBeEmpty();
	});
});
