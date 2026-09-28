/**
 * The board's one table, declared with remix/data-table. `database/migrations/` is the
 * physical truth, so column names stay snake_case and every timestamp is an integer holding
 * epoch milliseconds, which is what SQLite compares and orders without a cast.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TableRow } from "remix/data-table";

import { column as c, table } from "remix/data-table";

/**
 * One open position. `expired_at` is the board's only lifecycle: the nightly sweep stamps it
 * and the listing hides anything stamped, so a posting is never deleted and a link to one
 * keeps resolving. Timestamps are written by the caller, since an integer column holds epoch
 * milliseconds and the table's own hook would hand it a `Date` the driver refuses to bind.
 */
export const postings = table({
	name: "postings",
	columns: {
		id: c.text().primaryKey(),
		created_at: c.integer(),
		updated_at: c.integer(),
		expired_at: c.integer().nullable(),
		title: c.text(),
		company: c.text(),
		location: c.text(),
		salary: c.text(),
		/** The position's description, as Markdown the author wrote. */
		description: c.text(),
		contact_email: c.text(),
	},
});

/** One posting as it reads back out of the database. */
export type Posting = TableRow<typeof postings>;
