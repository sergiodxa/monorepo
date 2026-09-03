/**
 * Unit tests for the `checkFlows` job: what a run records, what it bills, and which
 * transitions it hands to the `notify` queue.
 *
 * An `error` result is this app failing to find out rather than the customer's flow
 * breaking, so the sweep records and bills it while telling nobody (ADR-027 §1).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AnalyticsEngineMock, QueueMock } from "@sdxc/cloudflare-mocks";

import { createAnalyticsEngine, createEnv, createQueue } from "@sdxc/cloudflare-mocks";
import { createJobContext } from "@sdxc/jobs";
import { BatchedLogger } from "@sdxc/logger";
import { ServiceContainer } from "@sdxc/service-container";
import { Database } from "remix/data-table";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { NotifyMessage } from "~/app/lib/notify-queue";
import type { FlowCheckResult } from "~/app/services/flow-check";
import type { InsertFlowMonitor } from "~/database/schema";

import FlowMonitor from "~/app/data/flow-monitor";
import { createTestBilling } from "~/app/lib/test/billing";
import { createTestDatabase } from "~/app/lib/test/db";

/** A run whose every test passed, which is the neutral result each case narrows from. */
function passing(overrides: Partial<FlowCheckResult> = {}): FlowCheckResult {
	return {
		status: "up",
		testsTotal: 4,
		testsPassed: 4,
		testsFailed: 0,
		requestsMade: 3,
		failedTest: null,
		failedAtLine: null,
		failureDetail: null,
		durationMs: 1200,
		errorMessage: null,
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

/**
 * The queue the sweep notifies through and the dataset it reports runs to. Both live at
 * module scope because the module under test captures `env` on import, so `beforeEach`
 * clears them between tests, reusing the instances the import captured.
 */
let queue: QueueMock<NotifyMessage> = createQueue<NotifyMessage>({ name: "notify" });
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

let realBillingModule = await import("~/app/lib/billing");

vi.doMock("~/app/lib/billing", () => ({ ...realBillingModule, polar: billing }));

let realFlowCheckModule = await import("~/app/services/flow-check");

vi.doMock("~/app/services/flow-check", () => ({
	...realFlowCheckModule,
	runFlowCheck: runFlowCheckMock,
}));

let jobs = (await import("~/app/jobs")).default;
let { Database: JobDatabase } = await import("~/app/jobs/middleware/database");
let checkFlows = (await import("./check-flows")).default;

/** Every `notify` message body the sweep put on the queue, in order. */
function enqueued(): NotifyMessage[] {
	return queue.sent.map((message) => message.body);
}

/** Runs the handler over a context carrying the test's database, as the chain would. */
async function runJob(db: Database) {
	let container = new ServiceContainer();

	let ctx = createJobContext(jobs.checkFlows, {
		id: "message-1",
		attempts: 1,
		logger: new BatchedLogger("test"),
	});
	ctx.set(JobDatabase, db, { property: "database" });

	await container.scope(() => checkFlows(ctx));
	return ctx;
}

async function seedMonitor(db: Database, overrides: Partial<InsertFlowMonitor> = {}) {
	return await FlowMonitor.create(db, "team-1", {
		name: "Checkout",
		source: 'test "checkout" { }',
		is_enabled: true,
		...overrides,
	});
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

		let job = await runJob(db);

		expect(enqueued()).toEqual([
			{
				type: "notify",
				monitorType: "flow",
				monitorId: monitor.id,
				previousStatus: "up",
				newStatus: "down",
			},
		]);

		let completed = job.logger.events.find((event) => event.event === "job.check_flows.completed");
		expect(completed?.successCount).toBe(1);
		expect(completed?.notified).toBe(1);
	});

	test("enqueues a recovery when a broken flow starts passing again", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db, { last_status: "down" });

		await runJob(db);

		expect(enqueued()).toEqual([
			{
				type: "notify",
				monitorType: "flow",
				monitorId: monitor.id,
				previousStatus: "down",
				newStatus: "up",
			},
		]);
	});

	test("tells nobody about a run that could not find out, and still records it", async () => {
		let { db } = createTestDatabase();
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

		let job = await runJob(db);

		expect(enqueued()).toEqual([]);

		let [result] = await FlowMonitor.listResults(db, monitor.id);
		expect(result?.status).toBe("error");

		let completed = job.logger.events.find((event) => event.event === "job.check_flows.completed");
		expect(completed?.successCount).toBe(1);
		expect(completed?.notified).toBe(0);
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

	test("alerts every time an assertion is still failing, leaving cooldown to space the repeats", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db, { last_status: "down" });
		runFlowCheckMock.mockImplementation(async () => failing());

		await runJob(db);

		expect(enqueued()).toEqual([
			{
				type: "notify",
				monitorType: "flow",
				monitorId: monitor.id,
				previousStatus: "down",
				newStatus: "down",
			},
		]);
	});
});
