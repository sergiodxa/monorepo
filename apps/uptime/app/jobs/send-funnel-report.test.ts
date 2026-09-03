/**
 * Unit tests for the `sendFunnelReport` job: what it counts, when it stays quiet, and
 * the one thing it must do on every single run whether it sends or not.
 *
 * The two silences are the cases most likely to regress into noise: an unconfigured
 * deployment — local dev, preview, this suite — has no configured recipient, and a
 * quiet day at the trial page produces no email. Both still write the day's row, since
 * that row is the only version of the day the thirty-day sweep leaves behind.
 *
 * The recipient is read structurally off `env`, with `cloudflare:workers` mocked and the
 * subject imported dynamically, since the default preload's `test-<KEY>` strings look configured.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createEnv } from "@sdxc/cloudflare-mocks";
import { BatchedLogger } from "@sdxc/logger";
import { Mailer } from "@sdxc/mail";
import { MemoryTransport } from "@sdxc/mail/memory";
import { ServiceContainer } from "@sdxc/service-container";
import { Database } from "remix/data-table";
import { beforeEach, describe, expect, test, vi } from "vitest";

import Lead from "~/app/data/lead";
import TrialConversion from "~/app/data/trial-conversion";
import TrialDailyStats from "~/app/data/trial-daily-stats";
import TrialWatch from "~/app/data/trial-watch";
import { FunnelReportEmail } from "~/app/emails/funnel-report";
import { MAIL_FROM } from "~/app/emails/sender";
import { createTestDatabase } from "~/app/lib/test/db";
import { leads, trialWatches } from "~/database/schema";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * The app's bindings plus the recipient, read structurally off `env` so a deployment
 * that never declared it is a supported, quiet state.
 */
interface FunnelEnv extends Env {
	FUNNEL_REPORT_TO?: string;
}

/**
 * The bindings the job runs against, held at module scope so tests mutate the recipient
 * on it directly. Every other binding stays unsupplied, so an unexpected read fails by
 * name instead of quietly answering with a `test-<KEY>` string that looks configured.
 */
let env: FunnelEnv = createEnv<FunnelEnv>({ FUNNEL_REPORT_TO: "ops@example.com" });

vi.doMock("cloudflare:workers", () => ({
	env,
	waitUntil: (promise: Promise<unknown>) => void promise,
}));

let { createJobContext } = await import("@sdxc/jobs");
let jobs = (await import("~/app/jobs")).default;
let { Database: JobDatabase } = await import("~/app/jobs/middleware/database");
let sendFunnelReport = (await import("~/app/jobs/send-funnel-report")).default;

let db: Database;
let transport = new MemoryTransport();

beforeEach(() => {
	db = createTestDatabase().db;
	transport = new MemoryTransport();
	env.FUNNEL_REPORT_TO = "ops@example.com";
});

/** Yesterday in UTC, which is the only day the job ever reports. */
function yesterday(): string {
	return new Date(Date.now() - MS_PER_DAY).toISOString().slice(0, 10);
}

/** An instant inside yesterday's UTC day, far enough from both edges to be unambiguous. */
function duringYesterday(): number {
	return new Date(`${yesterday()}T12:00:00.000Z`).getTime();
}

async function runJob() {
	let container = new ServiceContainer();
	container.singleton(Mailer, () => new Mailer({ transport, from: MAIL_FROM }));

	let ctx = createJobContext(jobs.sendFunnelReport, {
		id: "message-1",
		attempts: 1,
		logger: new BatchedLogger("test"),
	});
	ctx.set(JobDatabase, db, { property: "database" });

	await container.scope(() => sendFunnelReport(ctx));
}

/** A lead created yesterday, with a watch under it — one submission of the free form. */
async function seedSubmission(email: string, at: number = duringYesterday()) {
	let lead = await Lead.upsertByEmail(db, { email, locale: "en", consented: false });
	await db.update(leads, lead.id, { created_at: at }, { touch: false });

	let watch = await TrialWatch.create(db, lead.id, {
		url: `https://${email.split("@")[0]}.example`,
	});
	await db.update(trialWatches, watch.id, { created_at: at }, { touch: false });

	return lead;
}

/** The one report this run produced, or `undefined` when it stayed quiet. */
function reports() {
	return transport.messages.filter((message) => message.email instanceof FunnelReportEmail);
}

