/**
 * Unit tests for the `checkTrialWatches` job: which watches a run claims, the
 * result recorded, the on-change email and its per-day cap, and the seven-day wrap-up.
 * Nothing here is billed or reported: a trial check reaches no billing platform and no
 * dataset, which the suites below assert directly. `HttpCheck` is faked with a lightweight
 * stand-in, since the real check runs through a Durable Object the test runner lacks.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AnalyticsEngineMock } from "@pkg/cloudflare-mocks";

import { createAnalyticsEngine, createEnv } from "@pkg/cloudflare-mocks";
import { createJobContext } from "@pkg/jobs";
import { BatchedLogger } from "@pkg/logger";
import { Mailer } from "@pkg/mail";
import { MemoryTransport } from "@pkg/mail/memory";
import { ServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { HttpCheckOptions, HttpCheckResult } from "~/app/services/http-check";
import type { MonitorStatus, SelectLead, SelectTrialWatch } from "~/database/schema";

import Lead from "~/app/data/lead";
import TrialWatch from "~/app/data/trial-watch";
import { MAIL_FROM } from "~/app/emails/sender";
import { TrialChangeEmail } from "~/app/emails/trial-change";
import { TrialWeeklyDigestEmail } from "~/app/emails/trial-weekly-digest";
import { createTestDatabase } from "~/app/lib/test/db";
import { trialWatches } from "~/database/schema";
import routes from "~/routes/web";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** The options every fake probe was constructed with, in the order the sweep built them. */
let probes: HttpCheckOptions[] = [];

let runMock = vi.fn(async (_options: HttpCheckOptions): Promise<HttpCheckResult> => ({
	outcome: {
		responseStatus: 200,
		responseTimeMs: 120,
		doWallTimeMs: 5,
		location: null,
		body: "",
		failed: false,
	},
	contentChecksPassed: true,
	status: "up",
}));

/**
 * The two datasets anything in the sweep's path could write to, kept apart so a point
 * landing on either one is attributable. Both live at module scope because the module under
 * test captures `env` on import, so `beforeEach` empties them rather than re-creating them.
 */
let pingResults: AnalyticsEngineMock = createAnalyticsEngine();
let costs: AnalyticsEngineMock = createAnalyticsEngine();

vi.doMock("cloudflare:workers", () => ({
	env: createEnv<Env>({ PING_RESULTS: pingResults, COSTS: costs }),
}));

