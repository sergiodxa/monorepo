/**
 * Unit tests for `CheckDnsJob.perform()`, covering the claim-the-due-monitors pass: which
 * monitors a run picks up (only those their own `interval_seconds` has made due, and each of
 * them once however often the cron is delivered), result recording via
 * `DnsMonitor.recordCheckResult`, the `notify` message it enqueues
 * for an alert-worthy transition (carrying the monitor's pre-update `last_status` so the
 * consumer can tell a recovery from a first-ever result), that a still-ok monitor enqueues
 * nothing, and that one monitor's check failure doesn't stop the rest of the sweep.
 *
 * Also covered: what a completed check costs and reports. Each one writes an Analytics
 * Engine point carrying DNS's own `ok`/`changed`/`error` vocabulary rather than a remap
 * onto HTTP's, and the sweep bills every check it completed in a single ingestion call —
 * a monitor whose check threw produced no result row, so it produces no ping either.
 *
 * `checkDns` is mocked — DNS resolution has its own tests — and the `QUEUE` and
 * `PING_RESULTS` bindings are faked so the enqueued messages and the data points can be
 * asserted on. Polar is a real client with its one ingestion call spied on, so the events
 * asserted here are the ones the job actually built. Alert delivery itself now happens in
 * `NotifyJob`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, mock, spyOn, test } from "bun:test";

import type { IngestEvent } from "@pkg/polar";

import { BatchedLogger } from "@pkg/logger";
import { Mailer } from "@pkg/mail";
import { MemoryTransport } from "@pkg/mail/memory";
import { PolarClient } from "@pkg/polar";
import { ServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";

import type { NotifyMessage } from "~/app/lib/notify-queue";
import type { DnsCheckResult } from "~/app/services/dns-check";
import type { InsertDnsMonitor } from "~/database/schema";

import DnsMonitor from "~/app/data/dns-monitor";
import { MAIL_FROM } from "~/app/emails/sender";
import { createTestDatabase } from "~/app/lib/test/db";
import { dnsMonitors, teams } from "~/database/schema";

let checkDnsMock = mock(
	async (
		_domain: string,
		_recordType: string,
		_expectedValue: string | null,
		_previousValue: string | null,
	): Promise<DnsCheckResult> => ({ status: "ok", resolvedValue: "1.2.3.4", responseTimeMs: 10 }),
);

/** Every `notify` message body the sweep put on the queue, in order. */
let enqueued: NotifyMessage[] = [];
let sendBatchMock = mock(async (requests: Array<{ body: NotifyMessage }>) => {
	for (let request of requests) enqueued.push(request.body);
});

/** One Analytics Engine data point, as the `PING_RESULTS` binding receives it. */
interface DataPoint {
	blobs: string[];
	doubles: number[];
	indexes: string[];
}

/** Records the data points `writePingResult` sends to Analytics Engine. */
let writeDataPointMock = mock((_point: DataPoint) => {});

mock.module("cloudflare:workers", () => ({
	env: {
		QUEUE: { sendBatch: sendBatchMock, send: async () => {} },
		PING_RESULTS: { writeDataPoint: writeDataPointMock },
	},
}));

/**
 * The billing client the container hands the job, with the one call `ingestPings` makes
 * spied on. The client is real — only the request is intercepted — so the events asserted
 * below are the ones the sweep actually built.
 */
let polar = new PolarClient({ accessToken: "polar_at_test" });
let ingestEventsSafeMock = spyOn(polar, "ingestEventsSafe");

let realDnsCheckModule = await import("~/app/services/dns-check");

mock.module("~/app/services/dns-check", () => ({ ...realDnsCheckModule, checkDns: checkDnsMock }));

let { CheckDnsJob } = await import("./check-dns");

