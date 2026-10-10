/**
 * The records a DNS monitor tracks: the import discovery and a zone-file paste both write
 * through, the baseline a check reads, the classification that turns a sweep's answers into
 * `missing`/`new`/`changed` findings, and the enable/disable a review screen writes back.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ModelRow } from "@sdxc/data-model";
import type { Database } from "remix/data-table";

import { createModel } from "@sdxc/data-model";
import { generateUUID } from "@sdxc/uuid/v4";
import { and, eq, getTableName, inList } from "remix/data-table";

import type { DnsRecordState, SelectDnsMonitorRecord } from "~/database/schema";

import { chunk } from "~/app/lib/concurrency";
import { dnsMonitorRecords } from "~/database/schema";

/**
 * D1 refuses a statement carrying more than this many bound parameters, so every read and
 * write here that scales with the number of records is chunked against it, at a handful of
 * statements for a whole zone.
 */
const BOUND_PARAMETER_LIMIT = 100;

/** Columns written per imported row, which is what caps {@link IMPORT_BATCH_SIZE}. */
const IMPORT_COLUMNS = [
	"id",
	"created_at",
	"updated_at",
	"dns_monitor_id",
	"name",
	"record_type",
	"value",
	"source",
	"is_enabled",
	"status",
	"first_seen_at",
	"last_seen_at",
	"last_checked_at",
] as const;

/** Rows per multi-row `INSERT`, so one statement stays inside the parameter limit. */
const IMPORT_BATCH_SIZE = Math.floor(BOUND_PARAMETER_LIMIT / IMPORT_COLUMNS.length);

/**
 * Ids per `IN (…)` list. One parameter is left over for the monitor id, and a few more for
 * the columns an update sets, so the batch stays under the limit in every caller here.
 */
const ID_BATCH_SIZE = BOUND_PARAMETER_LIMIT - 8;

/** The six record types v1 sweeps, taken from the column so the two can never disagree. */
export type DnsRecordType = SelectDnsMonitorRecord["record_type"];

/** How a row first entered the table: a resolver answer, or a pasted zone file. */
export type DnsRecordSource = SelectDnsMonitorRecord["source"];

/**
 * A record as an answer or a zone-file line describes it, before it has a row. `value`
 * arrives already normalized, which is what makes a zone-file line and a resolver answer
 * for the same record produce the same string, and therefore one row.
 */
export interface ObservedDnsRecord {
	name: string;
	record_type: DnsRecordType;
	value: string;
}

/** A record to import, with the state the importing channel says it is in. */
export interface DnsRecordImport extends ObservedDnsRecord {
	source: DnsRecordSource;
	is_enabled: boolean;
	status: DnsRecordState;
	/** When it last resolved; `null` for a zone-file line awaiting its first answer. */
	last_seen_at: number | null;
}

/**
 * One **answered** query: every value the RRset at this name and type holds right now. An
 * empty `values` therefore means `NXDOMAIN` or an empty answer, while a failed query stays
 * out of the sweep, so a bad resolver minute never reads as vanished DNS.
 */
export interface DnsQueryAnswer {
	name: string;
	record_type: DnsRecordType;
	values: string[];
}

/** A stored record whose single resolved counterpart now holds a different value. */
export interface DnsRecordChange {
	record: SelectDnsMonitorRecord;
	value: string;
}

/**
 * What a check found, bucketed by the write each outcome implies. Every stored record in a
 * swept `(name, record_type)` group lands in exactly one bucket, and every resolved value
 * with no row of its own lands in {@link DnsRecordDiff.created}.
 */
export interface DnsRecordDiff {
	/** Watched and resolved. */
	ok: SelectDnsMonitorRecord[];
	/** Watched and gone: the finding that alerts. */
	missing: SelectDnsMonitorRecord[];
	/** The one attributable edit: a lone watched record against a lone differing value. */
	changed: DnsRecordChange[];
	/** Resolved with no stored row: imported disabled, and announced. */
	created: ObservedDnsRecord[];
	/** Declined but still resolving: recorded as seen. */
	seen: SelectDnsMonitorRecord[];
	/** Declined and absent: the time we looked is all that is recorded. */
	absent: SelectDnsMonitorRecord[];
}

/** The per-check counters a `dns_monitor_results` row carries. */
export interface DnsRecordCounts {
	recordsChecked: number;
	recordsChanged: number;
	recordsMissing: number;
	recordsNew: number;
}

