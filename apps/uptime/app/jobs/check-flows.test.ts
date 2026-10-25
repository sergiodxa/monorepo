/**
 * Unit tests for the `checkFlows` job: what a run records, what it bills, and which
 * transitions it hands to the `notify` queue.
 *
 * An `error` result is this app failing to find out rather than the customer's flow
 * breaking, so the sweep records and bills it while telling nobody.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AnalyticsEngineMock, QueueMock } from "@sdxc/cloudflare-mocks";

import { createAnalyticsEngine, createEnv, createQueue } from "@sdxc/cloudflare-mocks";
import { createJobContext } from "@sdxc/jobs";
import { Log } from "@sdxc/logger";
import { unwrap } from "@sdxc/result";
import { Database } from "remix/data-table";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { FlowCheckResult } from "~/app/services/flow-check";
import type { NotifyMessage } from "~/app/services/notify-queue";
import type { InsertFlowMonitor } from "~/database/schema";

import { createTestBilling } from "~/app/test/billing";
import { createTestDatabase } from "~/app/test/db";
import { installFlags } from "~/app/test/flags";
import { teams } from "~/database/schema";

/** A run whose every test passed, which is the neutral result each case narrows from. */
function passing(overrides: Partial<FlowCheckResult> = {}): FlowCheckResult {
	return {
		status: "up",
		testsTotal: 4,
		testsPassed: 4,
		testsFailed: 0,
		requestsMade: 3,
		usedBrowser: false,
		failedTest: null,
		failedAtLine: null,
		failureDetail: null,
		durationMs: 1200,
		errorMessage: null,
		traceJson: null,
		...overrides,
	};
}

/** A run one assertion broke, carrying the artifact the alert quotes. */
function failing(overrides: Partial<FlowCheckResult> = {}): FlowCheckResult {
	return passing({
		status: "down",
		testsPassed: 2,
		testsFailed: 1,
		failedTest: "checkout accepts the coupon",
		failedAtLine: 27,
		failureDetail: "expected status 200, got 500",
		...overrides,
	});
}

let runFlowCheckMock = vi.fn(async (): Promise<FlowCheckResult> => passing());

/** One `notify` message as it travels: the job it names, and the transition under `body`. */
interface NotifyEnvelope {
	job: "notify";
	body: NotifyMessage;
}

/**
 * The queue the sweep notifies through and the dataset it reports runs to. Both live at
 * module scope because the module under test captures `env` on import, so `beforeEach`
 * clears them between tests, reusing the instances the import captured.
 */
let queue: QueueMock<NotifyEnvelope> = createQueue<NotifyEnvelope>({ name: "notify" });
let pingResults: AnalyticsEngineMock = createAnalyticsEngine();

vi.doMock("cloudflare:workers", () => ({
	env: createEnv<Env>({ QUEUE: queue, PING_RESULTS: pingResults }),
}));

/**
 * The platform the sweep bills against, with the one call `ingestPings` makes spied on. The
 * job has no request behind it, so it reads the configured platform from this module.
 */
let billing = createTestBilling();
let realIngest = billing.usage.ingest.bind(billing.usage);
let ingestMock = vi.spyOn(billing.usage, "ingest");

let realBillingModule = await import("~/app/initializers/billing");

vi.doMock("~/app/initializers/billing", () => ({ ...realBillingModule, polar: billing }));

let realFlowCheckModule = await import("~/app/services/flow-check");

vi.doMock("~/app/services/flow-check", () => ({
	...realFlowCheckModule,
	runFlowCheck: runFlowCheckMock,
}));

let jobs = (await import("~/app/jobs")).default;
let { Database: JobDatabase } = await import("@sdxc/database-middleware");
let { bindModels, publishModels } = await import("~/app/test/models");
let checkFlows = (await import("./check-flows")).default;

/** Every message the sweep put on the queue, in order, each wrapping one transition. */
function enqueued(): NotifyEnvelope[] {
	return queue.sent.map((message) => message.body);
}

/** Runs the handler over a context carrying the test's database, and returns its record. */
async function runJob(db: Database) {
	let record: Record<string, unknown> = {};
	let log = new Log({ kind: "job", sink: (emitted) => void (record = emitted) });
	let ctx = createJobContext(jobs.checkFlows, { id: "message-1", attempts: 1, log });
	ctx.set(JobDatabase, db, { property: "db" });
	publishModels(ctx, db);
	await installFlags(ctx);

	await checkFlows(ctx);
	log.emit();
	return record;
}

