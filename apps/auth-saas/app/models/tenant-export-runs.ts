/**
 * Tenant export runs: the control-plane record of a tenant's bulk export of its directory,
 * tracking whether it carries password hashes, how far its paging has gotten, and where its
 * NDJSON output lands, so a later tick resumes a run an earlier one left mid-directory.
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

import { tenantExportRuns } from "~/database/schema";

/** Mints an `exp_` TypeID for a new tenant export run row. */
const tenantExportRunId = typeid("exp");

/** A page's worth of progress to fold into a run's running counts. */
export interface AdvanceTenantExportRunInput {
	id: string;
	/** The cursor the page handed back, replacing the stored one; `null` once every subject was read. */
	cursor: string | null;
	processedDelta: number;
}

/** A run row, or why the write left it unchanged. */
type RunResult = Promise<Result<TableRow<typeof tenantExportRuns>, Error>>;

/**
 * Export runs, created queued and untouched.
 *
 * @example let run = await models.tenantExportRuns.create({ tenant_id, include_credentials: false });
 */
export const TenantExportRuns = createModel(tenantExportRuns, {
	optional: ["id", "status", "processed"],

	scopes: {
		/**
		 * Runs still owed work: queued, or running and left mid-directory by an earlier tick. A
		 * tenant holds a handful at once, so callers read them unpaginated.
		 */
		active: (query) => query.where(inList("status", ["queued", "running"] as const)),
	},

	methods: {
		markRunning(id: string): RunResult {
			return this.update(id, { status: "running", started_at: Date.now() });
		},

		/** Replaces the stored cursor and folds the page's subject count into the running total. */
		async advance(input: AdvanceTenantExportRunInput): RunResult {
			let existing = await this.find(input.id);
			if (existing === null) return failure(new NotFound("tenant_export_runs", input.id));

			return this.update(input.id, {
				cursor: input.cursor,
				processed: existing.processed + input.processedDelta,
			});
		},

		/** Records where the output is written, so a resumed run appends to the same file. */
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
				id: values.id ?? tenantExportRunId(generateUUID()).toString(),
				status: values.status ?? "queued",
				processed: values.processed ?? 0,
				created_at: values.created_at ?? Date.now(),
			};
		},
	},
});

/** One tenant export run row as the control plane stores it. */
export type TenantExportRunRow = ModelRow<typeof TenantExportRuns>;

export default TenantExportRuns;
