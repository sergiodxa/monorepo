/**
 * Unit tests for `CheckTrialWatchesJob.perform()`: which watches a run claims (only those
 * whose hour has come round, and each of them once however often the trigger is delivered),
 * the result it records, the on-change email and the per-day cap that bounds it, and the
 * seven-day wrap-up that ends a watch.
 *
 * The cases that would break silently are the point of this file: a watch past `expires_at`
 * must stop being claimed rather than be checked forever, a target that flaps every hour must
 * cost at most one email a day, and a probe that threw must not take the rest of the sweep
 * with it.
 *
 * Also covered: that nothing here is billed or reported. No Analytics Engine point is written
 * — the container is given no `PolarClient` at all, so a job that asked for one would fail
 * outright, which is the assertion that the metering path is genuinely absent.
 *
 * `HttpCheck` is faked rather than mocked at the network level, since the real one probes
 * through a Durable Object that `bun test` has no runtime for; the options it was constructed
 * with are recorded so the probe's own configuration can be asserted on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, mock, test } from "bun:test";

import { BatchedLogger } from "@pkg/logger";
import { Mailer } from "@pkg/mail";
import { MemoryTransport } from "@pkg/mail/memory";
import { ServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";

import type { HttpCheckOptions, HttpCheckResult } from "~/app/services/http-check";
import type { MonitorStatus, SelectLead, SelectTrialWatch } from "~/database/schema";

import Lead from "~/app/data/lead";
import TrialWatch from "~/app/data/trial-watch";
import { MAIL_FROM } from "~/app/emails/sender";
import { TrialChangeEmail } from "~/app/emails/trial-change";
import { TrialWeeklyDigestEmail } from "~/app/emails/trial-weekly-digest";
import { createTestDatabase } from "~/app/lib/test/db";
import { trialWatches } from "~/database/schema";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** The options every fake probe was constructed with, in the order the sweep built them. */
let probes: HttpCheckOptions[] = [];

let runMock = mock(
	async (_options: HttpCheckOptions): Promise<HttpCheckResult> => ({
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
	}),
);

/** Records the data points anything in the sweep's path would write to Analytics Engine. */
let writeDataPointMock = mock((_point: unknown) => {});

mock.module("cloudflare:workers", () => ({
	env: {
		PING_RESULTS: { writeDataPoint: writeDataPointMock },
		COSTS: { writeDataPoint: writeDataPointMock },
	},
}));

mock.module("~/app/services/http-check", () => ({
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

let { CheckTrialWatchesJob } = await import("./check-trial-watches");

let transport = new MemoryTransport();

async function runJob(db: Database) {
	let container = new ServiceContainer();
	container.singleton(Database, () => db);
	container.singleton(Mailer, () => new Mailer({ transport, from: MAIL_FROM }));

	let job = new CheckTrialWatchesJob({ logger: new BatchedLogger("test") }, {});
	await container.scope(() => job.perform());
	return job;
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
	writeDataPointMock.mockClear();
	runMock.mockReset();
	answering("up");
});

describe("CheckTrialWatchesJob", () => {
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

describe("CheckTrialWatchesJob change notifications", () => {
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

		// Every following hour disagrees with the one before it, and none of them may write.
		for (let hour = 0; hour < 4; hour++) {
			answering(hour % 2 === 0 ? "up" : "down", hour % 2 === 0 ? 120 : null);
			await makeDue(db, watch.id);
			await runJob(db);
		}

		expect(sentOf(TrialChangeEmail)).toBe(1);
		// Every flap the cap suppressed is still in the history the digest bar is drawn from.
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

describe("CheckTrialWatchesJob wrap-up", () => {
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

describe("CheckTrialWatchesJob metering", () => {
	test("writes no Analytics Engine point for a trial check", async () => {
		let { db } = createTestDatabase();
		let lead = await seedLead(db);
		await seedWatch(db, lead.id);

		await runJob(db);

		// A watch belongs to no team, and every query against the ping dataset filters on one.
		expect(writeDataPointMock).not.toHaveBeenCalled();
	});

	test("runs without a Polar client in the container, so nothing can be billed", async () => {
		let { db } = createTestDatabase();
		let lead = await seedLead(db);
		let watch = await seedWatch(db, lead.id);

		await runJob(db);

		expect(await TrialWatch.listResults(db, watch.id)).toHaveLength(1);
	});
});
