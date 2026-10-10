/**
 * Tenant import runs: the control-plane record of a tenant's bulk import into its directory,
 * tracking which source file it reads, which report it writes failures to, how far it has
 * gotten and its running counts, so a later tick resumes a run an earlier one left mid-file.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ModelRow } from "@sdxc/data-model";
import type { Result } from "@sdxc/result";
import type { TableRow } from "remix/data-table";

import { createModel, NotFound } from "@sdxc/data-model";
import { failure } from "@sdxc/result";
import { typeid } from "@sdxc/typeid";
import { generateUUID } from "@sdxc/uuid/v7";
import { inList } from "remix/data-table";

import { tenantImportRuns } from "~/database/schema";

/** Mints an `imp_` TypeID for a new tenant import run row. */
const tenantImportRunId = typeid("imp");

/** A batch's worth of progress to fold into a run's running counts. */
export interface AdvanceTenantImportRunInput {
	id: string;
	/** The row count the run has now consumed from the source file, replacing the stored value. */
	cursor: number;
	processedDelta: number;
	createdDelta: number;
	updatedDelta: number;
	failedDelta: number;
}

/** A run row, or why the write left it unchanged. */
type RunResult = Promise<Result<TableRow<typeof tenantImportRuns>, Error>>;

/**
 * Import runs, created queued with every count at zero.
 *
 * @example let run = await models.tenantImportRuns.create({ tenant_id, mode: "validate", source_key });
 */
export const TenantImportRuns = createModel(tenantImportRuns, {
	optional: ["id", "status", "processed", "created", "updated", "failed", "cursor"],

	scopes: {
		/**
		 * Runs still owed work: queued, or running and left mid-file by an earlier tick. A tenant
		 * holds a handful at once, so callers read them unpaginated.
		 */
		active: (query) => query.where(inList("status", ["queued", "running"] as const)),
	},

	methods: {
		markRunning(id: string): RunResult {
			return this.update(id, { status: "running", started_at: Date.now() });
		},

		/** Replaces the stored cursor and folds the batch's counts into the running totals. */
		async advance(input: AdvanceTenantImportRunInput): RunResult {
			let existing = await this.find(input.id);
			if (existing === null) return failure(new NotFound("tenant_import_runs", input.id));

			return this.update(input.id, {
				cursor: input.cursor,
				processed: existing.processed + input.processedDelta,
				created: existing.created + input.createdDelta,
				updated: existing.updated + input.updatedDelta,
				failed: existing.failed + input.failedDelta,
			});
		},

		/** Records where the failure report is written, so a resumed run appends to the same file. */
		setReportKey(id: string, reportKey: string): RunResult {
			return this.update(id, { report_key: reportKey });
		},

		complete(id: string): RunResult {
			return this.update(id, { status: "completed", finished_at: Date.now() });
		},

		fail(id: string): RunResult {
			return this.update(id, { status: "failed", finished_at: Date.now() });
		},
	},

	callbacks: {
		async beforeCreate(values) {
			return {
				...values,
				id: values.id ?? tenantImportRunId(generateUUID()).toString(),
				status: values.status ?? "queued",
				processed: values.processed ?? 0,
				created: values.created ?? 0,
				updated: values.updated ?? 0,
				failed: values.failed ?? 0,
				cursor: values.cursor ?? 0,
				created_at: values.created_at ?? Date.now(),
			};
		},
	},
});

/** One tenant import run row as the control plane stores it. */
export type TenantImportRunRow = ModelRow<typeof TenantImportRuns>;

export default TenantImportRuns;