function makeJob() {
	return new CheckDnsJob({ logger: new BatchedLogger("test") }, {});
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
	overrides: Partial<InsertDnsMonitor> = {},
	teamId = "team-1",
) {
	return await DnsMonitor.create(db, teamId, {
		name: "Example domain",
		domain: "example.com",
		record_type: "A",
		expected_value: null,
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
	checkDnsMock.mockReset();
	checkDnsMock.mockImplementation(async () => ({
		status: "ok",
		resolvedValue: "1.2.3.4",
		responseTimeMs: 10,
	}));
	sendBatchMock.mockClear();
	writeDataPointMock.mockClear();
	ingestEventsSafeMock.mockClear();
	ingestEventsSafeMock.mockImplementation(async () => true);
	enqueued = [];
});

describe("CheckDnsJob", () => {
	test("checks an enabled monitor, records the result, and enqueues a notification with no previous status", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db);

		checkDnsMock.mockImplementation(async () => ({
			status: "changed",
			resolvedValue: "5.6.7.8",
			responseTimeMs: 42,
		}));

		let job = await runJob(db);

		let updated = await DnsMonitor.findByIdForTeam(db, "team-1", monitor.id);
		expect(updated?.last_status).toBe("changed");
		expect(updated?.last_value).toBe("5.6.7.8");
		expect(updated?.last_checked_at).not.toBeNull();

		let results = await DnsMonitor.listResults(db, monitor.id);
		expect(results).toHaveLength(1);
		expect(results[0]!.status).toBe("changed");
		expect(results[0]!.response_time_ms).toBe(42);

		expect(enqueued).toEqual([
			{
				type: "notify",
				monitorType: "dns",
				monitorId: monitor.id,
				previousStatus: null,
				newStatus: "changed",
			},
		]);

		let completed = job.logger.events.find((event) => event.event === "job.check_dns.completed");
		expect(completed?.total).toBe(1);
		expect(completed?.successCount).toBe(1);
		expect(completed?.errorCount).toBe(0);
		expect(completed?.notified).toBe(1);
	});

	test("skips monitors with checking disabled", async () => {
		let { db } = createTestDatabase();
		await seedMonitor(db, { is_enabled: false });

		await runJob(db);

		expect(checkDnsMock).not.toHaveBeenCalled();
		expect(enqueued).toHaveLength(0);
	});

	test("skips a monitor whose configured interval hasn't come round yet", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db, { interval_seconds: 3600 });
		await db.update(
			dnsMonitors,
			monitor.id,
			{ next_due_at: Date.now() + 30 * 60_000 },
			{ touch: false },
		);

		await runJob(db);

		expect(checkDnsMock).not.toHaveBeenCalled();
	});

	test("checks a monitor once however many times the minute's cron is delivered", async () => {
		let { db } = createTestDatabase();
		await seedMonitor(db, { interval_seconds: 3600 });

		await runJob(db);
		await runJob(db);

		expect(checkDnsMock).toHaveBeenCalledTimes(1);
	});

	test("records a still-ok monitor without enqueuing a notification", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db, { last_status: "ok", last_value: "1.2.3.4" });

		let job = await runJob(db);

		let results = await DnsMonitor.listResults(db, monitor.id);
		expect(results).toHaveLength(1);
		expect(sendBatchMock).not.toHaveBeenCalled();

		let completed = job.logger.events.find((event) => event.event === "job.check_dns.completed");
		expect(completed?.notified).toBe(0);
	});

	test("carries the monitor's pre-update last_status so the consumer can detect a recovery", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db, { last_status: "changed", last_value: "9.9.9.9" });

		await runJob(db);

		expect(enqueued).toEqual([
			{
				type: "notify",
				monitorType: "dns",
				monitorId: monitor.id,
				previousStatus: "changed",
				newStatus: "ok",
			},
		]);
	});

	test("continues checking remaining monitors and counts an error when one check throws", async () => {
		let { db } = createTestDatabase();
		let failing = await seedMonitor(db, { domain: "fails.example.com" });
		let healthy = await seedMonitor(db, { domain: "ok.example.com", last_status: "error" });

		checkDnsMock.mockImplementation(async (domain: string) => {
			if (domain === "fails.example.com") throw new Error("DNS query failed");
			return { status: "ok", resolvedValue: "1.2.3.4", responseTimeMs: 10 };
		});

		let job = await runJob(db);

		expect(enqueued.map((message) => message.monitorId)).toEqual([healthy.id]);

		let completed = job.logger.events.find((event) => event.event === "job.check_dns.completed");
		expect(completed?.total).toBe(2);
		expect(completed?.successCount).toBe(1);
		expect(completed?.errorCount).toBe(1);

		/** The failing monitor's cached fields are untouched — recordCheckResult never ran for it. */
		let failedRow = await DnsMonitor.findByIdForTeam(db, "team-1", failing.id);
		expect(failedRow?.last_status).toBeNull();

		let failureEvent = job.logger.events.find(
			(event) => event.event === "job.check_dns.monitor_failed",
		);
		expect(failureEvent?.monitorId).toBe(failing.id);
	});
});

