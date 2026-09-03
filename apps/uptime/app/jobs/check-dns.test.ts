/**
 * Unit tests for the `checkDns` job: which monitors a run claims, the domain sweep's
 * diff and counters, and the `notify` message an alert-worthy transition enqueues.
 *
 * A failed query is left out of the diff, keeping a resolver's bad minute from reading
 * as vanished records.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AnalyticsEngineMock, QueueMock } from "@pkg/cloudflare-mocks";
import type { IngestEvent } from "@pkg/polar";

import { createAnalyticsEngine, createEnv, createQueue } from "@pkg/cloudflare-mocks";
import { createJobContext } from "@pkg/jobs";
import { BatchedLogger } from "@pkg/logger";
import { Mailer } from "@pkg/mail";
import { MemoryTransport } from "@pkg/mail/memory";
import { PolarClient } from "@pkg/polar";
import { ServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { DnsRecordImport } from "~/app/data/dns-monitor-record";
import type { DnsRecordType } from "~/app/lib/dns-record-value";
import type { NotifyMessage } from "~/app/lib/notify-queue";
import type { DnsNameSweep, DnsQueryOutcome } from "~/app/services/dns-check";
import type { InsertDnsMonitor } from "~/database/schema";

import DnsMonitor from "~/app/data/dns-monitor";
import DnsMonitorRecord from "~/app/data/dns-monitor-record";
import { MAIL_FROM } from "~/app/emails/sender";
import { createTestDatabase } from "~/app/lib/test/db";
import { dnsMonitors, teams } from "~/database/schema";

/** One answered `(name, type)` query: this is the whole RRset, and it is trustworthy. */
function answered(
	name: string,
	recordType: DnsRecordType,
	values: string[],
	responseTimeMs = 10,
): DnsQueryOutcome {
	return { name, recordType, values, responseTimeMs, errorMessage: null, suppressedByCname: false };
}

/** One query that did not answer. Its `values` are meaningless and must never be diffed. */
function failed(
	name: string,
	recordType: DnsRecordType,
	errorMessage = "DNS query returned status code 2",
): DnsQueryOutcome {
	return {
		name,
		recordType,
		values: [],
		responseTimeMs: 0,
		errorMessage,
		suppressedByCname: false,
	};
}

/** A name's sweep, with the two derived fields computed exactly as the resolver does. */
function sweepOf(name: string, outcomes: DnsQueryOutcome[]): DnsNameSweep {
	return {
		name,
		outcomes,
		queriesFailed: outcomes.filter((outcome) => outcome.errorMessage !== null).length,
		responseTimeMs: outcomes.reduce(
			(slowest, outcome) => Math.max(slowest, outcome.responseTimeMs),
			0,
		),
	};
}

/**
 * Resolves nothing and fails nothing, which is the neutral sweep: no answers means no diff,
 * so a test that doesn't care about records gets `ok` and zeroed counters.
 */
let sweepDnsNameMock = vi.fn(async (name: string): Promise<DnsNameSweep> => sweepOf(name, []));

/**
 * The queue the sweep notifies through and the dataset it reports checks to. Both live at
 * module scope because the module under test captures `env` on import, so `beforeEach`
 * clears them between tests, reusing the instances the import captured.
 */
let queue: QueueMock<NotifyMessage> = createQueue<NotifyMessage>({ name: "notify" });
let pingResults: AnalyticsEngineMock = createAnalyticsEngine();

/** A sweep that enqueued nothing is a call that never happened, which `sent` cannot show. */
let sendBatch = vi.spyOn(queue, "sendBatch");

vi.doMock("cloudflare:workers", () => ({
	env: createEnv<Env>({ QUEUE: queue, PING_RESULTS: pingResults }),
}));

/**
 * The billing client the container hands the job, with the one call `ingestPings` makes
 * spied on. The client is real — only the request is intercepted — so the events asserted
 * below are the ones the sweep actually built.
 */
let polar = new PolarClient({ accessToken: "polar_at_test" });
let ingestEventsSafeMock = vi.spyOn(polar, "ingestEventsSafe");

