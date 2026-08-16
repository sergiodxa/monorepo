/**
 * Tests the shared DNS discovery and check pipeline directly: the names a check plans, the
 * accounting a sweep does for queries that failed or were never made, the import that turns a
 * pasted zone into records, and the check that diffs, applies and records one result row.
 *
 * The property this file exists for is the last suite: a monitor swept by the scheduled job
 * and the same monitor swept by an on-demand check must produce the same result row and leave
 * the record table in the same state, because both run this module. The two used to be two
 * implementations of one thing, and the way that goes wrong is silent — a customer pressing
 * "Check now" is told something the hourly run never says.
 *
 * `sweepDnsName` is mocked, since DNS resolution has tests of its own, and the bindings the
 * job reaches for are in-memory ones installed through `cloudflare:workers`, so it can be run
 * in-process alongside the direct calls.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, mock, test } from "bun:test";

import type { AnalyticsEngineMock, QueueMock } from "@pkg/cloudflare-mocks";

import { createAnalyticsEngine, createEnv, createQueue } from "@pkg/cloudflare-mocks";
import { BatchedLogger } from "@pkg/logger";
import { Mailer } from "@pkg/mail";
import { MemoryTransport } from "@pkg/mail/memory";
import { PolarClient } from "@pkg/polar";
import { ServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";

import type { DnsRecordType } from "~/app/lib/dns-record-value";
import type { NotifyMessage } from "~/app/lib/notify-queue";
import type { DnsCheckStatus, DnsNameSweep, DnsQueryOutcome } from "~/app/services/dns-check";

import DnsMonitor from "~/app/data/dns-monitor";
import DnsMonitorRecord from "~/app/data/dns-monitor-record";
import { MAIL_FROM } from "~/app/emails/sender";
import { createTestDatabase } from "~/app/lib/test/db";
import { dnsMonitors } from "~/database/schema";

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

/** Resolves nothing and fails nothing: no answers means no diff, so a check reads `ok`. */
let sweepDnsNameMock = mock(async (name: string): Promise<DnsNameSweep> => sweepOf(name, []));

/** Where the job's status-change notifications land, and where its checks are reported. */
let queue: QueueMock<NotifyMessage> = createQueue<NotifyMessage>({ name: "notify" });
let pingResults: AnalyticsEngineMock = createAnalyticsEngine();

mock.module("cloudflare:workers", () => ({
	env: createEnv<Env>({ QUEUE: queue, PING_RESULTS: pingResults }),
}));

let realDnsCheckModule = await import("~/app/services/dns-check");

mock.module("~/app/services/dns-check", () => ({
	...realDnsCheckModule,
	sweepDnsName: sweepDnsNameMock,
}));

let { QUERIES_PER_NAME } = realDnsCheckModule;
let {
	INVOCATION_QUERY_BUDGET,
	MAX_NAMES_PER_CHECK,
	MAX_TRACKED_NAMES_PER_MONITOR,
	importDiscovery,
	planDnsCheck,
	recordDnsCheck,
	runDnsCheck,
	sweepNames,
} = await import("./dns-discovery");
let { CheckDnsJob } = await import("~/app/jobs/check-dns");

async function seedMonitor(db: Database, domain: string, teamId = "team-1") {
	return await DnsMonitor.create(db, teamId, { name: domain, domain, is_enabled: true });
}

/** Gives a monitor tracked names, which is what a check plans its sweep from. */
async function seedNames(db: Database, monitorId: string, names: readonly string[]) {
	await DnsMonitorRecord.importMany(
		db,
		monitorId,
		names.map((name, index) => ({
			name,
			record_type: "A" as const,
			value: `10.0.0.${index}`,
			source: "resolver" as const,
			is_enabled: true,
			status: "ok" as const,
			last_seen_at: Date.now(),
		})),
	);
}

beforeEach(() => {
	sweepDnsNameMock.mockReset();
	sweepDnsNameMock.mockImplementation(async (name: string) => sweepOf(name, []));
	queue.reset();
	pingResults.reset();
});

/**
 * The caps every DNS surface quotes. They are asserted against each other rather than against
 * their literal values because the numbers are allowed to move — what is not allowed is for
 * the import cap to drift above what one check can afford, which would accept zones that are
 * truncated on every check forever.
 */