describe("staying quiet", () => {
	test("sends nothing when the deployment names no recipient", async () => {
		env.FUNNEL_REPORT_TO = undefined;
		await seedSubmission("ada@example.com");

		await runJob();

		expect(reports()).toHaveLength(0);
	});

	test("still writes the day's row when there is nobody to send it to", async () => {
		env.FUNNEL_REPORT_TO = undefined;
		await seedSubmission("ada@example.com");

		await runJob();

		expect((await TrialDailyStats.findByDate(db, yesterday()))?.new_leads).toBe(1);
	});

	test("sends nothing on a day when nothing at all happened", async () => {
		await runJob();

		expect(reports()).toHaveLength(0);
	});

	test("still writes a row of zeroes for a day when nothing happened", async () => {
		await runJob();

		let row = await TrialDailyStats.findByDate(db, yesterday());
		expect(row).not.toBeNull();
		expect(row?.new_leads).toBe(0);
		expect(row?.emails_sent).toBe(0);
		expect(row?.paid_conversions).toBe(0);
	});

	test("ignores a recipient variable that is declared and left blank", async () => {
		env.FUNNEL_REPORT_TO = "";
		await seedSubmission("ada@example.com");

		await runJob();

		expect(reports()).toHaveLength(0);
	});
});

describe("what the day counts", () => {
	test("counts a submission as one lead and one URL, and its confirmation as one email", async () => {
		await seedSubmission("ada@example.com");

		await runJob();

		let row = await TrialDailyStats.findByDate(db, yesterday());
		expect(row?.new_leads).toBe(1);
		expect(row?.urls_checked).toBe(1);
		expect(row?.emails_sent).toBe(1);
	});

	test("counts the digests, change emails and wrap-ups the day's stamps record", async () => {
		let lead = await seedSubmission("ada@example.com");
		await db.update(leads, lead.id, { last_digest_at: duringYesterday() }, { touch: false });
		let [watch] = await TrialWatch.listByLead(db, lead.id);
		await db.update(
			trialWatches,
			watch?.id ?? "",
			{ change_notified_at: duringYesterday(), summary_sent_at: duringYesterday() },
			{ touch: false },
		);

		await runJob();

		expect((await TrialDailyStats.findByDate(db, yesterday()))?.emails_sent).toBe(4);
	});

	test("leaves out anything that happened on a different day", async () => {
		await seedSubmission("ada@example.com", Date.now() - 5 * MS_PER_DAY);

		await runJob();

		expect((await TrialDailyStats.findByDate(db, yesterday()))?.new_leads).toBe(0);
	});

	test("counts signups and payments separately", async () => {
		await seedSubmission("ada@example.com");
		await TrialConversion.recordSignup(db, {
			ownerId: "subject-1",
			leadCreatedAt: duringYesterday() - 4 * MS_PER_DAY,
			emailsSent: 5,
			urls: ["https://ada.example"],
			watchCount: 1,
			signedUpAt: duringYesterday(),
		});
		await TrialConversion.markPaid(db, "subject-1", duringYesterday() + 60_000);

		await runJob();

		let row = await TrialDailyStats.findByDate(db, yesterday());
		expect(row?.free_signups).toBe(1);
		expect(row?.paid_conversions).toBe(1);
	});
});

describe("the report itself", () => {
	test("goes to the configured address with the headline in the subject", async () => {
		await seedSubmission("ada@example.com");

		await runJob();

		let [message] = reports();
		expect(message?.to.at(0)?.email).toBe("ops@example.com");
		expect(message?.subject).toContain("1 lead, 0 signups, 0 paid");
	});

	/** Internal mail to ops: the unsubscribe machinery belongs to outward-facing trial email. */
	test("carries no unsubscribe headers and no unsubscribe link", async () => {
		await seedSubmission("ada@example.com");

		await runJob();

		let [message] = reports();
		expect(message?.headers["List-Unsubscribe"]).toBeUndefined();
		expect(message?.html).not.toContain("/unsubscribe/");
	});

	test("itemises a paid conversion with the days and emails it took", async () => {
		await seedSubmission("ada@example.com");
		await TrialConversion.recordSignup(db, {
			ownerId: "subject-1",
			leadCreatedAt: duringYesterday() - 6 * MS_PER_DAY,
			emailsSent: 8,
			urls: ["https://ada.example"],
			watchCount: 2,
			signedUpAt: duringYesterday() - MS_PER_DAY,
		});
		await TrialConversion.markPaid(db, "subject-1", duringYesterday());

		await runJob();

		let [message] = reports();
		expect(message?.subject).toContain("1 paid");
		expect(message?.text).toContain("Days to paying");
		expect(message?.text).toContain("https://ada.example");
	});

	test("includes the trailing totals, drawn from the days already reported", async () => {
		await TrialDailyStats.upsertDay(db, {
			date: new Date(Date.now() - 3 * MS_PER_DAY).toISOString().slice(0, 10),
			newLeads: 9,
			urlsChecked: 0,
			emailsSent: 0,
			freeSignups: 0,
			paidConversions: 0,
		});
		await seedSubmission("ada@example.com");

		await runJob();

		let [message] = reports();
		expect(message?.text).toContain("Last 30 days");
		expect(message?.text).toContain("10");
	});
});