let realDnsCheckModule = await import("~/app/services/dns-check");

vi.doMock("~/app/services/dns-check", () => ({
	...realDnsCheckModule,
	sweepDnsName: sweepDnsNameMock,
}));

let jobs = (await import("~/app/jobs")).default;
let { Database: JobDatabase } = await import("~/app/jobs/middleware/database");
let checkDns = (await import("./check-dns")).default;
let { QUERIES_PER_NAME } = realDnsCheckModule;
let { MAX_NAMES_PER_CHECK } = await import("~/app/services/dns-discovery");

/** Every `notify` message body the sweep put on the queue, in order. */
function enqueued(): NotifyMessage[] {
	return queue.sent.map((message) => message.body);
}

/** Runs the handler over a context carrying the test's database, as the chain would. */
async function runJob(db: Database) {
	let container = new ServiceContainer();
	container.singleton(
		Mailer,
		() => new Mailer({ transport: new MemoryTransport(), from: MAIL_FROM }),
	);
	container.singleton(PolarClient, () => polar);
	let ctx = createJobContext(jobs.checkDns, {
		id: "message-1",
		attempts: 1,
		logger: new BatchedLogger("test"),
	});
	ctx.set(JobDatabase, db, { property: "database" });

	await container.scope(() => checkDns(ctx));
	return ctx;
}

async function seedMonitor(
	db: Database,
	overrides: Partial<InsertDnsMonitor> = {},
	teamId = "team-1",
) {
	return await DnsMonitor.create(db, teamId, {
		name: "Example domain",
		domain: "example.com",
		is_enabled: true,
		...overrides,
	});
}

/** A watched record as discovery imported it: resolved, enabled, `ok`. */
async function seedRecord(db: Database, monitorId: string, overrides: Partial<DnsRecordImport>) {
	await DnsMonitorRecord.importMany(db, monitorId, [
		{
			name: "example.com",
			record_type: "A",
			value: "1.2.3.4",
			source: "resolver",
			is_enabled: true,
			status: "ok",
			last_seen_at: Date.now(),
			...overrides,
		},
	]);
}

