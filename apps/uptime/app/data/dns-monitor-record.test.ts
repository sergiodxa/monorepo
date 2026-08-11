/**
 * Unit tests for the `DnsMonitorRecord` data-access model, and above all for the
 * classification: a record that vanished, one that appeared, the single attributable
 * one-to-one change, an RRset that grew, one that shrank, an unchanged sweep, and the two
 * cases that must produce no finding at all — a declined record, and a query that failed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { beforeEach, describe, expect, test } from "bun:test";

import type { Database } from "remix/data-table";

import type { DnsQueryAnswer, DnsRecordImport } from "~/app/data/dns-monitor-record";

import DnsMonitor from "~/app/data/dns-monitor";
import DnsMonitorRecord from "~/app/data/dns-monitor-record";
import { createTestDatabase } from "~/app/lib/test/db";

let db: Database;
let monitorId: string;

beforeEach(async () => {
	db = createTestDatabase().db;
	let monitor = await DnsMonitor.create(db, "team-1", {
		name: "Example domain",
		domain: "example.com",
	});
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

/** One answered query. Absence from a sweep is a failed query, never an empty answer. */
function answer(recordType: DnsQueryAnswer["record_type"], values: string[]): DnsQueryAnswer {
	return { name: "example.com", record_type: recordType, values };
}

/** The stored record with this value, for asserting on what a diff wrote. */
async function stored(value: string) {
	let records = await DnsMonitorRecord.listByMonitor(db, monitorId);
	return records.find((record) => record.value === value) ?? null;
}

