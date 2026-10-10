/**
 * Tests the DNS monitor records model, above all the classification: a record that vanished,
 * one that appeared, the one attributable change, an RRset that grew or shrank, an unchanged
 * sweep, and the two cases it stays silent on — a declined record and a failed query.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { unwrap } from "@sdxc/result";
import { beforeEach, describe, expect, test } from "vitest";

import type { UptimeModels } from "~/app/models";
import type { DnsQueryAnswer, DnsRecordImport } from "~/app/models/dns-monitor-records";

import { createTestDatabase } from "~/app/lib/test/db";
import { bindModels, recordJobs } from "~/app/lib/test/models";
import { summarizeDnsRecordDiff } from "~/app/models/dns-monitor-records";

let db: Database;
let models: UptimeModels;
let monitorId: string;

beforeEach(async () => {
	db = createTestDatabase().db;
	models = bindModels(db, recordJobs().jobs);
	let monitor = unwrap(
		await models.dnsMonitors.create({
			team_id: "team-1",
			name: "Example domain",
			domain: "example.com",
		}),
	);
	monitorId = monitor.id;
});

/** A watched record as discovery imported it: resolved, enabled, `ok`. */
function watched(overrides: Partial<DnsRecordImport> = {}): DnsRecordImport {
	return {
		name: "example.com",
		record_type: "MX",
		value: "10 mx1.example.com",
		source: "resolver",
		is_enabled: true,
		status: "ok",
		last_seen_at: Date.now(),
		...overrides,
	};
}

/** One answered query. A `(name, type)` a sweep omits stands for a query that failed. */
function answer(recordType: DnsQueryAnswer["record_type"], values: string[]): DnsQueryAnswer {
	return { name: "example.com", record_type: recordType, values };
}

/** The stored record with this value, for asserting on what a diff wrote. */
async function stored(value: string) {
	let records = await models.dnsMonitorRecords.listByMonitor(monitorId);
	return records.find((record) => record.value === value) ?? null;
}

describe("dnsMonitorRecords.importMany", () => {
	test("imports records with the state the importing channel gave them", async () => {
		let imported = await models.dnsMonitorRecords.importMany(monitorId, [
			watched(),
			watched({
				name: "_dmarc.example.com",
				record_type: "TXT",
				value: "v=DMARC1; p=none;",
				source: "zone_file",
				is_enabled: false,
				status: "missing",
				last_seen_at: null,
			}),
		]);

		expect(imported).toBe(2);

		let records = await models.dnsMonitorRecords.listByMonitor(monitorId);
		expect(records.map((record) => record.name)).toEqual(["_dmarc.example.com", "example.com"]);
		expect(records[0]?.source).toBe("zone_file");
		expect(records[0]?.is_enabled).toBeFalsy();
		expect(records[0]?.status).toBe("missing");
		expect(records[0]?.last_seen_at).toBeNull();
		expect(records[1]?.is_enabled).toBeTruthy();
	});

	/**
	 * A real exported zone can carry the same `(name, type, value)` on two lines — DNS
	 * itself dedupes, so the two are one record — and the import absorbs that so a valid
	 * customer zone pastes cleanly.
	 */
	test("absorbs a duplicate identity inside one import", async () => {
		let line = watched({
			name: "_dmarc.example.com",
			record_type: "TXT",
			value: "v=DMARC1; p=none;",
			source: "zone_file",
		});

		let imported = await models.dnsMonitorRecords.importMany(monitorId, [line, line]);

		expect(imported).toBe(1);
		expect(await models.dnsMonitorRecords.forMonitor(monitorId).count()).toBe(1);
	});

	/**
	 * Re-pasting a zone file preserves the user's review: a record they declined stays
	 * declined, so the choice outlives every later import.
	 */
	test("never overwrites the state of a record it already has", async () => {
		await models.dnsMonitorRecords.importMany(monitorId, [watched({ is_enabled: false })]);

		let imported = await models.dnsMonitorRecords.importMany(monitorId, [
			watched({ is_enabled: true }),
		]);

		expect(imported).toBe(0);
		expect((await stored("10 mx1.example.com"))?.is_enabled).toBeFalsy();
	});

	test("imports more records than one statement's parameters allow", async () => {
		let records = Array.from({ length: 25 }, (_, index) =>
			watched({ record_type: "A", value: `10.0.0.${index}` }),
		);

		expect(await models.dnsMonitorRecords.importMany(monitorId, records)).toBe(25);
		expect(await models.dnsMonitorRecords.forMonitor(monitorId).count()).toBe(25);
	});
});

