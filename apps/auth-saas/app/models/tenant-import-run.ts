/**
 * Data model for tenant import runs: the control-plane record of a tenant's own
 * bulk-import job against its directory, tracking which source file it reads,
 * which report it writes failures to, how far it has gotten, and its running
 * counts. Wraps the `tenant_import_runs` D1 table.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database, TableRow } from "remix/data-table";

import { typeid } from "@sdxc/typeid";
import { generateUUIDv7 } from "@sdxc/uuid";
import { column as c, table } from "remix/data-table";

/** Mints an `imp_` TypeID for a new tenant import run row. */
const tenantImportRunId = typeid("imp");

/** One tenant import run row as the control plane stores it. */
export type TenantImportRunRow = TableRow<typeof TenantImportRun.table>;

/** A batch's worth of progress to fold into a run's running counts. */
export interface AdvanceTenantImportRunInput {
	id: string;
	/** The row count the run has now consumed from the source file, replacing the stored value rather than adding to it. */
	cursor: number;
	processedDelta: number;
	createdDelta: number;
	updatedDelta: number;
	failedDelta: number;
}

/**
 * Active-record–style model for tenant import runs, exposing static query and
 * mutation helpers over the `tenant_import_runs` table.
 *
 * @example
 * let run = await TenantImportRun.create(db, { tenantId, mode: "validate", sourceKey });
 */
export default class TenantImportRun {
	/** The `tenant_import_runs` D1 table definition. */
	static table = table({
		name: "tenant_import_runs",
		primaryKey: ["id"],
		columns: {
			id: c.text(),
			tenant_id: c.text(),
			mode: c.enum(["validate", "apply"] as const),
			source_key: c.text(),
			report_key: c.text().nullable(),
			status: c.enum(["queued", "running", "completed", "failed"] as const),
			total: c.integer().nullable(),
			processed: c.integer().default(0),
			created: c.integer().default(0),
			updated: c.integer().default(0),
			failed: c.integer().default(0),
			cursor: c.integer().default(0),
			started_at: c.integer().nullable(),
			finished_at: c.integer().nullable(),
			created_at: c.integer(),
		},
	});

	/**
	 * Starts a new import run, queued and untouched.
	 *
	 * @param db - Database connection.
	 * @param data - The tenant the run belongs to, whether it only validates or
	 * applies its rows, and the R2 key of the source file it reads.
	 * @returns A promise resolving to the newly-created run row.
	 */
	static create(
		db: Database,
		data: { tenantId: string; mode: "validate" | "apply"; sourceKey: string },
	): Promise<TenantImportRunRow> {
		return db.create(
			TenantImportRun.table,
			{
				id: tenantImportRunId(generateUUIDv7()).toString(),
				tenant_id: data.tenantId,
				mode: data.mode,
				source_key: data.sourceKey,
				report_key: null,
				status: "queued",
				total: null,
				processed: 0,
				created: 0,
				updated: 0,
				failed: 0,
				cursor: 0,
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
	static findById(db: Database, id: string): Promise<TenantImportRunRow | null> {
		return db.find(TenantImportRun.table, { id });
	}

	/**
	 * Marks a run as under way.
	 *
	 * @param db - Database connection.
	 * @param id - The run's id.
	 * @returns A promise resolving to the updated row.
	 */
	static markRunning(db: Database, id: string): Promise<TenantImportRunRow> {
		return db.update(TenantImportRun.table, { id }, { status: "running", started_at: Date.now() });
	}

	/**
	 * Moves a run forward by one batch's worth of progress: replaces the stored
	 * cursor with the position the batch reached, and folds the batch's counts
	 * into the run's running totals.
	 *
	 * @param db - Database connection.
	 * @param input - The run's id, its new cursor position, and the counts the
	 * batch just processed.
	 * @returns A promise resolving to the updated row.
	 * @throws When no run exists for the given id.
	 */
	static async advance(
		db: Database,
		input: AdvanceTenantImportRunInput,
	): Promise<TenantImportRunRow> {
		let existing = await db.find(TenantImportRun.table, { id: input.id });
		if (!existing) throw new Error("tenant import run not found");

		return db.update(
			TenantImportRun.table,
			{ id: input.id },
			{
				cursor: input.cursor,
				processed: existing.processed + input.processedDelta,
				created: existing.created + input.createdDelta,
				updated: existing.updated + input.updatedDelta,
				failed: existing.failed + input.failedDelta,
			},
		);
	}

	/**
	 * Marks a run as finished successfully.
	 *
	 * @param db - Database connection.
	 * @param id - The run's id.
	 * @returns A promise resolving to the updated row.
	 */
	static complete(db: Database, id: string): Promise<TenantImportRunRow> {
		return db.update(
			TenantImportRun.table,
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
	static fail(db: Database, id: string): Promise<TenantImportRunRow> {
		return db.update(TenantImportRun.table, { id }, { status: "failed", finished_at: Date.now() });
	}
}