describe("DnsMonitorRecord.importMany", () => {
	test("imports records with the state the importing channel gave them", async () => {
		let imported = await DnsMonitorRecord.importMany(db, monitorId, [
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

		let records = await DnsMonitorRecord.listByMonitor(db, monitorId);
		expect(records.map((record) => record.name)).toEqual(["_dmarc.example.com", "example.com"]);
		expect(records[0]?.source).toBe("zone_file");
		expect(records[0]?.is_enabled).toBeFalsy();
		expect(records[0]?.status).toBe("missing");
		expect(records[0]?.last_seen_at).toBeNull();
		expect(records[1]?.is_enabled).toBeTruthy();
	});

	/**
	 * A real exported zone can carry the same `(name, type, value)` on two lines — DNS itself
	 * dedupes, so the two are one record — and the import must absorb that rather than fail
	 * the whole paste on a valid customer zone.
	 */
	test("absorbs a duplicate identity inside one import", async () => {
		let line = watched({
			name: "_dmarc.example.com",
			record_type: "TXT",
			value: "v=DMARC1; p=none;",
			source: "zone_file",
		});

		let imported = await DnsMonitorRecord.importMany(db, monitorId, [line, line]);

		expect(imported).toBe(1);
		expect(await DnsMonitorRecord.countByMonitor(db, monitorId)).toBe(1);
	});

	/**
	 * Re-pasting a zone file must not undo the user's review. Re-enabling a record they
	 * declined would turn "I chose not to watch this" into a setting with an expiry date.
	 */
	test("never overwrites the state of a record it already has", async () => {
		await DnsMonitorRecord.importMany(db, monitorId, [watched({ is_enabled: false })]);

		let imported = await DnsMonitorRecord.importMany(db, monitorId, [
			watched({ is_enabled: true }),
		]);

		expect(imported).toBe(0);
		expect((await stored("10 mx1.example.com"))?.is_enabled).toBeFalsy();
	});

	test("imports more records than one statement's parameters allow", async () => {
		let records = Array.from({ length: 25 }, (_, index) =>
			watched({ record_type: "A", value: `10.0.0.${index}` }),
		);

		expect(await DnsMonitorRecord.importMany(db, monitorId, records)).toBe(25);
		expect(await DnsMonitorRecord.countByMonitor(db, monitorId)).toBe(25);
	});
});

describe("DnsMonitorRecord.listNames", () => {
	test("lists each tracked name once, which is the set a sweep queries", async () => {
		await DnsMonitorRecord.importMany(db, monitorId, [
			watched({ record_type: "A", value: "1.2.3.4" }),
			watched({ record_type: "A", value: "5.6.7.8" }),
			watched({ name: "_dmarc.example.com", record_type: "TXT", value: "v=DMARC1; p=none;" }),
		]);

		expect(await DnsMonitorRecord.listNames(db, monitorId)).toEqual([
			"_dmarc.example.com",
			"example.com",
		]);
	});

	test("lists nothing for a monitor whose records belong to another monitor", async () => {
		let other = await DnsMonitor.create(db, "team-1", { name: "Other", domain: "other.com" });
		await DnsMonitorRecord.importMany(db, other.id, [watched({ name: "other.com" })]);

		expect(await DnsMonitorRecord.listNames(db, monitorId)).toEqual([]);
	});
});

describe("DnsMonitorRecord.diff", () => {
	test("classifies a watched record that still resolves as ok", async () => {
		await DnsMonitorRecord.importMany(db, monitorId, [watched()]);

		let diff = await DnsMonitorRecord.diff(db, monitorId, [answer("MX", ["10 mx1.example.com"])]);

		expect(diff.ok.map((record) => record.value)).toEqual(["10 mx1.example.com"]);
		expect(DnsMonitorRecord.summarize(diff)).toEqual({
			recordsChecked: 1,
			recordsChanged: 0,
			recordsMissing: 0,
			recordsNew: 0,
		});
	});

	test("classifies a watched record that stopped resolving as missing", async () => {
		await DnsMonitorRecord.importMany(db, monitorId, [watched()]);

		let diff = await DnsMonitorRecord.diff(db, monitorId, [answer("MX", [])]);

		expect(diff.missing.map((record) => record.value)).toEqual(["10 mx1.example.com"]);
		expect(diff.ok).toEqual([]);
		expect(DnsMonitorRecord.summarize(diff).recordsMissing).toBe(1);
	});

	test("classifies a value with no stored record as new", async () => {
		let diff = await DnsMonitorRecord.diff(db, monitorId, [answer("MX", ["10 mx1.example.com"])]);

		expect(diff.created).toEqual([
			{ name: "example.com", record_type: "MX", value: "10 mx1.example.com" },
		]);
		expect(DnsMonitorRecord.summarize(diff).recordsNew).toBe(1);
	});

	/**
	 * The one edit a diff can attribute without guessing: one stored record, one resolved
	 * value, both differing. Nothing else pairs, because a DNS record has no identity of its
	 * own to pair on.
	 */
	test("pairs a lone stored record with a lone resolved value as changed", async () => {
		await DnsMonitorRecord.importMany(db, monitorId, [watched()]);

		let diff = await DnsMonitorRecord.diff(db, monitorId, [answer("MX", ["20 mx2.example.com"])]);

		expect(diff.changed).toHaveLength(1);
		expect(diff.changed[0]?.record.value).toBe("10 mx1.example.com");
		expect(diff.changed[0]?.value).toBe("20 mx2.example.com");
		expect(diff.missing).toEqual([]);
		expect(diff.created).toEqual([]);
	});

	/**
	 * An RRset growing from five values to six is the case record-level identity exists for:
	 * the sixth is one addition and the other five are untouched, rather than "the MX records
	 * at example.com changed" and two comma-joined strings to compare by eye.
	 */
	test("attributes a grown RRset to the record that appeared", async () => {
		let values = ["10 a.example.com", "20 b.example.com", "30 c.example.com"];
		await DnsMonitorRecord.importMany(
			db,
			monitorId,
			values.map((value) => watched({ value })),
		);

		let diff = await DnsMonitorRecord.diff(db, monitorId, [
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
		await DnsMonitorRecord.importMany(
			db,
			monitorId,
			values.map((value) => watched({ value })),
		);

		let diff = await DnsMonitorRecord.diff(db, monitorId, [answer("MX", values.slice(0, 2))]);

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
		await DnsMonitorRecord.importMany(db, monitorId, [
			watched({ value: "10 a.example.com" }),
			watched({ value: "20 b.example.com" }),
		]);

		let diff = await DnsMonitorRecord.diff(db, monitorId, [
			answer("MX", ["10 a.example.com", "20 renamed.example.com"]),
		]);

		expect(diff.missing.map((record) => record.value)).toEqual(["20 b.example.com"]);
		expect(diff.created.map((record) => record.value)).toEqual(["20 renamed.example.com"]);
		expect(diff.changed).toEqual([]);
	});

	test("finds nothing in an unchanged sweep across several names and types", async () => {
		await DnsMonitorRecord.importMany(db, monitorId, [
			watched({ record_type: "A", value: "1.2.3.4" }),
			watched({ record_type: "A", value: "5.6.7.8" }),
			watched({ record_type: "NS", value: "ns1.example.com" }),
			watched({ name: "_dmarc.example.com", record_type: "TXT", value: "v=DMARC1; p=none;" }),
		]);

		let diff = await DnsMonitorRecord.diff(db, monitorId, [
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
	 * The rule that keeps a resolver's bad minute from alerting a whole zone: a query that
	 * failed is left out of the sweep, and a `(name, type)` the sweep does not mention is not
	 * classified at all.
	 */
	test("classifies nothing for a name and type the sweep never answered", async () => {
		await DnsMonitorRecord.importMany(db, monitorId, [
			watched({ record_type: "A", value: "1.2.3.4" }),
			watched({ record_type: "MX", value: "10 mx1.example.com" }),
		]);

		let diff = await DnsMonitorRecord.diff(db, monitorId, [answer("A", ["1.2.3.4"])]);

		expect(diff.ok).toHaveLength(1);
		expect(diff.missing).toEqual([]);
		expect(diff.absent).toEqual([]);
	});

	test("classifies nothing at all for a sweep that answered no query", async () => {
		await DnsMonitorRecord.importMany(db, monitorId, [watched()]);

		expect(await DnsMonitorRecord.diff(db, monitorId, [])).toEqual({
			ok: [],
			missing: [],
			changed: [],
			created: [],
			seen: [],
			absent: [],
		});
	});

	test("never reports a declined record as missing or changed", async () => {
		await DnsMonitorRecord.importMany(db, monitorId, [
			watched({ record_type: "A", value: "1.2.3.4", is_enabled: false, status: "new" }),
			watched({ record_type: "NS", value: "ns1.example.com", is_enabled: false, status: "new" }),
		]);

		let diff = await DnsMonitorRecord.diff(db, monitorId, [
			answer("A", ["1.2.3.4"]),
			answer("NS", ["ns9.example.com"]),
		]);

		expect(diff.seen.map((record) => record.value)).toEqual(["1.2.3.4"]);
		expect(diff.absent.map((record) => record.value)).toEqual(["ns1.example.com"]);
		expect(diff.missing).toEqual([]);
		expect(diff.changed).toEqual([]);
		// The value that replaced a declined one is still an appearance, and is announced.
		expect(diff.created.map((record) => record.value)).toEqual(["ns9.example.com"]);
		expect(DnsMonitorRecord.summarize(diff)).toEqual({
			recordsChecked: 3,
			recordsChanged: 0,
			recordsMissing: 0,
			recordsNew: 1,
		});
	});

	/**
	 * A zone file and a resolver answer are allowed to disagree for reasons that are nobody's
	 * fault — a proxied record is not in the export, a retired name is still in it — so the
	 * classification is a pure function of the two sets and assumes no agreement between them.
	 */
	test("classifies an imported zone against a first sweep that shares nothing with it", async () => {
		await DnsMonitorRecord.importMany(db, monitorId, [
			watched({
				record_type: "A",
				value: "203.0.113.10",
				source: "zone_file",
				is_enabled: false,
				status: "missing",
				last_seen_at: null,
			}),
		]);

		let diff = await DnsMonitorRecord.diff(db, monitorId, [
			answer("A", ["104.16.0.1", "104.16.0.2"]),
		]);

		// Declared but not resolving: still declined, so still not a finding.
		expect(diff.absent.map((record) => record.value)).toEqual(["203.0.113.10"]);
		expect(diff.missing).toEqual([]);
		expect(diff.created.map((record) => record.value)).toEqual(["104.16.0.1", "104.16.0.2"]);
	});

	test("reads a repeated value in one answer as the single record it is", async () => {
		let diff = await DnsMonitorRecord.diff(db, monitorId, [
			answer("TXT", ["v=spf1 -all", "v=spf1 -all"]),
		]);

		expect(diff.created).toHaveLength(1);
	});

	test("reads only the records of the monitor being diffed", async () => {
		let other = await DnsMonitor.create(db, "team-1", { name: "Other", domain: "example.com" });
		await DnsMonitorRecord.importMany(db, other.id, [watched()]);

		let diff = await DnsMonitorRecord.diff(db, monitorId, [answer("MX", ["10 mx1.example.com"])]);

		expect(diff.ok).toEqual([]);
		expect(diff.created).toHaveLength(1);
	});
});

describe("DnsMonitorRecord.applyDiff", () => {
	test("stamps a record that resolved and marks one that did not", async () => {
		await DnsMonitorRecord.importMany(db, monitorId, [
			watched({ value: "10 a.example.com", last_seen_at: 1000 }),
			watched({ value: "20 b.example.com", last_seen_at: 1000 }),
		]);

		let diff = await DnsMonitorRecord.diff(db, monitorId, [answer("MX", ["10 a.example.com"])]);
		await DnsMonitorRecord.applyDiff(db, monitorId, diff, 5000);

		expect(await stored("10 a.example.com")).toMatchObject({
			status: "ok",
			last_seen_at: 5000,
			last_checked_at: 5000,
		});
		// Missing moves "we looked", never "we saw it".
		expect(await stored("20 b.example.com")).toMatchObject({
			status: "missing",
			last_seen_at: 1000,
			last_checked_at: 5000,
		});
	});

	test("imports a newly discovered record disabled, so accepting it is a decision", async () => {
		let diff = await DnsMonitorRecord.diff(db, monitorId, [answer("MX", ["10 mx1.example.com"])]);
		await DnsMonitorRecord.applyDiff(db, monitorId, diff, 5000);

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
	 * `new` is a state of a record, not of a check: it stands until the user enables or
	 * deletes the row. A second check finding the same unwanted record must not settle it to
	 * `ok`, or it would quietly drop off the list of what needs attention.
	 */
	test("leaves a declined record's status alone on a later check", async () => {
		let first = await DnsMonitorRecord.diff(db, monitorId, [answer("MX", ["10 mx1.example.com"])]);
		await DnsMonitorRecord.applyDiff(db, monitorId, first, 5000);

		let second = await DnsMonitorRecord.diff(db, monitorId, [answer("MX", ["10 mx1.example.com"])]);
		await DnsMonitorRecord.applyDiff(db, monitorId, second, 9000);

		let record = await stored("10 mx1.example.com");
		expect(record).toMatchObject({
			status: "new",
			last_seen_at: 9000,
			last_checked_at: 9000,
		});
		expect(record?.is_enabled).toBeFalsy();
		expect(await DnsMonitorRecord.countByMonitor(db, monitorId)).toBe(1);
	});

	test("rewrites the paired record in place rather than replacing it", async () => {
		await DnsMonitorRecord.importMany(db, monitorId, [watched()]);
		let [before] = await DnsMonitorRecord.listByMonitor(db, monitorId);

		let diff = await DnsMonitorRecord.diff(db, monitorId, [answer("MX", ["20 mx2.example.com"])]);
		await DnsMonitorRecord.applyDiff(db, monitorId, diff, 5000);

		let records = await DnsMonitorRecord.listByMonitor(db, monitorId);
		expect(records).toHaveLength(1);
		expect(records[0]?.id).toBe(before?.id ?? "");
		expect(records[0]).toMatchObject({
			value: "20 mx2.example.com",
			status: "changed",
			last_seen_at: 5000,
		});
	});

	test("stamps a declined record it saw without touching its status", async () => {
		await DnsMonitorRecord.importMany(db, monitorId, [
			watched({ is_enabled: false, status: "new", last_seen_at: 1000 }),
		]);

		let diff = await DnsMonitorRecord.diff(db, monitorId, [answer("MX", ["10 mx1.example.com"])]);
		await DnsMonitorRecord.applyDiff(db, monitorId, diff, 5000);

		expect(await stored("10 mx1.example.com")).toMatchObject({
			status: "new",
			last_seen_at: 5000,
			last_checked_at: 5000,
		});
	});
});

describe("DnsMonitorRecord.setEnabled", () => {
	test("settles a record accepted from review, and leaves the rest of the review alone", async () => {
		await DnsMonitorRecord.importMany(db, monitorId, [
			watched({ value: "10 a.example.com", is_enabled: false, status: "new" }),
			watched({ value: "20 b.example.com", is_enabled: false, status: "new" }),
		]);
		let accepted = await stored("10 a.example.com");

		await DnsMonitorRecord.setEnabled(db, monitorId, [accepted?.id ?? ""], true);

		let enabled = await stored("10 a.example.com");
		expect(enabled?.is_enabled).toBeTruthy();
		expect(enabled?.status).toBe("ok");

		let untouched = await stored("20 b.example.com");
		expect(untouched?.is_enabled).toBeFalsy();
		expect(untouched?.status).toBe("new");
	});

	/**
	 * Enabling a zone-file record that has never resolved leaves it `missing`, which is true
	 * and is the reason the user enabled it in the first place.
	 */
	test("keeps every status other than new when enabling", async () => {
		await DnsMonitorRecord.importMany(db, monitorId, [
			watched({ is_enabled: false, status: "missing", source: "zone_file", last_seen_at: null }),
		]);
		let record = await stored("10 mx1.example.com");

		await DnsMonitorRecord.setEnabled(db, monitorId, [record?.id ?? ""], true);

		let enabled = await stored("10 mx1.example.com");
		expect(enabled?.is_enabled).toBeTruthy();
		expect(enabled?.status).toBe("missing");
	});

	test("disables without rewriting the status", async () => {
		await DnsMonitorRecord.importMany(db, monitorId, [watched()]);
		let record = await stored("10 mx1.example.com");

		await DnsMonitorRecord.setEnabled(db, monitorId, [record?.id ?? ""], false);

		let disabled = await stored("10 mx1.example.com");
		expect(disabled?.is_enabled).toBeFalsy();
		expect(disabled?.status).toBe("ok");
	});

	test("ignores an id belonging to another monitor", async () => {
		let other = await DnsMonitor.create(db, "team-1", { name: "Other", domain: "other.com" });
		await DnsMonitorRecord.importMany(db, other.id, [
			watched({ name: "other.com", is_enabled: false, status: "new" }),
		]);
		let [record] = await DnsMonitorRecord.listByMonitor(db, other.id);

		await DnsMonitorRecord.setEnabled(db, monitorId, [record?.id ?? ""], true);

		let [unchanged] = await DnsMonitorRecord.listByMonitor(db, other.id);
		expect(unchanged?.is_enabled).toBeFalsy();
		expect(unchanged?.status).toBe("new");
	});
});