/** Gives a monitor `count` distinct tracked names, for the budget and cap assertions. */
async function seedNames(db: Database, monitorId: string, count: number, suffix: string) {
	await DnsMonitorRecord.importMany(
		db,
		monitorId,
		Array.from({ length: count }, (_, index) => ({
			name: `n${index}.${suffix}`,
			record_type: "A" as const,
			value: `10.0.0.${index}`,
			source: "resolver" as const,
			is_enabled: true,
			status: "ok" as const,
			last_seen_at: Date.now(),
		})),
	);
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

/** The single result row a monitor's check wrote. */
async function onlyResult(db: Database, monitorId: string) {
	let results = await DnsMonitor.listResults(db, monitorId);
	expect(results).toHaveLength(1);
	return results[0]!;
}

beforeEach(() => {
	sweepDnsNameMock.mockReset();
	sweepDnsNameMock.mockImplementation(async (name: string) => sweepOf(name, []));
	queue.reset();
	sendBatch.mockClear();
	pingResults.reset();
	ingestEventsSafeMock.mockClear();
	ingestEventsSafeMock.mockImplementation(async () => true);
});

describe("checkDns", () => {
	test("sweeps a monitor's tracked names, records the diff's counters, and enqueues a notification with no previous status", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db);
		await seedRecord(db, monitor.id, {});

		sweepDnsNameMock.mockImplementation(async (name: string) =>
			sweepOf(name, [answered(name, "A", ["5.6.7.8"], 42)]),
		);

		let job = await runJob(db);

		expect(sweepDnsNameMock).toHaveBeenCalledWith("example.com");

		let updated = await DnsMonitor.findByIdForTeam(db, "team-1", monitor.id);
		expect(updated?.last_status).toBe("changed");
		expect(updated?.last_checked_at).not.toBeNull();

		let result = await onlyResult(db, monitor.id);
		expect(result.status).toBe("changed");
		expect(result.response_time_ms).toBe(42);
		expect(result.records_checked).toBe(1);
		expect(result.records_changed).toBe(1);
		expect(result.records_missing).toBe(0);
		expect(result.records_new).toBe(0);
		expect(result.queries_failed).toBe(0);

		expect(enqueued()).toEqual([
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
		expect(completed?.deferredCount).toBe(0);
		expect(completed?.notified).toBe(1);
	});

	test("skips monitors with checking disabled", async () => {
		let { db } = createTestDatabase();
		await seedMonitor(db, { is_enabled: false });

		await runJob(db);

		expect(sweepDnsNameMock).not.toHaveBeenCalled();
		expect(enqueued()).toHaveLength(0);
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

		expect(sweepDnsNameMock).not.toHaveBeenCalled();
	});

	test("checks a monitor once however many times the minute's cron is delivered", async () => {
		let { db } = createTestDatabase();
		await seedMonitor(db, { interval_seconds: 3600 });

		await runJob(db);
		await runJob(db);

		expect(sweepDnsNameMock).toHaveBeenCalledTimes(1);
	});

	test("records a still-ok monitor without enqueuing a notification", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db, { last_status: "ok" });
		await seedRecord(db, monitor.id, {});

		sweepDnsNameMock.mockImplementation(async (name: string) =>
			sweepOf(name, [answered(name, "A", ["1.2.3.4"])]),
		);

		let job = await runJob(db);

		let result = await onlyResult(db, monitor.id);
		expect(result.status).toBe("ok");
		expect(result.records_checked).toBe(1);
		expect(sendBatch).not.toHaveBeenCalled();

		let completed = job.logger.events.find((event) => event.event === "job.check_dns.completed");
		expect(completed?.notified).toBe(0);
	});

	test("carries the monitor's pre-update last_status so the consumer can detect a recovery", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db, { last_status: "changed" });

		await runJob(db);

		expect(enqueued()).toEqual([
			{
				type: "notify",
				monitorType: "dns",
				monitorId: monitor.id,
				previousStatus: "changed",
				newStatus: "ok",
			},
		]);
	});

	test("continues sweeping remaining monitors and counts an error when one monitor's check throws", async () => {
		let { db } = createTestDatabase();
		let failing = await seedMonitor(db, { domain: "fails.example.com" });
		let healthy = await seedMonitor(db, { domain: "ok.example.com", last_status: "error" });

		let listNames = vi
			.spyOn(DnsMonitorRecord, "listNames")
			.mockImplementation(async (_db: Database, monitorId: string) => {
				if (monitorId === failing.id) throw new Error("D1 read failed");
				return [];
			});

		try {
			let job = await runJob(db);

			expect(enqueued().map((message) => message.monitorId)).toEqual([healthy.id]);

			let completed = job.logger.events.find((event) => event.event === "job.check_dns.completed");
			expect(completed?.total).toBe(2);
			expect(completed?.successCount).toBe(1);
			expect(completed?.errorCount).toBe(1);

			/** The failing monitor's cached fields are untouched — recordCheckResult never ran. */
			let failedRow = await DnsMonitor.findByIdForTeam(db, "team-1", failing.id);
			expect(failedRow?.last_status).toBeNull();
			expect(await DnsMonitor.listResults(db, failing.id)).toHaveLength(0);

			let failureEvent = job.logger.events.find(
				(event) => event.event === "job.check_dns.monitor_failed",
			);
			expect(failureEvent?.monitorId).toBe(failing.id);
		} finally {
			listNames.mockRestore();
		}
	});

	test("sweeps the apex alone when the monitor tracks no names at all", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db, { domain: "unimported.example.com" });

		let job = await runJob(db);

		expect(sweepDnsNameMock.mock.calls).toEqual([["unimported.example.com"]]);

		/**
		 * A domain nobody pasted a zone file for legitimately covers its apex and nothing
		 * else, which is a different situation from an import that produced nothing.
		 */
		let event = job.logger.events.find((entry) => entry.event === "job.check_dns.no_tracked_names");
		expect(event?.monitorId).toBe(monitor.id);
		expect(event?.zoneFileImported).toBe(false);
	});
});