describe("dns limits", () => {
	test("a monitor filled to the import cap is sweepable whole in one invocation", () => {
		expect(MAX_NAMES_PER_CHECK).toBe(Math.floor(INVOCATION_QUERY_BUDGET / QUERIES_PER_NAME));
		expect(MAX_TRACKED_NAMES_PER_MONITOR).toBe(MAX_NAMES_PER_CHECK);
		expect(MAX_TRACKED_NAMES_PER_MONITOR * QUERIES_PER_NAME).toBeLessThanOrEqual(
			INVOCATION_QUERY_BUDGET,
		);
	});
});

describe("planDnsCheck", () => {
	test("always plans the apex, even for a monitor whose tracked names are all elsewhere", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db, "example.com");
		await seedNames(db, monitor.id, ["www.example.com", "mail.example.com"]);

		let plan = await planDnsCheck(db, monitor.id, monitor.domain);

		// The apex is the one name we know without being told, so a record appearing there is
		// discoverable even when nothing at it has ever been imported.
		expect(plan.names).toContain("example.com");
		expect(plan.names).toHaveLength(3);
		expect(plan.tracked).toBe(2);
		expect(plan.overflow).toBe(0);
	});

	test("plans the apex alone, and reports nothing tracked, for a monitor nobody imported into", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db, "unimported.example.com");

		let plan = await planDnsCheck(db, monitor.id, monitor.domain);

		expect(plan.names).toEqual(["unimported.example.com"]);
		expect(plan.tracked).toBe(0);
	});

	test("caps the plan and reports the remainder rather than sweeping past the budget", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db, "big.example.com");
		await seedNames(
			db,
			monitor.id,
			Array.from({ length: MAX_NAMES_PER_CHECK + 5 }, (_, index) => `n${index}.big.example.com`),
		);

		let plan = await planDnsCheck(db, monitor.id, monitor.domain);

		expect(plan.names).toHaveLength(MAX_NAMES_PER_CHECK);
		// Six over: the five past the cap plus the apex the cap pushed out.
		expect(plan.overflow).toBe(6);
	});
});

describe("sweepNames", () => {
	test("counts a name whose sweep threw as its whole set of failed queries", async () => {
		sweepDnsNameMock.mockImplementation(async (name: string) => {
			if (name === "broken.example.com") throw new Error("fetch failed");
			return sweepOf(name, [answered(name, "A", ["1.2.3.4"])]);
		});

		let sweep = await sweepNames(["ok.example.com", "broken.example.com"]);

		// Not "answered with nothing": the two mean opposite things, and reporting the second
		// would say every record at that name had vanished.
		expect(sweep.queriesFailed).toBe(QUERIES_PER_NAME);
		expect(sweep.answers.map((answer) => answer.name)).toEqual(["ok.example.com"]);
		expect(sweep.errorMessage).toBe("fetch failed");
	});

	test("reports no latency at all when not one name was reached", async () => {
		sweepDnsNameMock.mockImplementation(async () => {
			throw new Error("fetch failed");
		});

		let sweep = await sweepNames(["a.example.com"]);

		// The column is nullable for exactly this: a zero would read as an instant answer.
		expect(sweep.responseTimeMs).toBeNull();
	});
});

