/**
 * Unit tests for `CheckTcpJob.perform()`, covering the claim-the-due-monitors pass: which
 * monitors a run picks up (only those their own `interval_seconds` has made due, and each of
 * them once however often the cron is delivered), result recording via
 * `TcpMonitor.recordCheckResult`, the `notify` message it enqueues
 * for an alert-worthy transition (carrying the monitor's pre-update `last_status` so the
 * consumer can tell a recovery from a first-ever result), that a healthy monitor enqueues
 * nothing, and that one monitor's check failure doesn't stop the rest of the sweep.
 *
 * Also covered: what a completed check costs and reports. Each one writes an Analytics
 * Engine point carrying TCP's own `up`/`down`/`timeout` vocabulary, with zero standing in
 * for the latency a refused connection never had, and the sweep bills every check it
 * completed in a single ingestion call — a monitor whose check threw produced no result
 * row, so it produces no ping either.
 *
 * `checkTcpConnection` is mocked — raw TCP connectivity needs `cloudflare:sockets`, which
 * is unavailable under `bun test` — while the `QUEUE` and `PING_RESULTS` bindings are
 * in-memory implementations installed through `cloudflare:workers`, so the enqueued messages
 * and the data points asserted on are the ones that really landed on them. Polar is a real
 * client with its one ingestion call spied on, so the events asserted here are the ones the
 * sweep actually built. Alert delivery itself now happens in `NotifyJob` and has its own
 * tests.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test";

import type { AnalyticsEngineMock, QueueMock } from "@pkg/cloudflare-mocks";
import type { IngestEvent } from "@pkg/polar";

import { createAnalyticsEngine, createEnv, createQueue } from "@pkg/cloudflare-mocks";
import { BatchedLogger } from "@pkg/logger";
import { Mailer } from "@pkg/mail";
import { MemoryTransport } from "@pkg/mail/memory";
import { PolarClient } from "@pkg/polar";
import { ServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";

import type { NotifyMessage } from "~/app/lib/notify-queue";
import type { TcpCheckResult } from "~/app/services/tcp-check";
import type { InsertTcpMonitor } from "~/database/schema";

import TcpMonitor from "~/app/data/tcp-monitor";
import { MAIL_FROM } from "~/app/emails/sender";
import { createTestDatabase } from "~/app/lib/test/db";
import { tcpMonitors, teams } from "~/database/schema";

let checkTcpConnectionMock = mock(
	async (_host: string, _port: number, _timeoutMs: number): Promise<TcpCheckResult> => ({
		status: "up",
		responseTimeMs: 10,
	}),
);

/**
 * The queue the sweep notifies through and the dataset it reports checks to. Both live at
 * module scope because the module under test captures `env` on import, so `beforeEach`
 * empties them rather than re-creating them.
 */
let queue: QueueMock<NotifyMessage> = createQueue<NotifyMessage>({ name: "notify" });
let pingResults: AnalyticsEngineMock = createAnalyticsEngine();

/** A sweep that enqueued nothing is a call that never happened, which `sent` cannot show. */
let sendBatch = spyOn(queue, "sendBatch");

mock.module("cloudflare:workers", () => ({
	env: createEnv<Env>({ QUEUE: queue, PING_RESULTS: pingResults }),
}));
mock.module("~/app/services/tcp-check", () => ({
	checkTcpConnection: checkTcpConnectionMock,
}));

/**
 * The billing client the container hands the job, with the one call `ingestPings` makes
 * spied on. The client is real — only the request is intercepted — so the events asserted
 * below are the ones the sweep actually built.
 */
let polar = new PolarClient({ accessToken: "polar_at_test" });
let ingestEventsSafeMock = spyOn(polar, "ingestEventsSafe");

let { CheckTcpJob } = await import("./check-tcp");

/** Every `notify` message body the sweep put on the queue, in order. */
function enqueued(): NotifyMessage[] {
	return queue.sent.map((message) => message.body);
}

function makeJob() {
	return new CheckTcpJob({ logger: new BatchedLogger("test") }, {});
}