/**
 * The rule the whole feature turns on: a query that failed tells us nothing, and telling a
 * customer their records vanished because our resolver had a bad minute is the one failure
 * mode this sweep must not have.
 */
describe("checkDns failed queries", () => {
	test("omits a failed query from the diff instead of passing it as an empty answer", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db);
		await seedRecord(db, monitor.id, { record_type: "MX", value: "10 mx1.example.com" });

		sweepDnsNameMock.mockImplementation(async (name: string) =>
			sweepOf(name, [failed(name, "MX", "DNS query returned status code 2")]),
		);

		await runJob(db);

		let result = await onlyResult(db, monitor.id);
		/**
		 * Nothing was diffed, so nothing is missing: the check reports uncertainty, and the
		 * record is left exactly as it was found.
		 */
		expect(result.status).toBe("error");
		expect(result.queries_failed).toBe(1);
		expect(result.records_missing).toBe(0);
		expect(result.records_checked).toBe(0);
		expect(result.error_message).toBe("DNS query returned status code 2");

		let [stored] = await DnsMonitorRecord.listByMonitor(db, monitor.id);
		expect(stored?.status).toBe("ok");
		expect(stored?.last_checked_at).toBeNull();
	});

	test("diffs an empty answer as missing, since empty is a fact and a failure is not", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db);
		await seedRecord(db, monitor.id, { record_type: "MX", value: "10 mx1.example.com" });

		sweepDnsNameMock.mockImplementation(async (name: string) =>
			sweepOf(name, [answered(name, "MX", [])]),
		);

		await runJob(db);

		let result = await onlyResult(db, monitor.id);
		expect(result.status).toBe("changed");
		expect(result.records_missing).toBe(1);
		expect(result.queries_failed).toBe(0);

		let [stored] = await DnsMonitorRecord.listByMonitor(db, monitor.id);
		expect(stored?.status).toBe("missing");
	});

	test("reports error even when the answered half of the sweep found a change", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db);
		await seedRecord(db, monitor.id, {});

		sweepDnsNameMock.mockImplementation(async (name: string) =>
			sweepOf(name, [answered(name, "A", ["5.6.7.8"]), failed(name, "TXT")]),
		);

		await runJob(db);

		/**
		 * An incomplete answer is reported as `error`, which outranks `changed` — the honest
		 * summary for a check that came back partial. The counters still carry what was found.
		 */
		let result = await onlyResult(db, monitor.id);
		expect(result.status).toBe("error");
		expect(result.records_changed).toBe(1);
		expect(result.queries_failed).toBe(1);
	});

	test("imports a newly resolved record disabled and counts it as new", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db);

		sweepDnsNameMock.mockImplementation(async (name: string) =>
			sweepOf(name, [answered(name, "TXT", ["v=spf1 -all"])]),
		);

		await runJob(db);

		let result = await onlyResult(db, monitor.id);
		expect(result.status).toBe("changed");
		expect(result.records_new).toBe(1);

		let [stored] = await DnsMonitorRecord.listByMonitor(db, monitor.id);
		expect(stored?.status).toBe("new");
		expect(stored?.is_enabled).toBeFalsy();
	});

	test("records the slowest query rather than the sum across the names it swept", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db);
		await seedNames(db, monitor.id, 2, "slow.example.com");

		sweepDnsNameMock.mockImplementation(async (name: string) =>
			sweepOf(name, [answered(name, "A", [], name.startsWith("n0.") ? 42 : 17)]),
		);

		await runJob(db);

		/** The column feeds a latency chart; summing would quietly make it a cost chart. */
		expect((await onlyResult(db, monitor.id)).response_time_ms).toBe(42);
	});
});

/**
 * The per-invocation subrequest ceiling is a hard failure, so the sweep bounds itself
 * against it. What matters is that neither bound can ever read as "these records are gone".
 */
