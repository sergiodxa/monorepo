/**
 * Database schema for the r3-uptime app defined with remix/data-table. Declares the
 * tables and columns the application persists, currently a `users` table keyed by a
 * UUID primary key. It exists as the single source of truth that the data-table
 * query and migration layers build against.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { table, column as c } from "remix/data-table";

export const users = table({
	name: "users",
	columns: {
		id: c.uuid().primaryKey(),
	},
});