async function runJob(db: Database) {
	let container = new ServiceContainer();
	container.singleton(Database, () => db);
	container.singleton(
		Mailer,
		() => new Mailer({ transport: new MemoryTransport(), from: MAIL_FROM }),
	);
	container.singleton(PolarClient, () => polar);
	let job = makeJob();
	await container.scope(() => job.perform());
	return job;
}

async function seedMonitor(
	db: Database,
	overrides: Partial<InsertTcpMonitor> = {},
	teamId = "team-1",
) {
	return await TcpMonitor.create(db, teamId, {
		name: "Example host",
		host: "example.com",
		port: 443,
		timeout_ms: 5000,
		is_enabled: true,
		...overrides,
	});
}

/**
 * Seeds the team a monitor belongs to, which is what names the Polar customer its checks
 * are billed to. Only the suites about metering need one, since a team the sweep can't
 * resolve an owner for is a supported (if unbillable) state.
 */
async function seedTeam(db: Database, teamId: string, ownerId: string) {
	return await db.create(
		teams,
		{ id: teamId, owner_id: ownerId, name: "Acme", slug: `acme-${teamId}`, logo: null },
		{ touch: true, returnRow: true },
	);
}

beforeEach(() => {
	checkTcpConnectionMock.mockReset();
	checkTcpConnectionMock.mockImplementation(async () => ({ status: "up", responseTimeMs: 10 }));
	queue.reset();
	sendBatch.mockClear();
	pingResults.reset();
	ingestEventsSafeMock.mockClear();
	ingestEventsSafeMock.mockImplementation(async () => true);
});

describe("CheckTcpJob", () => {
	test("checks an enabled monitor, records the result, and enqueues a notification with no previous status", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db);

		checkTcpConnectionMock.mockImplementation(async () => ({
			status: "down",
			responseTimeMs: null,
		}));

		let job = await runJob(db);

		let updated = await TcpMonitor.findByIdForTeam(db, "team-1", monitor.id);
		expect(updated?.last_status).toBe("down");
		expect(updated?.last_response_time_ms).toBeNull();
		expect(updated?.last_checked_at).not.toBeNull();

		let results = await TcpMonitor.listResults(db, monitor.id);
		expect(results).toHaveLength(1);
		expect(results[0]!.status).toBe("down");

		expect(enqueued()).toEqual([
			{
				type: "notify",
				monitorType: "tcp",
				monitorId: monitor.id,
				previousStatus: null,
				newStatus: "down",
			},
		]);

		let completed = job.logger.events.find((event) => event.event === "job.check_tcp.completed");
		expect(completed?.total).toBe(1);
		expect(completed?.successCount).toBe(1);
		expect(completed?.errorCount).toBe(0);
		expect(completed?.notified).toBe(1);
	});

	test("skips monitors with checking disabled", async () => {
		let { db } = createTestDatabase();
		await seedMonitor(db, { is_enabled: false });

		await runJob(db);

		expect(checkTcpConnectionMock).not.toHaveBeenCalled();
		expect(enqueued()).toHaveLength(0);
	});

	test("skips a monitor whose configured interval hasn't come round yet", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db, { interval_seconds: 3600 });
		await db.update(
			tcpMonitors,
			monitor.id,
			{ next_due_at: Date.now() + 30 * 60_000 },
			{ touch: false },
		);

		await runJob(db);

		expect(checkTcpConnectionMock).not.toHaveBeenCalled();
	});

	test("checks a monitor once however many times the minute's cron is delivered", async () => {
		let { db } = createTestDatabase();
		await seedMonitor(db, { interval_seconds: 3600 });

		await runJob(db);
		await runJob(db);

		expect(checkTcpConnectionMock).toHaveBeenCalledTimes(1);
	});

	test("records a still-up monitor without enqueuing a notification", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db, { last_status: "up", last_response_time_ms: 10 });

		let job = await runJob(db);

		let results = await TcpMonitor.listResults(db, monitor.id);
		expect(results).toHaveLength(1);
		expect(sendBatch).not.toHaveBeenCalled();

		let completed = job.logger.events.find((event) => event.event === "job.check_tcp.completed");
		expect(completed?.notified).toBe(0);
	});

	test("carries the monitor's pre-update last_status so the consumer can detect a recovery", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db, { last_status: "timeout", last_response_time_ms: null });

		await runJob(db);

		expect(enqueued()).toEqual([
			{
				type: "notify",
				monitorType: "tcp",
				monitorId: monitor.id,
				previousStatus: "timeout",
				newStatus: "up",
			},
		]);
	});

	test("continues checking remaining monitors and counts an error when one check throws", async () => {
		let { db } = createTestDatabase();
		let failing = await seedMonitor(db, { host: "fails.example.com", last_status: "up" });
		let healthy = await seedMonitor(db, { host: "ok.example.com", last_status: "down" });

		checkTcpConnectionMock.mockImplementation(async (host: string) => {
			if (host === "fails.example.com") throw new Error("Connection refused");
			return { status: "up", responseTimeMs: 10 };
		});

		let job = await runJob(db);

		expect(enqueued().map((message) => message.monitorId)).toEqual([healthy.id]);

		let completed = job.logger.events.find((event) => event.event === "job.check_tcp.completed");
		expect(completed?.total).toBe(2);
		expect(completed?.successCount).toBe(1);
		expect(completed?.errorCount).toBe(1);

		/** The failing monitor's cached fields are untouched — recordCheckResult never ran for it. */
		let failedRow = await TcpMonitor.findByIdForTeam(db, "team-1", failing.id);
		expect(failedRow?.last_status).toBe("up");
		expect(failedRow?.last_checked_at).toBeNull();

		let failureEvent = job.logger.events.find(
			(event) => event.event === "job.check_tcp.monitor_failed",
		);
		expect(failureEvent?.monitorId).toBe(failing.id);
	});
});