describe("checkDns query budget", () => {
	test("sweeps at most the per-check name cap and records the rest as unanswered queries", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db);
		/** Past the cap an import would have refused, which is the only way a monitor gets here. */
		await seedNames(db, monitor.id, 105, "capped.example.com");

		let job = await runJob(db);

		expect(sweepDnsNameMock).toHaveBeenCalledTimes(MAX_NAMES_PER_CHECK);

		let result = await onlyResult(db, monitor.id);
		/**
		 * Six names left unswept (105 tracked plus the apex, capped at 100), six types each:
		 * partial, and reported as partial.
		 */
		expect(result.queries_failed).toBe(6 * QUERIES_PER_NAME);
		expect(result.status).toBe("error");
		expect(result.records_missing).toBe(0);

		let truncated = job.logger.events.find(
			(event) => event.event === "job.check_dns.sweep_truncated",
		);
		expect(truncated?.monitorId).toBe(monitor.id);
		expect(truncated?.swept).toBe(MAX_NAMES_PER_CHECK);
	});

	test("defers a monitor the invocation has no query budget left for instead of failing it", async () => {
		let { db } = createTestDatabase();
		let monitors = [];
		for (let index = 0; index < 4; index++) {
			let monitor = await seedMonitor(db, { domain: `d${index}.example.com` });
			await seedNames(db, monitor.id, 40, `d${index}.example.com`);
			monitors.push(monitor);
		}

		let job = await runJob(db);

		/**
		 * 600 queries is 100 names: three monitors are swept, two in full and one truncated,
		 * and the fourth waits for the next delivery.
		 */
		expect(sweepDnsNameMock).toHaveBeenCalledTimes(100);

		let deferred = job.logger.events.filter((event) => event.event === "job.check_dns.deferred");
		expect(deferred).toHaveLength(1);

		let deferredId = deferred[0]?.monitorId;
		/** Deferred entirely: no result row, no cached status, and nothing billed for it. */
		expect(await DnsMonitor.listResults(db, String(deferredId))).toHaveLength(0);
		let row = await DnsMonitor.findByIdForTeam(db, "team-1", String(deferredId));
		expect(row?.last_status).toBeNull();
		/** Re-armed so the very next cron delivery gets another try, keeping the retry close. */
		expect(row?.next_due_at).not.toBeNull();
		expect(row!.next_due_at!).toBeLessThanOrEqual(Date.now());

		let completed = job.logger.events.find((event) => event.event === "job.check_dns.completed");
		expect(completed?.successCount).toBe(3);
		expect(completed?.deferredCount).toBe(1);
		expect(completed?.errorCount).toBe(0);
		expect(completed?.ingested).toBe(0);

		expect(monitors).toHaveLength(4);
	});
});

/**
 * What a completed check reports, beyond its stored row: one Analytics Engine point, and
 * one billable ping folded into the sweep's single ingestion call. Both are keyed on a
 * check that finished, which is what keeps a failed lookup off the bill.
 */
