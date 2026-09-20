/**
 * Data model for flag changes: the record every accepted release-flag or
 * kill-switch write appends, independent of the definition set itself, which
 * lives in Cloudflare KV rather than here. Wraps the `flag_change` table.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database, TableRow } from "remix/data-table";

import { typeid } from "@sdxc/typeid";
import { generateUUIDv7 } from "@sdxc/uuid";
import { column as c, table } from "remix/data-table";

/** Mints a `fchg_` TypeID for a new flag change row. */
const flagChangeId = typeid("fchg");

/** One flag change row as the control plane stores it. */
export type FlagChangeRow = TableRow<typeof FlagChange.table>;

/**
 * Active-record–style model for flag changes, exposing the one static method
 * every accepted write calls.
 *
 * @example
 * let change = await FlagChange.record(db, { key: "release.token-exchange-v2", before, after, actor });
 */
export default class FlagChange {
	/** The `flag_change` table definition, keyed on a minted id rather than the flag's own key. */
	static table = table({
		name: "flag_change",
		primaryKey: ["id"],
		columns: {
			id: c.text(),
			key: c.text(),
			before: c.text().nullable(),
			after: c.text(),
			actor: c.text(),
			at: c.integer(),
		},
	});

	/**
	 * Appends one flag change.
	 *
	 * @param db - Database connection.
	 * @param data - The flag's key, its definition before and after the write —
	 * `before` is null for a key the set carried no definition for yet — and who
	 * made the change.
	 * @returns A promise resolving to the written row.
	 */
	static record(
		db: Database,
		data: { key: string; before: string | null; after: string; actor: string },
	): Promise<FlagChangeRow> {
		return db.create(
			FlagChange.table,
			{
				id: flagChangeId(generateUUIDv7()).toString(),
				key: data.key,
				before: data.before,
				after: data.after,
				actor: data.actor,
				at: Date.now(),
			},
			{ returnRow: true },
		);
	}
}