describe("importDiscovery", () => {
	test("watches what resolved and stores what the zone only declared unwatched", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db, "example.com");

		sweepDnsNameMock.mockImplementation(async (name: string) =>
			sweepOf(name, [answered(name, "A", ["1.2.3.4"])]),
		);

		let discovery = await importDiscovery(
			db,
			monitor.id,
			["example.com"],
			[{ name: "example.com", type: "TXT", value: "v=spf1 -all", line: 1 }],
		);

		expect(discovery.imported).toBe(2);

		let records = await DnsMonitorRecord.listByMonitor(db, monitor.id);
		let resolved = records.find((record) => record.record_type === "A");
		let declared = records.find((record) => record.record_type === "TXT");

		// An import-time discovery enables everything it resolved: the user is present, looking
		// at the review screen, and about to decide.
		expect(resolved?.is_enabled).toBeTruthy();
		expect(resolved?.status).toBe("ok");
		// A declared record nothing answers for is high-signal at import and worthless as a
		// standing alert, so it is stored as a finding rather than as an expectation.
		expect(declared?.is_enabled).toBeFalsy();
		expect(declared?.status).toBe("missing");
	});

	test("never re-enables a record the user declined", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db, "example.com");

		sweepDnsNameMock.mockImplementation(async (name: string) =>
			sweepOf(name, [answered(name, "A", ["1.2.3.4"])]),
		);

		await importDiscovery(db, monitor.id, ["example.com"]);
		let [record] = await DnsMonitorRecord.listByMonitor(db, monitor.id);
		await DnsMonitorRecord.setEnabled(db, monitor.id, [record!.id], false);

		let discovery = await importDiscovery(db, monitor.id, ["example.com"]);

		// Nothing is news on a re-import, and "I chose not to watch this" is not a setting that
		// expires because an unrelated import ran.
		expect(discovery.imported).toBe(0);
		let [after] = await DnsMonitorRecord.listByMonitor(db, monitor.id);
		expect(after?.is_enabled).toBeFalsy();
	});
});

describe("recordDnsCheck", () => {
	test("counts names the caller could not afford as queries that did not answer", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db, "example.com");
		await seedNames(db, monitor.id, ["example.com"]);

		let run = await recordDnsCheck(db, monitor.id, ["example.com"], 3);

		expect(run.queriesFailed).toBe(3 * QUERIES_PER_NAME);
		// Partial, and reported as partial: a name nobody looked at must never read as a
		// record that is gone.
		expect(run.status).toBe("error");
		expect(run.counts.recordsMissing).toBe(0);

		let [result] = await DnsMonitor.listResults(db, monitor.id);
		expect(result?.queries_failed).toBe(3 * QUERIES_PER_NAME);
		// No sentence of ours: this job has no request, no locale and no way to get one, so
		// `queries_failed` is what says the sweep was cut short.
		expect(result?.error_message).toBeNull();
	});

	test("imports a record discovered by a later check disabled", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db, "example.com");

		sweepDnsNameMock.mockImplementation(async (name: string) =>
			sweepOf(name, [answered(name, "TXT", ["v=spf1 -all"])]),
		);

		let run = await recordDnsCheck(db, monitor.id, ["example.com"]);

		expect(run.status).toBe("changed");
		expect(run.counts.recordsNew).toBe(1);
		// Accepting a record that appeared unannounced must be something the user did, not
		// something that happened by their not reading the email.
		let [stored] = await DnsMonitorRecord.listByMonitor(db, monitor.id);
		expect(stored?.is_enabled).toBeFalsy();
		expect(stored?.status).toBe("new");
	});

	test("reports error over changed, since a partial answer cannot be reported as findings", async () => {
		let { db } = createTestDatabase();
		let monitor = await seedMonitor(db, "example.com");
		await seedNames(db, monitor.id, ["example.com"]);

		sweepDnsNameMock.mockImplementation(async (name: string) =>
			sweepOf(name, [answered(name, "A", ["5.6.7.8"]), failed(name, "TXT")]),
		);

		let run = await recordDnsCheck(db, monitor.id, ["example.com"]);

		expect(run.status).toBe("error");
		expect(run.counts.recordsChanged).toBe(1);
		expect(run.queriesFailed).toBe(1);
	});
});

/**
 * The property this reconciliation exists to guarantee. A scheduled check and an on-demand
 * check are the same event: they must write the same row and leave the same records behind,
 * with the job's budget and deferral the only thing either may add.
 */