describe("checkDns ping reporting", () => {
	/** Every event the sweep handed Polar, flattened across the calls it made. */
	function ingestedEvents(): IngestEvent[] {
		return ingestEventsSafeMock.mock.calls.flatMap(([events]) => events);
	}

	/**
	 * The monitor each data point was written for, in the order the sweep wrote them. A
	 * non-string blob reads as empty text, turning a mismatch into a visible assertion
	 * failure.
	 */
	function pingedMonitorIds(): string[] {
		return pingResults.dataPoints.map((point) => {
			let blob = point.blobs?.[0];
			return typeof blob === "string" ? blob : "";
		});
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
		await seedRecord(db, monitor.id, {});

		sweepDnsNameMock.mockImplementation(async (name: string) =>
			sweepOf(name, [answered(name, "A", ["5.6.7.8"], 42)]),
		);

		await runJob(db);

		/**
		 * `changed` is DNS's own vocabulary; every reader filters to one ping type before
		 * comparing statuses, so each vocabulary stays independent of the other.
		 */
		expect(pingResults.dataPoints).toEqual([
			{
				blobs: [monitor.id, "dns", "changed"],
				doubles: [42, 1, 0, 0],
				indexes: ["team-1"],
			},
		]);
	});

	test("bills one ping per monitor per check, however many queries the sweep made", async () => {
		let { db } = createTestDatabase();
		await seedTeam(db, "team-1", "owner-1");
		let monitor = await seedMonitor(db);
		await seedNames(db, monitor.id, 12, "billing.example.com");

		await runJob(db);

		/**
		 * Twelve tracked names plus the apex is 78 queries and exactly one ping: the public
		 * resolver charges per lookup at zero, so a sweep costs what any other check costs.
		 */
		expect(sweepDnsNameMock).toHaveBeenCalledTimes(13);
		let events = ingestedEvents();
		expect(events).toHaveLength(1);
		expect(events[0]?.externalId).toBe(`ping:${await resultId(db, monitor.id)}`);
	});

	test("bills every check the sweep completed in a single ingestion call", async () => {
		let { db } = createTestDatabase();
		await seedTeam(db, "team-1", "owner-1");
		let first = await seedMonitor(db, { domain: "one.example.com" });
		let second = await seedMonitor(db, { domain: "two.example.com" });
		let third = await seedMonitor(db, { domain: "three.example.com" });

		let job = await runJob(db);

		/** One call, three pings — a sweep of eighty monitors still costs a single subrequest. */
		expect(ingestEventsSafeMock).toHaveBeenCalledTimes(1);
		let events = ingestedEvents();
		expect(events).toHaveLength(3);
		expect(
			events.map((event) => String(event.metadata?.monitorId)).sort((a, b) => a.localeCompare(b)),
		).toEqual([first.id, second.id, third.id].sort((a, b) => a.localeCompare(b)));
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

		/**
		 * The row id is the only thing about a completed check that is unique and already
		 * persisted, so it's what Polar dedupes a re-recorded check on: one check, one ping.
		 */
		expect(ingestedEvents()[0]?.externalId).toBe(`ping:${await resultId(db, monitor.id)}`);
	});

	test("skips a monitor whose team names no owner without failing the sweep", async () => {
		let { db } = createTestDatabase();
		await seedTeam(db, "team-1", "owner-1");
		let billable = await seedMonitor(db, { domain: "billable.example.com" });
		/** A team row that's gone, leaving the ping without a Polar customer to bill. */
		let orphan = await seedMonitor(db, { domain: "orphan.example.com" }, "team-2");

		let job = await runJob(db);

		expect(ingestedEvents().map((event) => event.metadata?.monitorId)).toEqual([billable.id]);
		let unbillable = job.logger.events.find(
			(event) => event.event === "job.check_dns.unbillable_team",
		);
		expect(unbillable?.monitorId).toBe(orphan.id);
		expect(unbillable?.teamId).toBe("team-2");

		/**
		 * Its check still ran, was still recorded, and still counts as a success; the missing
		 * customer costs it just the ping's billing.
		 */
		expect(pingedMonitorIds().sort((a, b) => a.localeCompare(b))).toEqual(
			[billable.id, orphan.id].sort((a, b) => a.localeCompare(b)),
		);
		expect(await DnsMonitor.listResults(db, orphan.id)).toHaveLength(1);
		let completed = job.logger.events.find((event) => event.event === "job.check_dns.completed");
		expect(completed?.successCount).toBe(2);
		expect(completed?.ingested).toBe(1);
	});

	test("a check that threw produces neither a data point nor a ping", async () => {
		let { db } = createTestDatabase();
		await seedTeam(db, "team-1", "owner-1");
		let failing = await seedMonitor(db, { domain: "fails.example.com" });
		let healthy = await seedMonitor(db, { domain: "ok.example.com" });

		let listNames = vi
			.spyOn(DnsMonitorRecord, "listNames")
			.mockImplementation(async (_db: Database, monitorId: string) => {
				if (monitorId === failing.id) throw new Error("D1 read failed");
				return [];
			});

		try {
			await runJob(db);

			/** A check that threw leaves no result row, so the ping report has nothing to key on. */
			expect(pingedMonitorIds()).toEqual([healthy.id]);
			expect(ingestedEvents().map((event) => event.metadata?.monitorId)).toEqual([healthy.id]);
		} finally {
			listNames.mockRestore();
		}
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