describe("dnsMonitorRecords.listNames", () => {
	test("lists each tracked name once, which is the set a sweep queries", async () => {
		await models.dnsMonitorRecords.importMany(monitorId, [
			watched({ record_type: "A", value: "1.2.3.4" }),
			watched({ record_type: "A", value: "5.6.7.8" }),
			watched({ name: "_dmarc.example.com", record_type: "TXT", value: "v=DMARC1; p=none;" }),
		]);

		expect(await models.dnsMonitorRecords.listNames(monitorId)).toEqual([
			"_dmarc.example.com",
			"example.com",
		]);
	});

	test("lists nothing for a monitor whose records belong to another monitor", async () => {
		let other = unwrap(
			await models.dnsMonitors.create({ team_id: "team-1", name: "Other", domain: "other.com" }),
		);
		await models.dnsMonitorRecords.importMany(other.id, [watched({ name: "other.com" })]);

		expect(await models.dnsMonitorRecords.listNames(monitorId)).toEqual([]);
	});
});

describe("dnsMonitorRecords.diff", () => {
	test("classifies a watched record that still resolves as ok", async () => {
		await models.dnsMonitorRecords.importMany(monitorId, [watched()]);

		let diff = await models.dnsMonitorRecords.diff(monitorId, [
			answer("MX", ["10 mx1.example.com"]),
		]);

		expect(diff.ok.map((record) => record.value)).toEqual(["10 mx1.example.com"]);
		expect(summarizeDnsRecordDiff(diff)).toEqual({
			recordsChecked: 1,
			recordsChanged: 0,
			recordsMissing: 0,
			recordsNew: 0,
		});
	});

	test("classifies a watched record that stopped resolving as missing", async () => {
		await models.dnsMonitorRecords.importMany(monitorId, [watched()]);

		let diff = await models.dnsMonitorRecords.diff(monitorId, [answer("MX", [])]);

		expect(diff.missing.map((record) => record.value)).toEqual(["10 mx1.example.com"]);
		expect(diff.ok).toEqual([]);
		expect(summarizeDnsRecordDiff(diff).recordsMissing).toBe(1);
	});

	test("classifies a value with no stored record as new", async () => {
		let diff = await models.dnsMonitorRecords.diff(monitorId, [
			answer("MX", ["10 mx1.example.com"]),
		]);

		expect(diff.created).toEqual([
			{ name: "example.com", record_type: "MX", value: "10 mx1.example.com" },
		]);
		expect(summarizeDnsRecordDiff(diff).recordsNew).toBe(1);
	});

	/**
	 * The one edit a diff attributes without guessing: one stored record, one resolved
	 * value, both differing. Larger sets read as missing-plus-new, because a record's
	 * value is the only identity it has.
	 */
	test("pairs a lone stored record with a lone resolved value as changed", async () => {
		await models.dnsMonitorRecords.importMany(monitorId, [watched()]);

		let diff = await models.dnsMonitorRecords.diff(monitorId, [
			answer("MX", ["20 mx2.example.com"]),
		]);

		expect(diff.changed).toHaveLength(1);
		expect(diff.changed[0]?.record.value).toBe("10 mx1.example.com");
		expect(diff.changed[0]?.value).toBe("20 mx2.example.com");
		expect(diff.missing).toEqual([]);
		expect(diff.created).toEqual([]);
	});

	/**
	 * An RRset growing from five values to six is the case record-level identity exists
	 * for: the sixth reads as one addition and the other five stay untouched, so the
	 * finding names the record that appeared.
	 */
	test("attributes a grown RRset to the record that appeared", async () => {
		let values = ["10 a.example.com", "20 b.example.com", "30 c.example.com"];
		await models.dnsMonitorRecords.importMany(
			monitorId,
			values.map((value) => watched({ value })),
		);

		let diff = await models.dnsMonitorRecords.diff(monitorId, [
			answer("MX", [...values, "40 d.example.com"]),
		]);

		expect(diff.ok).toHaveLength(3);
		expect(diff.created).toEqual([
			{ name: "example.com", record_type: "MX", value: "40 d.example.com" },
		]);
		expect(diff.missing).toEqual([]);
		expect(diff.changed).toEqual([]);
	});

	test("attributes a shrunk RRset to the record that went", async () => {
		let values = ["10 a.example.com", "20 b.example.com", "30 c.example.com"];
		await models.dnsMonitorRecords.importMany(
			monitorId,
			values.map((value) => watched({ value })),
		);

		let diff = await models.dnsMonitorRecords.diff(monitorId, [answer("MX", values.slice(0, 2))]);

		expect(diff.missing.map((record) => record.value)).toEqual(["30 c.example.com"]);
		expect(diff.ok).toHaveLength(2);
		expect(diff.created).toEqual([]);
	});

	/**
	 * The accepted cost of identifying a record by its value, documented here because the next
	 * reader will file it as a bug: editing one value inside a multi-record RRset is, at the
	 * protocol level, indistinguishable from a delete plus an add, so that is what it reads as.
	 */
	test("reads an edit inside a multi-record RRset as one missing plus one new", async () => {
		await models.dnsMonitorRecords.importMany(monitorId, [
			watched({ value: "10 a.example.com" }),
			watched({ value: "20 b.example.com" }),
		]);

		let diff = await models.dnsMonitorRecords.diff(monitorId, [
			answer("MX", ["10 a.example.com", "20 renamed.example.com"]),
		]);

		expect(diff.missing.map((record) => record.value)).toEqual(["20 b.example.com"]);
		expect(diff.created.map((record) => record.value)).toEqual(["20 renamed.example.com"]);
		expect(diff.changed).toEqual([]);
	});

	test("finds nothing in an unchanged sweep across several names and types", async () => {
		await models.dnsMonitorRecords.importMany(monitorId, [
			watched({ record_type: "A", value: "1.2.3.4" }),
			watched({ record_type: "A", value: "5.6.7.8" }),
			watched({ record_type: "NS", value: "ns1.example.com" }),
			watched({ name: "_dmarc.example.com", record_type: "TXT", value: "v=DMARC1; p=none;" }),
		]);

		let diff = await models.dnsMonitorRecords.diff(monitorId, [
			answer("A", ["1.2.3.4", "5.6.7.8"]),
			answer("NS", ["ns1.example.com"]),
			{ name: "_dmarc.example.com", record_type: "TXT", values: ["v=DMARC1; p=none;"] },
		]);

		expect(diff.ok).toHaveLength(4);
		expect(diff.missing).toEqual([]);
		expect(diff.created).toEqual([]);
		expect(diff.changed).toEqual([]);
	});

	/**
	 * Guards a whole zone against a resolver's bad minute: a failed query stays out of
	 * the sweep, and classification covers exactly the `(name, type)` pairs the sweep
	 * answered.
	 */
	test("classifies nothing for a name and type the sweep never answered", async () => {
		await models.dnsMonitorRecords.importMany(monitorId, [
			watched({ record_type: "A", value: "1.2.3.4" }),
			watched({ record_type: "MX", value: "10 mx1.example.com" }),
		]);

		let diff = await models.dnsMonitorRecords.diff(monitorId, [answer("A", ["1.2.3.4"])]);

		expect(diff.ok).toHaveLength(1);
		expect(diff.missing).toEqual([]);
		expect(diff.absent).toEqual([]);
	});

	test("classifies nothing at all for a sweep that answered no query", async () => {
		await models.dnsMonitorRecords.importMany(monitorId, [watched()]);

		expect(await models.dnsMonitorRecords.diff(monitorId, [])).toEqual({
			ok: [],
			missing: [],
			changed: [],
			created: [],
			seen: [],
			absent: [],
		});
	});

	/**
	 * A declined record stays out of the findings, and the value that replaced it is
	 * still an appearance worth announcing.
	 */
	test("never reports a declined record as missing or changed", async () => {
		await models.dnsMonitorRecords.importMany(monitorId, [
			watched({ record_type: "A", value: "1.2.3.4", is_enabled: false, status: "new" }),
			watched({ record_type: "NS", value: "ns1.example.com", is_enabled: false, status: "new" }),
		]);

		let diff = await models.dnsMonitorRecords.diff(monitorId, [
			answer("A", ["1.2.3.4"]),
			answer("NS", ["ns9.example.com"]),
		]);

		expect(diff.seen.map((record) => record.value)).toEqual(["1.2.3.4"]);
		expect(diff.absent.map((record) => record.value)).toEqual(["ns1.example.com"]);
		expect(diff.missing).toEqual([]);
		expect(diff.changed).toEqual([]);
		expect(diff.created.map((record) => record.value)).toEqual(["ns9.example.com"]);
		expect(summarizeDnsRecordDiff(diff)).toEqual({
			recordsChecked: 3,
			recordsChanged: 0,
			recordsMissing: 0,
			recordsNew: 1,
		});
	});

	/**
	 * A zone file and a resolver answer disagree for blameless reasons — a proxied record
	 * lives only in DNS, a retired name lives only in the export — so classification is a
	 * pure function of the two sets, and a declined record stays declined.
	 */
	test("classifies an imported zone against a first sweep that shares nothing with it", async () => {
		await models.dnsMonitorRecords.importMany(monitorId, [
			watched({
				record_type: "A",
				value: "203.0.113.10",
				source: "zone_file",
				is_enabled: false,
				status: "missing",
				last_seen_at: null,
			}),
		]);

		let diff = await models.dnsMonitorRecords.diff(monitorId, [
			answer("A", ["104.16.0.1", "104.16.0.2"]),
		]);

		expect(diff.absent.map((record) => record.value)).toEqual(["203.0.113.10"]);
		expect(diff.missing).toEqual([]);
		expect(diff.created.map((record) => record.value)).toEqual(["104.16.0.1", "104.16.0.2"]);
	});

	test("reads a repeated value in one answer as the single record it is", async () => {
		let diff = await models.dnsMonitorRecords.diff(monitorId, [
			answer("TXT", ["v=spf1 -all", "v=spf1 -all"]),
		]);

		expect(diff.created).toHaveLength(1);
	});

	test("reads only the records of the monitor being diffed", async () => {
		let other = unwrap(
			await models.dnsMonitors.create({ team_id: "team-1", name: "Other", domain: "example.com" }),
		);
		await models.dnsMonitorRecords.importMany(other.id, [watched()]);

		let diff = await models.dnsMonitorRecords.diff(monitorId, [
			answer("MX", ["10 mx1.example.com"]),
		]);

		expect(diff.ok).toEqual([]);
		expect(diff.created).toHaveLength(1);
	});
});