vi.doMock("~/app/services/http-check", () => ({
	HttpCheck: class {
		#options: HttpCheckOptions;

		constructor(options: HttpCheckOptions) {
			this.#options = options;
			probes.push(options);
		}

		async run(): Promise<HttpCheckResult> {
			return await runMock(this.#options);
		}
	},
}));

let jobs = (await import("~/app/jobs")).default;
let { Database: JobDatabase } = await import("~/app/jobs/middleware/database");
let checkTrialWatches = (await import("./check-trial-watches")).default;

let transport = new MemoryTransport();

/** Runs the handler over a context carrying the test's database, as the chain would. */
async function runJob(db: Database) {
	let container = new ServiceContainer();
	container.singleton(Mailer, () => new Mailer({ transport, from: MAIL_FROM }));

	let ctx = createJobContext(jobs.checkTrialWatches, {
		id: "message-1",
		attempts: 1,
		logger: new BatchedLogger("test"),
	});
	ctx.set(JobDatabase, db, { property: "database" });

	await container.scope(() => checkTrialWatches(ctx));
	return ctx;
}

async function seedLead(db: Database, email = "visitor@example.com"): Promise<SelectLead> {
	return await Lead.upsertByEmail(db, {
		email,
		locale: "en",
		consented: false,
	});
}

/**
 * Seeds a watch and forces it due, since `TrialWatch.create` schedules the first check an
 * interval out — the trial page has already shown the visitor that first result.
 */
async function seedWatch(
	db: Database,
	leadId: string,
	overrides: Partial<SelectTrialWatch> = {},
	url = "https://example.com",
): Promise<SelectTrialWatch> {
	let created = await TrialWatch.create(db, leadId, { url });
	if (!created) throw new Error("Failed to seed trial watch");

	await db.update(
		trialWatches,
		created.id,
		{ next_due_at: Date.now() - 1000, ...overrides },
		{ touch: false },
	);

	let row = await TrialWatch.findById(db, created.id);
	if (!row) throw new Error("Seeded trial watch disappeared");
	return row;
}

/** Puts a watch back in the claim's range, standing in for the next hour arriving. */
async function makeDue(db: Database, watchId: string) {
	await db.update(trialWatches, watchId, { next_due_at: Date.now() - 1000 }, { touch: false });
}

/** Makes the fake probe answer with one status for every call. */
function answering(status: MonitorStatus, responseTimeMs: number | null = 120) {
	runMock.mockImplementation(async () => ({
		outcome: {
			responseStatus: status === "down" ? null : 200,
			responseTimeMs,
			doWallTimeMs: 5,
			location: null,
			body: "",
			failed: status === "down",
		},
		contentChecksPassed: true,
		status,
	}));
}

/** Every email of one kind the sweep handed the transport. */
function sentOf(kind: unknown): number {
	return transport.messages.filter(
		(message) => message.email instanceof (kind as new (...args: never[]) => object),
	).length;
}

beforeEach(() => {
	probes = [];
	transport.clear();
	pingResults.reset();
	costs.reset();
	runMock.mockReset();
	answering("up");
});

describe("checkTrialWatches", () => {
	test("probes a due watch, records the result, and folds it into the running totals", async () => {
		let { db } = createTestDatabase();
		let lead = await seedLead(db);
		let watch = await seedWatch(db, lead.id);
		answering("up", 250);

		let job = await runJob(db);

		expect(probes).toHaveLength(1);
		expect(probes[0]?.url).toBe("https://example.com");
		/**
		 * The load-bearing one. The guard judged this target by the addresses its hostname
		 * resolves to, and following a redirect would reach an address it never judged.
		 */
		expect(probes[0]?.followRedirects).toBe(false);
		expect(probes[0]?.contentChecks).toEqual([]);

		let results = await TrialWatch.listResults(db, watch.id);
		expect(results).toHaveLength(1);
		expect(results[0]?.status).toBe("up");
		expect(results[0]?.response_time_ms).toBe(250);

		let updated = await TrialWatch.findById(db, watch.id);
		expect(updated?.last_status).toBe("up");
		expect(updated?.checks_run).toBe(1);
		expect(updated?.checks_ok).toBe(1);
		expect(updated?.max_response_time_ms).toBe(250);

		let completed = job.logger.events.find(
			(event) => event.event === "job.check_trial_watches.completed",
		);
		expect(completed?.total).toBe(1);
		expect(completed?.probed).toBe(1);
		expect(completed?.errorCount).toBe(0);
	});

	test("skips a watch whose next hour has not come round yet", async () => {
		let { db } = createTestDatabase();
		let lead = await seedLead(db);
		await seedWatch(db, lead.id, { next_due_at: Date.now() + 30 * 60_000 });

		await runJob(db);

		expect(probes).toHaveLength(0);
	});

	test("checks a watch once however many times the hour's trigger is delivered", async () => {
		let { db } = createTestDatabase();
		let lead = await seedLead(db);
		await seedWatch(db, lead.id);

		await runJob(db);
		await runJob(db);

		expect(probes).toHaveLength(1);
	});

	test("counts a failed probe and keeps checking the rest of the sweep", async () => {
		let { db } = createTestDatabase();
		let lead = await seedLead(db);
		let failing = await seedWatch(db, lead.id, {}, "https://fails.example.com");
		let healthy = await seedWatch(db, lead.id, {}, "https://ok.example.com");

		runMock.mockImplementation(async (options) => {
			if (options.url === failing.url) throw new Error("Durable Object unavailable");
			return {
				outcome: {
					responseStatus: 200,
					responseTimeMs: 10,
					doWallTimeMs: 1,
					location: null,
					body: "",
					failed: false,
				},
				contentChecksPassed: true,
				status: "up",
			};
		});

		let job = await runJob(db);

		expect(await TrialWatch.listResults(db, failing.id)).toHaveLength(0);
		expect(await TrialWatch.listResults(db, healthy.id)).toHaveLength(1);

		let completed = job.logger.events.find(
			(event) => event.event === "job.check_trial_watches.completed",
		);
		expect(completed?.probed).toBe(1);
		expect(completed?.errorCount).toBe(1);
	});
});

describe("checkTrialWatches change notifications", () => {
	test("emails the lead when the status disagrees with the last one", async () => {
		let { db } = createTestDatabase();
		let lead = await seedLead(db);
		let watch = await seedWatch(db, lead.id, { last_status: "up" });
		answering("down", null);

		let job = await runJob(db);

		expect(sentOf(TrialChangeEmail)).toBe(1);
		expect(transport.last?.to).toEqual([{ email: "visitor@example.com" }]);

		let updated = await TrialWatch.findById(db, watch.id);
		expect(updated?.change_notified_at).not.toBeNull();

		let completed = job.logger.events.find(
			(event) => event.event === "job.check_trial_watches.completed",
		);
		expect(completed?.changed).toBe(1);
	});

	test("sends nothing on a watch's first ever check", async () => {
		let { db } = createTestDatabase();
		let lead = await seedLead(db);
		await seedWatch(db, lead.id, { last_status: null });
		answering("down", null);

		await runJob(db);

		expect(transport.messages).toHaveLength(0);
	});

	test("sends nothing when the status has not moved", async () => {
		let { db } = createTestDatabase();
		let lead = await seedLead(db);
		await seedWatch(db, lead.id, { last_status: "up" });

		await runJob(db);

		expect(transport.messages).toHaveLength(0);
	});

	test("caps a flapping target at one change email per UTC day", async () => {
		let { db } = createTestDatabase();
		let lead = await seedLead(db);
		let watch = await seedWatch(db, lead.id, { last_status: "up" });

		answering("down", null);
		await runJob(db);

		/**
		 * The hours alternate up/down, so each still disagrees with the last and would notify
		 * on its own; the cap is what stops all but the first. Suppressed flaps still land in
		 * the history the digest bar draws from, which the five-row count below confirms.
		 */
		for (let hour = 0; hour < 4; hour++) {
			answering(hour % 2 === 0 ? "up" : "down", hour % 2 === 0 ? 120 : null);
			await makeDue(db, watch.id);
			await runJob(db);
		}

		expect(sentOf(TrialChangeEmail)).toBe(1);
		expect(await TrialWatch.listResults(db, watch.id)).toHaveLength(5);
	});

	test("lets the next day's change through once the bound has moved", async () => {
		let { db } = createTestDatabase();
		let lead = await seedLead(db);
		await seedWatch(db, lead.id, {
			last_status: "up",
			change_notified_at: Date.now() - 2 * MS_PER_DAY,
		});
		answering("down", null);

		await runJob(db);

		expect(sentOf(TrialChangeEmail)).toBe(1);
	});
});

describe("checkTrialWatches wrap-up", () => {
	test("wraps up an expired watch without probing it, and stops claiming it", async () => {
		let { db } = createTestDatabase();
		let lead = await seedLead(db);
		let watch = await seedWatch(db, lead.id, {
			created_at: Date.now() - 8 * MS_PER_DAY,
			expires_at: Date.now() - MS_PER_DAY,
			last_status: "up",
			checks_run: 168,
			checks_ok: 167,
			max_response_time_ms: 2100,
		});

		let job = await runJob(db);

		expect(probes).toHaveLength(0);
		expect(sentOf(TrialWeeklyDigestEmail)).toBe(1);

		let updated = await TrialWatch.findById(db, watch.id);
		expect(updated?.summary_sent_at).not.toBeNull();
		expect(updated?.next_due_at).toBeNull();

		let completed = job.logger.events.find(
			(event) => event.event === "job.check_trial_watches.completed",
		);
		expect(completed?.wrappedUp).toBe(1);
		expect(completed?.probed).toBe(0);
	});

	/**
	 * The wrap-up's report link needs the watch's real token; this checks the token appears
	 * correctly in the rendered HTML, which is what proves the recipient gets a working link.
	 */
	test("carries the watch's own report token, so the wrap-up can link the report page", async () => {
		let { db } = createTestDatabase();
		let lead = await seedLead(db);
		let watch = await seedWatch(db, lead.id, {
			created_at: Date.now() - 8 * MS_PER_DAY,
			expires_at: Date.now() - MS_PER_DAY,
			last_status: "up",
			checks_run: 168,
			checks_ok: 168,
		});

		await runJob(db);

		expect(transport.last?.email).toBeInstanceOf(TrialWeeklyDigestEmail);

		expect(watch.report_token).toBeTruthy();
		expect(transport.last?.html).toContain(routes.trial.report.href({ token: watch.report_token }));
	});

	test("never claims a watch again once its wrap-up has gone out", async () => {
		let { db } = createTestDatabase();
		let lead = await seedLead(db);
		await seedWatch(db, lead.id, {
			created_at: Date.now() - 8 * MS_PER_DAY,
			expires_at: Date.now() - MS_PER_DAY,
			last_status: "up",
		});

		await runJob(db);
		await runJob(db);

		expect(sentOf(TrialWeeklyDigestEmail)).toBe(1);
		expect(probes).toHaveLength(0);
	});

	test("ends an expired watch that has already been wrapped up without emailing again", async () => {
		let { db } = createTestDatabase();
		let lead = await seedLead(db);
		let watch = await seedWatch(db, lead.id, {
			expires_at: Date.now() - MS_PER_DAY,
			summary_sent_at: Date.now() - MS_PER_DAY,
		});

		await runJob(db);

		expect(transport.messages).toHaveLength(0);
		expect((await TrialWatch.findById(db, watch.id))?.next_due_at).toBeNull();
	});

	test("ends an expired watch whose lead is gone rather than retrying it forever", async () => {
		let { db } = createTestDatabase();
		let lead = await seedLead(db);
		let watch = await seedWatch(db, lead.id, { expires_at: Date.now() - MS_PER_DAY });
		await db.exec("DELETE FROM leads WHERE id = ?", [lead.id]);

		let job = await runJob(db);

		expect(transport.messages).toHaveLength(0);
		expect((await TrialWatch.findById(db, watch.id))?.next_due_at).toBeNull();
		expect(
			job.logger.events.find((event) => event.event === "job.check_trial_watches.lead_missing"),
		).toBeDefined();
	});
});

describe("checkTrialWatches metering", () => {
	/** A watch belongs to no team, so no ping point exists for a query to ever select. */
	test("writes no Analytics Engine point for a trial check", async () => {
		let { db } = createTestDatabase();
		let lead = await seedLead(db);
		await seedWatch(db, lead.id);

		await runJob(db);

		expect(pingResults.dataPoints).toHaveLength(0);
		expect(costs.dataPoints).toHaveLength(0);
	});

	test("records a result without reaching a billing platform at all", async () => {
		let { db } = createTestDatabase();
		let lead = await seedLead(db);
		let watch = await seedWatch(db, lead.id);

		await runJob(db);

		expect(await TrialWatch.listResults(db, watch.id)).toHaveLength(1);
	});
});

/**
 * The two funnel events the sweep emits. Both are "first" events, so what is pinned is
 * the boundary in each: only the first check and first alert count as a new step, and
 * neither event may name the URL it is about.
 */
describe("checkTrialWatches funnel events", () => {
	/** Every `funnel.*` line of one kind a run emitted. */
	function funnelEvents(job: { logger: BatchedLogger }, name: string) {
		return job.logger.events.filter((event) => event.event === `funnel.${name}`);
	}

	test("reports the first unattended check with its host and outcome", async () => {
		let { db } = createTestDatabase();
		let lead = await seedLead(db);
		let watch = await seedWatch(db, lead.id, {}, "https://example.com/health?token=secret");
		answering("up");

		let job = await runJob(db);

		let events = funnelEvents(job, "first_trial_check_completed");
		expect(events).toHaveLength(1);
		expect(events[0]).toMatchObject({
			leadId: lead.id,
			watchId: watch.id,
			hostname: "example.com",
			monitorType: "http",
			status: "up",
			succeeded: true,
		});
	});

	test("names the host and never the URL, the path or the query string", async () => {
		let { db } = createTestDatabase();
		let lead = await seedLead(db);
		await seedWatch(db, lead.id, {}, "https://example.com/health?token=secret");

		let job = await runJob(db);

		let [event] = funnelEvents(job, "first_trial_check_completed");
		for (let value of Object.values(event ?? {})) {
			if (typeof value !== "string") continue;
			expect(value).not.toContain("token=secret");
			expect(value).not.toContain("/health");
		}
	});

	test("reports a failed first check as one, rather than not reporting it", async () => {
		let { db } = createTestDatabase();
		let lead = await seedLead(db);
		await seedWatch(db, lead.id);
		answering("down", null);

		let job = await runJob(db);

		expect(funnelEvents(job, "first_trial_check_completed")[0]).toMatchObject({
			status: "down",
			succeeded: false,
		});
	});

	test("the second hour's check is not a first check", async () => {
		let { db } = createTestDatabase();
		let lead = await seedLead(db);
		let watch = await seedWatch(db, lead.id);

		await runJob(db);
		await makeDue(db, watch.id);
		let second = await runJob(db);

		expect(funnelEvents(second, "first_trial_check_completed")).toHaveLength(0);
	});

	test("reports the first on-change email with both statuses", async () => {
		let { db } = createTestDatabase();
		let lead = await seedLead(db);
		let watch = await seedWatch(db, lead.id, { last_status: "up" });
		answering("down", null);

		let job = await runJob(db);

		let events = funnelEvents(job, "first_trial_alert_sent");
		expect(events).toHaveLength(1);
		expect(events[0]).toMatchObject({
			leadId: lead.id,
			watchId: watch.id,
			hostname: "example.com",
			monitorType: "http",
			status: "down",
			previousStatus: "up",
		});
	});

	test("a later change on the same watch is not a first alert", async () => {
		let { db } = createTestDatabase();
		let lead = await seedLead(db);
		let watch = await seedWatch(db, lead.id, { last_status: "up" });
		answering("down", null);

		let first = await runJob(db);
		expect(funnelEvents(first, "first_trial_alert_sent")).toHaveLength(1);

		/**
		 * The change email is capped at one a day, so the stamp has to be backdated for a
		 * second one to go out at all — the case this asserts should count as a repeat alert.
		 */
		await db.update(
			trialWatches,
			watch.id,
			{ change_notified_at: Date.now() - 2 * MS_PER_DAY, next_due_at: Date.now() - 1000 },
			{ touch: false },
		);
		answering("up");

		let second = await runJob(db);
		expect(sentOf(TrialChangeEmail)).toBe(2);
		expect(funnelEvents(second, "first_trial_alert_sent")).toHaveLength(0);
	});

	test("emits no alert event when the send was refused", async () => {
		let { db } = createTestDatabase();
		let lead = await seedLead(db);
		await seedWatch(db, lead.id, { last_status: "up" });
		await db.exec("DELETE FROM leads WHERE id = ?", [lead.id]);
		answering("down", null);

		let job = await runJob(db);

		expect(funnelEvents(job, "first_trial_alert_sent")).toHaveLength(0);
	});
});
