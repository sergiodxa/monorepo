/**
 * Reads rows by id in batches that fit one D1 statement, which binds at most 100 values, so a
 * read behind a large topic, feed or search succeeds however many posts it matches.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { MAX_BOUND_PARAMETERS } from "@sdxc/search";

/**
 * Runs `read` over consecutive batches of `ids` and joins the rows in batch order. Each batch
 * leaves `reserved` bound values for the rest of the statement, such as a model's own scope or
 * an extra `in` list.
 *
 * @param ids Every id to read; none means no statement runs.
 * @param read Reads the rows for one batch of ids.
 * @param reserved Values the statement binds besides the ids.
 * @returns The rows of every batch.
 */
export async function readInBatches<Row>(
	ids: ReadonlyArray<string>,
	read: (ids: Array<string>) => Promise<Array<Row>>,
	reserved = 0,
): Promise<Array<Row>> {
	let size = MAX_BOUND_PARAMETERS - reserved;
	let rows: Array<Row> = [];
	for (let start = 0; start < ids.length; start += size) {
		rows.push(...(await read(ids.slice(start, start + size))));
	}
	return rows;
}