describe("dnsMonitorRecords.applyDiff", () => {
	/** A missing record advances `last_checked_at`, and `last_seen_at` holds. */
	test("stamps a record that resolved and marks one that did not", async () => {
		await models.dnsMonitorRecords.importMany(monitorId, [
			watched({ value: "10 a.example.com", last_seen_at: 1000 }),
			watched({ value: "20 b.example.com", last_seen_at: 1000 }),
		]);

		let diff = await models.dnsMonitorRecords.diff(monitorId, [answer("MX", ["10 a.example.com"])]);
		await models.dnsMonitorRecords.applyDiff(monitorId, diff, 5000);

		expect(await stored("10 a.example.com")).toMatchObject({
			status: "ok",
			last_seen_at: 5000,
			last_checked_at: 5000,
		});
		expect(await stored("20 b.example.com")).toMatchObject({
			status: "missing",
			last_seen_at: 1000,
			last_checked_at: 5000,
		});
	});

	test("imports a newly discovered record disabled, so accepting it is a decision", async () => {
		let diff = await models.dnsMonitorRecords.diff(monitorId, [
			answer("MX", ["10 mx1.example.com"]),
		]);
		await models.dnsMonitorRecords.applyDiff(monitorId, diff, 5000);

		let record = await stored("10 mx1.example.com");
		expect(record).toMatchObject({
			status: "new",
			source: "resolver",
			first_seen_at: 5000,
			last_seen_at: 5000,
		});
		expect(record?.is_enabled).toBeFalsy();
	});

	/**
	 * `new` is a state of the record itself: it stands until the user enables or deletes
	 * the row, so a later check finding the same unwanted record leaves it on the list
	 * of what needs attention.
	 */
	test("leaves a declined record's status alone on a later check", async () => {
		let first = await models.dnsMonitorRecords.diff(monitorId, [
			answer("MX", ["10 mx1.example.com"]),
		]);
		await models.dnsMonitorRecords.applyDiff(monitorId, first, 5000);

		let second = await models.dnsMonitorRecords.diff(monitorId, [
			answer("MX", ["10 mx1.example.com"]),
		]);
		await models.dnsMonitorRecords.applyDiff(monitorId, second, 9000);

		let record = await stored("10 mx1.example.com");
		expect(record).toMatchObject({
			status: "new",
			last_seen_at: 9000,
			last_checked_at: 9000,
		});
		expect(record?.is_enabled).toBeFalsy();
		expect(await models.dnsMonitorRecords.forMonitor(monitorId).count()).toBe(1);
	});

	test("rewrites the paired record in place rather than replacing it", async () => {
		await models.dnsMonitorRecords.importMany(monitorId, [watched()]);
		let [before] = await models.dnsMonitorRecords.listByMonitor(monitorId);

		let diff = await models.dnsMonitorRecords.diff(monitorId, [
			answer("MX", ["20 mx2.example.com"]),
		]);
		await models.dnsMonitorRecords.applyDiff(monitorId, diff, 5000);

		let records = await models.dnsMonitorRecords.listByMonitor(monitorId);
		expect(records).toHaveLength(1);
		expect(records[0]?.id).toBe(before?.id ?? "");
		expect(records[0]).toMatchObject({
			value: "20 mx2.example.com",
			status: "changed",
			last_seen_at: 5000,
		});
	});

	test("stamps a declined record it saw without touching its status", async () => {
		await models.dnsMonitorRecords.importMany(monitorId, [
			watched({ is_enabled: false, status: "new", last_seen_at: 1000 }),
		]);

		let diff = await models.dnsMonitorRecords.diff(monitorId, [
			answer("MX", ["10 mx1.example.com"]),
		]);
		await models.dnsMonitorRecords.applyDiff(monitorId, diff, 5000);

		expect(await stored("10 mx1.example.com")).toMatchObject({
			status: "new",
			last_seen_at: 5000,
			last_checked_at: 5000,
		});
	});
});