describe("scheduled and on-demand checks", () => {
	/** The result row's contents, minus the ids and timestamps two checks cannot share. */
	async function resultOf(db: Database, monitorId: string) {
		let results = await DnsMonitor.listResults(db, monitorId);
		expect(results).toHaveLength(1);
		let [result] = results;

		return {
			status: result?.status,
			recordsChecked: result?.records_checked,
			recordsChanged: result?.records_changed,
			recordsMissing: result?.records_missing,
			recordsNew: result?.records_new,
			queriesFailed: result?.queries_failed,
			responseTimeMs: result?.response_time_ms,
			errorMessage: result?.error_message,
		};
	}

	/** What the check left in the record table, which is the other half of its output. */
	async function recordsOf(db: Database, monitorId: string) {
		let records = await DnsMonitorRecord.listByMonitor(db, monitorId);

		return records.map((record) => ({
			name: record.name,
			recordType: record.record_type,
			value: record.value,
			status: record.status,
			isEnabled: Boolean(record.is_enabled),
		}));
	}

	/**
	 * Checks one monitor through the job and an identical one through the on-demand path, then
	 * compares everything either of them wrote.
	 *
	 * The two monitors are seeded identically and share a domain, so the mocked resolver
	 * answers both the same way; the on-demand one is parked outside its interval so the job's
	 * claim cannot pick it up as well.
	 */
	async function expectSameOutcome(
		expected: DnsCheckStatus,
		seed: (db: Database, monitorId: string) => Promise<void>,
	) {
		let { db } = createTestDatabase();
		let scheduled = await seedMonitor(db, "example.com");
		let onDemand = await seedMonitor(db, "example.com", "team-2");
		await seed(db, scheduled.id);
		await seed(db, onDemand.id);
		await db.update(
			dnsMonitors,
			onDemand.id,
			{ next_due_at: Date.now() + 3_600_000 },
			{ touch: false },
		);

		let container = new ServiceContainer();
		container.singleton(Database, () => db);
		container.singleton(
			Mailer,
			() => new Mailer({ transport: new MemoryTransport(), from: MAIL_FROM }),
		);
		container.singleton(PolarClient, () => new PolarClient({ accessToken: "polar_at_test" }));
		await container.scope(() =>
			new CheckDnsJob({ logger: new BatchedLogger("test") }, {}).perform(),
		);

		let run = await runDnsCheck(db, onDemand.id, onDemand.domain);

		expect(await resultOf(db, onDemand.id)).toEqual(await resultOf(db, scheduled.id));
		expect(await recordsOf(db, onDemand.id)).toEqual(await recordsOf(db, scheduled.id));

		let checked = await DnsMonitor.findByIdForTeam(db, "team-2", onDemand.id);
		let swept = await DnsMonitor.findByIdForTeam(db, "team-1", scheduled.id);
		expect(checked?.last_status).toBe(swept?.last_status ?? null);
		// The run the caller gets back describes the row it wrote, so a meter event and an
		// alert built from it say the same thing the scheduled sweep's would.
		expect(String(run.status)).toBe(String(swept?.last_status));
		// Named per scenario so an equivalence that holds because neither path did anything
		// cannot pass for one that holds because both did the same thing.
		expect(run.status).toBe(expected);
	}

	test("agree on a monitor whose records all still resolve", async () => {
		sweepDnsNameMock.mockImplementation(async (name: string) =>
			sweepOf(name, [answered(name, "A", ["10.0.0.0"])]),
		);

		await expectSameOutcome("ok", (db, monitorId) => seedNames(db, monitorId, ["example.com"]));
	});

	test("agree on a changed record", async () => {
		sweepDnsNameMock.mockImplementation(async (name: string) =>
			sweepOf(name, [answered(name, "A", ["5.6.7.8"], 42)]),
		);

		await expectSameOutcome("changed", (db, monitorId) =>
			seedNames(db, monitorId, ["example.com"]),
		);
	});

	test("agree on a record that stopped resolving", async () => {
		sweepDnsNameMock.mockImplementation(async (name: string) =>
			sweepOf(name, [answered(name, "A", [])]),
		);

		await expectSameOutcome("changed", (db, monitorId) =>
			seedNames(db, monitorId, ["example.com"]),
		);
	});

	test("agree on a failed query, which neither may read as a missing record", async () => {
		sweepDnsNameMock.mockImplementation(async (name: string) =>
			sweepOf(name, [failed(name, "A"), answered(name, "TXT", ["v=spf1 -all"])]),
		);

		await expectSameOutcome("error", (db, monitorId) => seedNames(db, monitorId, ["example.com"]));
	});

	test("agree on a monitor tracking several names, apex included", async () => {
		sweepDnsNameMock.mockImplementation(async (name: string) =>
			sweepOf(name, [answered(name, "A", [`10.0.0.${name.length}`], name.length)]),
		);

		await expectSameOutcome("changed", (db, monitorId) =>
			seedNames(db, monitorId, ["www.example.com", "mail.example.com"]),
		);
	});
});