async function seedMonitor(db: Database, overrides: Partial<InsertFlowMonitor> = {}) {
	let models = bindModels(db);
	return unwrap(
		await models.flowMonitors.create({
			team_id: "team-1",
			name: "Checkout",
			source: 'test "checkout" { }',
			is_enabled: true,
			...overrides,
		}),
	);
}

beforeEach(() => {
	runFlowCheckMock.mockReset();
	runFlowCheckMock.mockImplementation(async () => passing());
	queue.reset();
	pingResults.reset();
	ingestMock.mockClear();
	ingestMock.mockImplementation(realIngest);
});

describe("checkFlows", () => {
	test("enqueues a notification for a failed assertion and counts it as notified", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db, { last_status: "up" });
		runFlowCheckMock.mockImplementation(async () => failing());

		let record = await runJob(db);

		expect(enqueued()).toEqual([
			{
				job: "notify",
				body: {
					monitorType: "flow",
					monitorId: monitor.id,
					previousStatus: "up",
					newStatus: "down",
				},
			},
		]);

		expect(record).toMatchObject({ "checks.succeeded": 1, "checks.notified": 1 });
	});

	test("enqueues a recovery when a broken flow starts passing again", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db, { last_status: "down" });

		await runJob(db);

		expect(enqueued()).toEqual([
			{
				job: "notify",
				body: {
					monitorType: "flow",
					monitorId: monitor.id,
					previousStatus: "down",
					newStatus: "up",
				},
			},
		]);
	});

	test("tells nobody about a run that could not find out, and still records it", async () => {
		let { db } = createTestDatabase();
		let models = bindModels(db);
		let monitor = await seedMonitor(db, { last_status: "up" });
		runFlowCheckMock.mockImplementation(async () =>
			passing({
				status: "error",
				testsTotal: 0,
				testsPassed: 0,
				requestsMade: 0,
				durationMs: null,
				errorMessage: "example.com is not one of this team's verified domains",
			}),
		);

		let record = await runJob(db);

		expect(enqueued()).toEqual([]);

		let [result] = await models.flowMonitorResults.recent(monitor.id);
		expect(result?.status).toBe("error");

		expect(record).toMatchObject({ "checks.succeeded": 1, "checks.notified": 0 });
	});

	test("stays silent on a flow that keeps passing", async () => {
		let { db } = createTestDatabase();
		await seedMonitor(db, { last_status: "up" });

		await runJob(db);

		expect(enqueued()).toEqual([]);
	});

	/** A monitor checked for the first time has nothing to have recovered from. */
	test("stays silent on a first-ever passing run", async () => {
		let { db } = createTestDatabase();
		await seedMonitor(db);

		await runJob(db);

		expect(enqueued()).toEqual([]);
	});

	test("bills one flow-run event for a browser run, not one ping per tool call", async () => {
		let { db } = createTestDatabase();
		await db.create(
			teams,
			{ id: "team-1", owner_id: "owner-1", name: "Acme", slug: "acme", logo: null },
			{ touch: true },
		);
		let monitor = await seedMonitor(db, {
			source: 'use browser\ntest "x" { when { browser.open "https://a.test/" } }',
		});
		runFlowCheckMock.mockImplementation(async () =>
			passing({ usedBrowser: true, requestsMade: 4, durationMs: 15_000 }),
		);

		await runJob(db);

		expect(ingestMock).toHaveBeenCalled();
		let events = ingestMock.mock.calls.flatMap((call) => call[0] ?? []);
		expect(events).toEqual([
			expect.objectContaining({
				name: "flow_run",
				externalId: expect.stringMatching(/^flow_run:/),
				customer: { externalId: "owner-1" },
				metadata: expect.objectContaining({
					teamId: "team-1",
					monitorId: monitor.id,
					durationSeconds: 15,
				}),
			}),
		]);
		expect(events.every((event) => event.name !== "ping")).toBe(true);
	});

	test("alerts every time an assertion is still failing, leaving cooldown to space the repeats", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db, { last_status: "down" });
		runFlowCheckMock.mockImplementation(async () => failing());

		await runJob(db);

		expect(enqueued()).toEqual([
			{
				job: "notify",
				body: {
					monitorType: "flow",
					monitorId: monitor.id,
					previousStatus: "down",
					newStatus: "down",
				},
			},
		]);
	});
});