/**
 * What a completed check reports, beyond its stored row: one Analytics Engine point, and
 * one billable ping folded into the sweep's single ingestion call. Both are keyed on a
 * check that finished, which is what keeps a failed lookup off the bill.
 */
describe("CheckDnsJob ping reporting", () => {
	/** Every event the sweep handed Polar, flattened across the calls it made. */
	function ingestedEvents(): IngestEvent[] {
		return ingestEventsSafeMock.mock.calls.flatMap(([events]) => events);
	}

	/** The monitor each data point was written for, in the order the sweep wrote them. */
	function pingedMonitorIds(): (string | undefined)[] {
		return writeDataPointMock.mock.calls.map(([point]) => point.blobs[0]);
	}

	/** The id of the result row a monitor's check wrote, which its ping is keyed on. */
	async function resultId(db: Database, monitorId: string) {
		let [result] = await DnsMonitor.listResults(db, monitorId);
		if (!result) throw new Error(`No result recorded for monitor ${monitorId}`);
		return result.id;
	}

	test("writes a data point carrying DNS's own status rather than a remap onto up/down", async () => {
		let { db } = createTestDatabase();
		await seedTeam(db, "team-1", "owner-1");
		let monitor = await seedMonitor(db);
		checkDnsMock.mockImplementation(async () => ({
			status: "changed",
			resolvedValue: "5.6.7.8",
			responseTimeMs: 42,
		}));

		await runJob(db);

		expect(writeDataPointMock).toHaveBeenCalledTimes(1);
		// `changed` is not in HTTP's vocabulary at all: nothing reads a status without
		// filtering to one ping type first, so the two never have to agree.
		expect(writeDataPointMock).toHaveBeenCalledWith({
			blobs: [monitor.id, "dns", "changed"],
			doubles: [42, 1, 0, 0],
			indexes: ["team-1"],
		});
	});

	test("bills every check the sweep completed in a single ingestion call", async () => {
		let { db } = createTestDatabase();
		await seedTeam(db, "team-1", "owner-1");
		let first = await seedMonitor(db, { domain: "one.example.com" });
		let second = await seedMonitor(db, { domain: "two.example.com" });
		let third = await seedMonitor(db, { domain: "three.example.com" });

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
			metadata: { teamId: "team-1", type: "dns", monitorId: first.id },
		});

		let completed = job.logger.events.find((event) => event.event === "job.check_dns.completed");
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
		let billable = await seedMonitor(db, { domain: "billable.example.com" });
		// A team row that is gone, so there is no Polar customer to ingest against.
		let orphan = await seedMonitor(db, { domain: "orphan.example.com" }, "team-2");

		let job = await runJob(db);

		expect(ingestedEvents().map((event) => event.metadata?.monitorId)).toEqual([billable.id]);
		let unbillable = job.logger.events.find(
			(event) => event.event === "job.check_dns.unbillable_team",
		);
		expect(unbillable?.monitorId).toBe(orphan.id);
		expect(unbillable?.teamId).toBe("team-2");

		// Its check still ran, was still recorded, and still counts as a success — only the
		// billing is lost.
		expect(pingedMonitorIds().sort()).toEqual([billable.id, orphan.id].sort());
		expect(await DnsMonitor.listResults(db, orphan.id)).toHaveLength(1);
		let completed = job.logger.events.find((event) => event.event === "job.check_dns.completed");
		expect(completed?.successCount).toBe(2);
		expect(completed?.ingested).toBe(1);
	});

	test("a check that threw produces neither a data point nor a ping", async () => {
		let { db } = createTestDatabase();
		await seedTeam(db, "team-1", "owner-1");
		await seedMonitor(db, { domain: "fails.example.com" });
		let healthy = await seedMonitor(db, { domain: "ok.example.com" });

		checkDnsMock.mockImplementation(async (domain: string) => {
			if (domain === "fails.example.com") throw new Error("DNS query failed");
			return { status: "ok", resolvedValue: "1.2.3.4", responseTimeMs: 10 };
		});

		await runJob(db);

		// A lookup that threw left no result row, so there is nothing to report or bill.
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

		expect(await DnsMonitor.listResults(db, monitor.id)).toHaveLength(1);
		let completed = job.logger.events.find((event) => event.event === "job.check_dns.completed");
		expect(completed?.successCount).toBe(1);
	});
});