/** An empty diff, so a sweep that answered nothing is still a well-formed result. */
function emptyDiff(): DnsRecordDiff {
	return { ok: [], missing: [], changed: [], created: [], seen: [], absent: [] };
}

/** The key a stored record and an answer share when they describe the same RRset. */
function groupKey(name: string, recordType: DnsRecordType) {
	return `${name} ${recordType}`;
}

/**
 * The counters for the check's `dns_monitor_results` row. `recordsChecked` covers every
 * swept record, declined and newly discovered included; `recordsMissing` counts watched
 * records alone, since declining a record is what makes its disappearance routine.
 */
export function summarizeDnsRecordDiff(diff: DnsRecordDiff): DnsRecordCounts {
	return {
		recordsChecked:
			diff.ok.length +
			diff.missing.length +
			diff.changed.length +
			diff.created.length +
			diff.seen.length +
			diff.absent.length,
		recordsChanged: diff.changed.length,
		recordsMissing: diff.missing.length,
		recordsNew: diff.created.length,
	};
}

/**
 * Applies one patch to a set of records by id, batched against the parameter limit. Every
 * bucket `applyDiff` writes is "these rows, this patch", and a per-row write would cost a
 * statement per record on a table sized by the customer's zone.
 */
async function markRecords(
	db: Database,
	records: readonly SelectDnsMonitorRecord[],
	changes: Partial<SelectDnsMonitorRecord>,
): Promise<void> {
	if (records.length === 0) return;

	for (let batch of chunk(
		records.map((record) => record.id),
		ID_BATCH_SIZE,
	)) {
		await db.updateMany(dnsMonitorRecords, changes, { where: inList("id", batch), touch: true });
	}
}