/**
 * What a completed check reports, beyond its stored row: one Analytics Engine point, and
 * one billable ping folded into the sweep's single ingestion call. Both are keyed on a
 * check that finished, which is what keeps a failed connection attempt off the bill.
 */
describe("CheckTcpJob ping reporting", () => {
	/** Every event the sweep handed Polar, flattened across the calls it made. */
	function ingestedEvents(): IngestEvent[] {
		return ingestEventsSafeMock.mock.calls.flatMap(([events]) => events);
	}

	/** The monitor each data point was written for, in the order the sweep wrote them. */
	function pingedMonitorIds(): unknown[] {
		return pingResults.dataPoints.map((point) => point.blobs?.[0]);
	}

	/** The id of the result row a monitor's check wrote, which its ping is keyed on. */
	async function resultId(db: Database, monitorId: string) {
		let [result] = await TcpMonitor.listResults(db, monitorId);
		if (!result) throw new Error(`No result recorded for monitor ${monitorId}`);
		return result.id;
	}

	test("writes a data point carrying TCP's own status vocabulary", async () => {
		let { db } = createTestDatabase();
		await seedTeam(db, "team-1", "owner-1");
		let monitor = await seedMonitor(db);
		checkTcpConnectionMock.mockImplementation(async () => ({ status: "up", responseTimeMs: 25 }));

		await runJob(db);

		expect(pingResults.dataPoints).toEqual([
			{
				blobs: [monitor.id, "tcp", "up"],
				doubles: [25, 1, 0, 0],
				indexes: ["team-1"],
			},
		]);
	});

	test("reports zero latency for a connection that never answered", async () => {
		let { db } = createTestDatabase();
		await seedTeam(db, "team-1", "owner-1");
		let monitor = await seedMonitor(db);
		checkTcpConnectionMock.mockImplementation(async () => ({
			status: "timeout",
			responseTimeMs: null,
		}));

		await runJob(db);

		// The column is nullable for exactly this, but the dataset's doubles are not, and
		// zero is how the rest of the dataset already spells "no measurement".
		expect(pingResults.dataPoints).toContainEqual({
			blobs: [monitor.id, "tcp", "timeout"],
			doubles: [0, 1, 0, 0],
			indexes: ["team-1"],
		});
	});

	test("bills every check the sweep completed in a single ingestion call", async () => {
		let { db } = createTestDatabase();
		await seedTeam(db, "team-1", "owner-1");
		let first = await seedMonitor(db, { host: "one.example.com" });
		let second = await seedMonitor(db, { host: "two.example.com" });
		let third = await seedMonitor(db, { host: "three.example.com" });

		let job = await runJob(db);

		// One call, three pings — a sweep of eighty monitors costs one subrequest, not eighty.
		expect(ingestEventsSafeMock).toHaveBeenCalledTimes(1);
		let events = ingestedEvents();
		expect(events).toHaveLength(3);
		expect(events.map((event) => event.metadata?.monitorId).sort()).toEqual(
			[first.id, second.id, third.id].sort(),
		);
		expect(events).toContainEqual({
			name: "ping",
			externalCustomerId: "owner-1",
			externalId: `ping:${await resultId(db, first.id)}`,
			metadata: { teamId: "team-1", type: "tcp", monitorId: first.id },
		});

		let completed = job.logger.events.find((event) => event.event === "job.check_tcp.completed");
		expect(completed?.ingested).toBe(3);
	});

	test("keys each ping on the result row its check wrote", async () => {
		let { db } = createTestDatabase();
		await seedTeam(db, "team-1", "owner-1");
		let monitor = await seedMonitor(db);

		await runJob(db);

		// The row id is the only thing about a completed check that is unique and already
		// persisted, so it is what Polar can deduplicate a re-recorded check on.
		expect(ingestedEvents()[0]?.externalId).toBe(`ping:${await resultId(db, monitor.id)}`);
	});

	test("skips a monitor whose team names no owner without failing the sweep", async () => {
		let { db } = createTestDatabase();
		await seedTeam(db, "team-1", "owner-1");
		let billable = await seedMonitor(db, { host: "billable.example.com" });
		// A team row that is gone, so there is no Polar customer to ingest against.
		let orphan = await seedMonitor(db, { host: "orphan.example.com" }, "team-2");

		let job = await runJob(db);

		expect(ingestedEvents().map((event) => event.metadata?.monitorId)).toEqual([billable.id]);
		let unbillable = job.logger.events.find(
			(event) => event.event === "job.check_tcp.unbillable_team",
		);
		expect(unbillable?.monitorId).toBe(orphan.id);
		expect(unbillable?.teamId).toBe("team-2");

		// Its check still ran, was still recorded, and still counts as a success — only the
		// billing is lost.
		expect(pingedMonitorIds().sort()).toEqual([billable.id, orphan.id].sort());
		expect(await TcpMonitor.listResults(db, orphan.id)).toHaveLength(1);
		let completed = job.logger.events.find((event) => event.event === "job.check_tcp.completed");
		expect(completed?.successCount).toBe(2);
		expect(completed?.ingested).toBe(1);
	});

	test("a check that threw produces neither a data point nor a ping", async () => {
		let { db } = createTestDatabase();
		await seedTeam(db, "team-1", "owner-1");
		await seedMonitor(db, { host: "fails.example.com" });
		let healthy = await seedMonitor(db, { host: "ok.example.com" });

		checkTcpConnectionMock.mockImplementation(async (host: string) => {
			if (host === "fails.example.com") throw new Error("Connection refused");
			return { status: "up", responseTimeMs: 10 };
		});

		await runJob(db);

		// A connection attempt that threw left no result row, so there is nothing to report
		// or bill.
		expect(pingedMonitorIds()).toEqual([healthy.id]);
		expect(ingestedEvents().map((event) => event.metadata?.monitorId)).toEqual([healthy.id]);
	});

	test("makes no ingestion call at all when the sweep claimed nothing", async () => {
		let { db } = createTestDatabase();
		await seedTeam(db, "team-1", "owner-1");

		await runJob(db);

		expect(ingestEventsSafeMock).not.toHaveBeenCalled();
	});

	test("a rejected ingestion doesn't fail the sweep or its recorded results", async () => {
		let { db } = createTestDatabase();
		await seedTeam(db, "team-1", "owner-1");
		let monitor = await seedMonitor(db);
		ingestEventsSafeMock.mockImplementation(async () => false);

		let job = await runJob(db);

		expect(await TcpMonitor.listResults(db, monitor.id)).toHaveLength(1);
		let completed = job.logger.events.find((event) => event.event === "job.check_tcp.completed");
		expect(completed?.successCount).toBe(1);
	});
});