describe("dnsMonitorRecords.setEnabled", () => {
	test("settles a record accepted from review, and leaves the rest of the review alone", async () => {
		await models.dnsMonitorRecords.importMany(monitorId, [
			watched({ value: "10 a.example.com", is_enabled: false, status: "new" }),
			watched({ value: "20 b.example.com", is_enabled: false, status: "new" }),
		]);
		let accepted = await stored("10 a.example.com");

		await models.dnsMonitorRecords.setEnabled(monitorId, [accepted?.id ?? ""], true);

		let enabled = await stored("10 a.example.com");
		expect(enabled?.is_enabled).toBeTruthy();
		expect(enabled?.status).toBe("ok");

		let untouched = await stored("20 b.example.com");
		expect(untouched?.is_enabled).toBeFalsy();
		expect(untouched?.status).toBe("new");
	});

	/**
	 * Enabling a zone-file record still awaiting its first sighting leaves it `missing`,
	 * which is true and is the reason the user enabled it.
	 */
	test("keeps every status other than new when enabling", async () => {
		await models.dnsMonitorRecords.importMany(monitorId, [
			watched({ is_enabled: false, status: "missing", source: "zone_file", last_seen_at: null }),
		]);
		let record = await stored("10 mx1.example.com");

		await models.dnsMonitorRecords.setEnabled(monitorId, [record?.id ?? ""], true);

		let enabled = await stored("10 mx1.example.com");
		expect(enabled?.is_enabled).toBeTruthy();
		expect(enabled?.status).toBe("missing");
	});

	test("disables without rewriting the status", async () => {
		await models.dnsMonitorRecords.importMany(monitorId, [watched()]);
		let record = await stored("10 mx1.example.com");

		await models.dnsMonitorRecords.setEnabled(monitorId, [record?.id ?? ""], false);

		let disabled = await stored("10 mx1.example.com");
		expect(disabled?.is_enabled).toBeFalsy();
		expect(disabled?.status).toBe("ok");
	});

	test("ignores an id belonging to another monitor", async () => {
		let other = unwrap(
			await models.dnsMonitors.create({ team_id: "team-1", name: "Other", domain: "other.com" }),
		);
		await models.dnsMonitorRecords.importMany(other.id, [
			watched({ name: "other.com", is_enabled: false, status: "new" }),
		]);
		let [record] = await models.dnsMonitorRecords.listByMonitor(other.id);

		await models.dnsMonitorRecords.setEnabled(monitorId, [record?.id ?? ""], true);

		let [unchanged] = await models.dnsMonitorRecords.listByMonitor(other.id);
		expect(unchanged?.is_enabled).toBeFalsy();
		expect(unchanged?.status).toBe("new");
	});
});
