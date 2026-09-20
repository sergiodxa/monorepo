/**
 * What the tenant object enforces about its own plan (ADR-018): the DAU cap and
 * audit retention window that live inside the object rather than in the
 * control plane, written by `applyEntitlements` as one whole operation. Leaf
 * module — imports nothing else under `database/`, the way `mail-rate-limit.ts`
 * does — since nothing here needs to reach another tenant table.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ColumnBuilder, Database } from "remix/data-table";

import { column as c, table } from "remix/data-table";

/** The one row this table ever holds: this tenant's own current enforcement record. */
const ROW_ID = "current";

/** This tenant's currently enforced plan, features, and limits. */
export const entitlementEnforcement = table({
	name: "entitlement_enforcement",
	primaryKey: ["id"],
	columns: {
		id: c.text(),
		plan: c.text(),
		features: c.json() as ColumnBuilder<Record<string, boolean>>,
		dau_cap: c.integer().nullable(),
		audit_retention_days: c.integer().nullable(),
		effective_at: c.integer(),
	},
});

/** What `applyEntitlements` writes as one whole operation. */
export interface ApplyEntitlementsInput {
	plan: string;
	features: Record<string, boolean>;
	dauCap: number | null;
	auditRetentionDays: number | null;
	effectiveAt: number;
}

/** What `applyEntitlements` hands back. */
export interface ApplyEntitlementsResult {
	plan: string;
	/**
	 * Rows pruned from the audit log outside the new retention window. Always
	 * `0` for now — ADR-023 is what builds that table — and becomes a real
	 * count once it exists.
	 */
	prunedRows: number;
}

/**
 * Writes this tenant's enforcement record as one whole operation, replacing
 * whatever it held before.
 *
 * @param db - The tenant's database.
 * @param input - The plan, its features, the DAU cap and audit retention
 * window it now enforces, and when this took effect.
 * @returns The plan now enforced, and how many audit rows the new retention
 * window pruned.
 * @example
 * let { plan, prunedRows } = await applyEntitlements(db, {
 * 	plan: "pro",
 * 	features: { sso: true },
 * 	dauCap: 5000,
 * 	auditRetentionDays: 90,
 * 	effectiveAt: Date.now(),
 * });
 */
export async function applyEntitlements(
	db: Database,
	input: ApplyEntitlementsInput,
): Promise<ApplyEntitlementsResult> {
	let existing = await db.findOne(entitlementEnforcement, { where: { id: ROW_ID } });

	let record = {
		plan: input.plan,
		features: input.features,
		dau_cap: input.dauCap,
		audit_retention_days: input.auditRetentionDays,
		effective_at: input.effectiveAt,
	};

	if (existing) {
		await db.update(entitlementEnforcement, { id: ROW_ID }, record);
	} else {
		await db.create(entitlementEnforcement, { id: ROW_ID, ...record });
	}

	return { plan: input.plan, prunedRows: 0 };
}
