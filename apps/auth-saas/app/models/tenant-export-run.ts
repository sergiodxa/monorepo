/**
 * Data model for tenant export runs: the control-plane record of a tenant's own
 * bulk-export job against its directory, tracking whether it carries password
 * hashes, how far its own paging has gotten, and where its NDJSON output lands.
 * Wraps the `tenant_export_runs` D1 table.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database, TableRow } from "remix/data-table";

import { typeid } from "@sdxc/typeid";
import { generateUUIDv7 } from "@sdxc/uuid";
import { column as c, inList, table } from "remix/data-table";

/** Mints an `exp_` TypeID for a new tenant export run row. */
const tenantExportRunId = typeid("exp");

/** One tenant export run row as the control plane stores it. */
export type TenantExportRunRow = TableRow<typeof TenantExportRun.table>;

/** A page's worth of progress to fold into a run's running counts. */
export interface AdvanceTenantExportRunInput {
	id: string;
	/** The keyset cursor the page just read hands back, replacing the stored value rather than adding to it — `null` once every subject has been read. */
	cursor: string | null;
	processedDelta: number;
}

/**
 * Active-record–style model for tenant export runs, exposing static query and
 * mutation helpers over the `tenant_export_runs` table.
 *
 * @example
 * let run = await TenantExportRun.create(db, { tenantId, includeCredentials: false });
 */
export default class TenantExportRun {
	/** The `tenant_export_runs` D1 table definition. */
	static table = table({
		name: "tenant_export_runs",
		primaryKey: ["id"],
		columns: {
			id: c.text(),
			tenant_id: c.text(),
			include_credentials: c.boolean(),
			status: c.enum(["queued", "running", "completed", "failed"] as const),
			cursor: c.text().nullable(),
			report_key: c.text().nullable(),
			total: c.integer().nullable(),
			processed: c.integer().default(0),
			started_at: c.integer().nullable(),
			finished_at: c.integer().nullable(),
			created_at: c.integer(),
		},
	});

	/**
	 * Starts a new export run, queued and untouched.
	 *
	 * @param db - Database connection.
	 * @param data - The tenant the run belongs to, whether it carries password
	 * hashes, and an optional subject-count estimate for a progress display.
	 * @returns A promise resolving to the newly-created run row.
	 */
	static create(
		db: Database,
		data: { tenantId: string; includeCredentials: boolean; total?: number | null },
	): Promise<TenantExportRunRow> {
		return db.create(
			TenantExportRun.table,
			{
				id: tenantExportRunId(generateUUIDv7()).toString(),
				tenant_id: data.tenantId,
				include_credentials: data.includeCredentials,
				status: "queued",
				cursor: null,
				report_key: null,
				total: data.total ?? null,
				processed: 0,
				started_at: null,
				finished_at: null,
				created_at: Date.now(),
			},
			{ returnRow: true },
		);
	}

	/**
	 * Finds a run by its id.
	 *
	 * @param db - Database connection.
	 * @param id - The run's id.
	 * @returns A promise resolving to the row, or null when no such run exists.
	 */
	static findById(db: Database, id: string): Promise<TenantExportRunRow | null> {
		return db.find(TenantExportRun.table, { id });
	}

	/**
	 * Lists every run still owed work: queued and never started, or running and
	 * left mid-directory by an earlier tick. Unpaginated, since a tenant only
	 * ever holds a handful of runs in either state at once.
	 *
	 * @param db - Database connection.
	 * @returns A promise resolving to every queued or running run, across every tenant.
	 */
	static listActive(db: Database): Promise<TenantExportRunRow[]> {
		return db.findMany(TenantExportRun.table, {
			where: inList("status", ["queued", "running"] as const),
		});
	}

	/**
	 * Marks a run as under way.
	 *
	 * @param db - Database connection.
	 * @param id - The run's id.
	 * @returns A promise resolving to the updated row.
	 */
	static markRunning(db: Database, id: string): Promise<TenantExportRunRow> {
		return db.update(TenantExportRun.table, { id }, { status: "running", started_at: Date.now() });
	}

	/**
	 * Moves a run forward by one page's worth of progress: replaces the stored
	 * cursor with the one the page just read handed back, and folds the page's
	 * subject count into the run's running total.
	 *
	 * @param db - Database connection.
	 * @param input - The run's id, its new cursor, and how many subjects the
	 * page just processed.
	 * @returns A promise resolving to the updated row.
	 * @throws When no run exists for the given id.
	 */
	static async advance(
		db: Database,
		input: AdvanceTenantExportRunInput,
	): Promise<TenantExportRunRow> {
		let existing = await db.find(TenantExportRun.table, { id: input.id });
		if (!existing) throw new Error("tenant export run not found");

		return db.update(
			TenantExportRun.table,
			{ id: input.id },
			{ cursor: input.cursor, processed: existing.processed + input.processedDelta },
		);
	}

	/**
	 * Records the R2 key a run's NDJSON output is being written to, so a later
	 * tick resuming the same run knows where to keep appending rather than
	 * starting a second output file.
	 *
	 * @param db - Database connection.
	 * @param input - The run's id and the output's object key.
	 * @returns A promise resolving to the updated row.
	 */
	static setReportKey(
		db: Database,
		input: { id: string; reportKey: string },
	): Promise<TenantExportRunRow> {
		return db.update(TenantExportRun.table, { id: input.id }, { report_key: input.reportKey });
	}

	/**
	 * Marks a run as finished successfully.
	 *
	 * @param db - Database connection.
	 * @param id - The run's id.
	 * @returns A promise resolving to the updated row.
	 */
	static complete(db: Database, id: string): Promise<TenantExportRunRow> {
		return db.update(
			TenantExportRun.table,
			{ id },
			{ status: "completed", finished_at: Date.now() },
		);
	}

	/**
	 * Marks a run as having failed.
	 *
	 * @param db - Database connection.
	 * @param id - The run's id.
	 * @returns A promise resolving to the updated row.
	 */
	static fail(db: Database, id: string): Promise<TenantExportRunRow> {
		return db.update(TenantExportRun.table, { id }, { status: "failed", finished_at: Date.now() });
	}
}
