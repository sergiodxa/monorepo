/**
 * Insert-time payload typing for the blog database schema.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { AnyTable, TableRow } from "remix/data-table";

/**
 * Payload shape used by insert operations before persistence.
 *
 * Fields are optional to support DB defaults and generated columns,
 * but supplied values must still match the table row value types.
 *
 * @template table Table schema used to derive insertable fields.
 */
export type InsertRow<table extends AnyTable> = Partial<TableRow<table>>;