export const DnsMonitorRecords = createModel(dnsMonitorRecords, {
	optional: ["id", "is_enabled"],

	scopes: {
		forMonitor: (query, monitorId: string) => query.where({ dns_monitor_id: monitorId }),
	},

	methods: {
		/**
		 * Imports records, ignoring any whose identity the monitor already has, so a re-pasted
		 * zone file leaves `is_enabled` alone and a record the user declined stays declined.
		 * Duplicate lines inside one import are absorbed the same way, since DNS itself dedupes.
		 *
		 * @returns How many rows were new, which is what a review screen reports after a
		 * re-import.
		 */
		async importMany(
			monitorId: string,
			records: readonly DnsRecordImport[],
			now: number = Date.now(),
		): Promise<number> {
			if (records.length === 0) return 0;

			let table = getTableName(dnsMonitorRecords);
			let placeholders = `(${IMPORT_COLUMNS.map(() => "?").join(", ")})`;
			let inserted = 0;

			for (let batch of chunk([...records], IMPORT_BATCH_SIZE)) {
				let parameters = batch.flatMap((record) => [
					generateUUID(),
					now,
					now,
					monitorId,
					record.name,
					record.record_type,
					record.value,
					record.source,
					record.is_enabled ? 1 : 0,
					record.status,
					now,
					record.last_seen_at,
					null,
				]);

				let result = await this.db.exec(
					`INSERT OR IGNORE INTO ${table} (${IMPORT_COLUMNS.join(", ")})
					 VALUES ${batch.map(() => placeholders).join(", ")}
					 RETURNING id`,
					parameters,
				);

				inserted += (result.rows ?? []).length;
			}

			return inserted;
		},

		/** Every record a monitor tracks, grouped by name and type the way a review screen reads them. */
		listByMonitor(monitorId: string) {
			return this.forMonitor(monitorId)
				.orderBy("name", "asc")
				.orderBy("record_type", "asc")
				.orderBy("value", "asc")
				.all();
		},

		/**
		 * The distinct names a monitor tracks, which is the set a sweep queries. This table is
		 * the only surviving record of which names an import discovered, and `SELECT DISTINCT`
		 * keeps a name with thirty records to the one row the caller wants.
		 */
		async listNames(monitorId: string): Promise<string[]> {
			let result = await this.db.exec(
				`SELECT DISTINCT name
				   FROM ${getTableName(dnsMonitorRecords)}
				  WHERE dns_monitor_id = ?
				  ORDER BY name ASC`,
				[monitorId],
			);

			return ((result.rows ?? []) as unknown as { name: string }[]).map((row) => row.name);
		},

		/**
		 * Classifies a sweep's answers against the stored baseline, keyed on the full
		 * `(name, record_type, value)` identity, so `changed` covers the one attributable case: a
		 * lone watched record against a lone differing value. Unswept groups are left as found.
		 */
		async diff(monitorId: string, sweep: readonly DnsQueryAnswer[]): Promise<DnsRecordDiff> {
			if (sweep.length === 0) return emptyDiff();

			let names = [...new Set(sweep.map((answer) => answer.name))];
			let stored: SelectDnsMonitorRecord[] = [];

			for (let batch of chunk(names, ID_BATCH_SIZE)) {
				let rows = await this.forMonitor(monitorId).where(inList("name", batch)).all();
				stored.push(...rows);
			}

			let groups = new Map<string, SelectDnsMonitorRecord[]>();
			for (let record of stored) {
				let key = groupKey(record.name, record.record_type);
				let group = groups.get(key);
				if (group) group.push(record);
				else groups.set(key, [record]);
			}

			let diff = emptyDiff();

			for (let answer of sweep) {
				let group = groups.get(groupKey(answer.name, answer.record_type)) ?? [];
				let resolved = new Set(answer.values);

				let [only] = group;
				if (only && group.length === 1 && resolved.size === 1 && only.is_enabled) {
					let [value] = [...resolved];
					if (value !== undefined && value !== only.value) {
						diff.changed.push({ record: only, value });
						continue;
					}
				}

				for (let record of group) {
					if (resolved.has(record.value)) {
						if (record.is_enabled) diff.ok.push(record);
						else diff.seen.push(record);
					} else if (record.is_enabled) diff.missing.push(record);
					else diff.absent.push(record);
				}

				for (let value of resolved) {
					if (group.some((record) => record.value === value)) continue;
					diff.created.push({ name: answer.name, record_type: answer.record_type, value });
				}
			}

			return diff;
		},

		/**
		 * Writes a diff one statement per outcome, plus one per changed record since each carries
		 * its own value. A newly discovered record arrives disabled, keeping acceptance a
		 * deliberate act, and a declined record keeps its `status` until the user acts on it.
		 */
		async applyDiff(
			monitorId: string,
			diff: DnsRecordDiff,
			checkedAt: number = Date.now(),
		): Promise<void> {
			await markRecords(this.db, diff.ok, {
				status: "ok",
				last_seen_at: checkedAt,
				last_checked_at: checkedAt,
			});

			await markRecords(this.db, diff.missing, { status: "missing", last_checked_at: checkedAt });

			await markRecords(this.db, diff.seen, {
				last_seen_at: checkedAt,
				last_checked_at: checkedAt,
			});

			await markRecords(this.db, diff.absent, { last_checked_at: checkedAt });

			for (let change of diff.changed) {
				await this.db.update(
					dnsMonitorRecords,
					change.record.id,
					{
						value: change.value,
						status: "changed",
						last_seen_at: checkedAt,
						last_checked_at: checkedAt,
					},
					{ touch: true },
				);
			}

			await this.importMany(
				monitorId,
				diff.created.map((record) => ({
					...record,
					source: "resolver" as const,
					is_enabled: false,
					status: "new" as const,
					last_seen_at: checkedAt,
				})),
				checkedAt,
			);
		},

		/**
		 * Enables or disables records, scoped to their monitor so an id from another team's
		 * monitor matches nothing. Enabling settles a `new` record to `ok`, clearing it off the
		 * "needs your attention" list; every other status survives, disabling included.
		 */
		async setEnabled(
			monitorId: string,
			recordIds: readonly string[],
			isEnabled: boolean,
		): Promise<void> {
			if (recordIds.length === 0) return;

			for (let batch of chunk([...recordIds], ID_BATCH_SIZE)) {
				if (isEnabled) {
					await this.db.updateMany(
						dnsMonitorRecords,
						{ status: "ok" },
						{
							where: and(eq("dns_monitor_id", monitorId), inList("id", batch), eq("status", "new")),
							touch: true,
						},
					);
				}

				await this.db.updateMany(
					dnsMonitorRecords,
					{ is_enabled: isEnabled },
					{ where: and(eq("dns_monitor_id", monitorId), inList("id", batch)), touch: true },
				);
			}
		},
	},
});

/** A tracked DNS record, as reads return it. */
export type DnsMonitorRecord = ModelRow<typeof DnsMonitorRecords>;

export default DnsMonitorRecords;
