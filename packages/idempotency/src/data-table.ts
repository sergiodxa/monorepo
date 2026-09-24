/**
 * An `IdempotencyStore` over `remix/data-table`, for D1 and Durable Object SQLite alike.
 * The claim is one conditional upsert, so of two concurrent requests exactly one wins with
 * no transaction, which D1 lacks; the host app owns the table through its own migration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";
import type { Database, TableRow } from "remix/data-table";

import { failure, success } from "@sdxc/result";
import { and, column as c, eq, lte, sql, table } from "remix/data-table";

import type { ClaimOutcome, ClaimRequest, IdempotencyStore, StoredResponse } from "./types.js";

import { IdempotencyStoreError } from "./errors.js";
import { isStoredResponse } from "./lib/stored-response.js";

/**
 * One record per claimed id. Instants are epoch milliseconds so every expiry test is
 * integer arithmetic on each dialect. See {@link IDEMPOTENCY_KEYS_SCHEMA_SQL}.
 */
export const idempotencyKeys = table({
	name: "idempotency_keys",
	primaryKey: ["id"],
	columns: {
		id: c.text(),
		fingerprint: c.text().nullable(),
		/** The token of the claim that owns the row; `complete` and `release` must present it. */
		lease: c.text(),
		/** `in-flight` until the handler's outcome is stored, then `completed`. */
		state: c.text(),
		/** The stored response as JSON text, `null` while in flight. */
		response: c.text().nullable(),
		/** When an in-flight claim counts as abandoned and a retry may take it over. */
		lease_expires_at: c.integer(),
		/** When the record stops counting and `purgeExpired` may delete it. */
		expires_at: c.integer(),
	},
});

/** A record as loaded from {@link idempotencyKeys}. */
export type IdempotencyKeyRow = TableRow<typeof idempotencyKeys>;

/**
 * SQL creating the table and its expiry index, for the host app to paste into its own
 * migration. The index serves {@link purgeExpired}; every other access is by primary key.
 */
export const IDEMPOTENCY_KEYS_SCHEMA_SQL = `create table idempotency_keys (
	id text primary key,
	fingerprint text,
	lease text not null,
	state text not null,
	response text,
	lease_expires_at integer not null,
	expires_at integer not null
);

create index idempotency_keys_expires_at_idx on idempotency_keys (expires_at);`;

/**
 * Stores records in {@link idempotencyKeys}. `claim` writes with one statement and reads
 * the row back: the row's lease equals the one just written exactly when this call won.
 */
export class DataTableStore implements IdempotencyStore {
	#db: Database;

	/**
	 * @param db - A database whose schema includes {@link idempotencyKeys}
	 */
	constructor(db: Database) {
		this.#db = db;
	}

	/**
	 * Claims with `insert … on conflict do update … where`, which takes over an existing
	 * row only when it expired or is in flight past its lease; `remix/data-table`'s upsert
	 * has no conflict condition, so the statement is written as SQL.
	 *
	 * @param request - The id, fingerprint and instants to judge the record by
	 */
	async claim(request: ClaimRequest): Promise<Result<ClaimOutcome, IdempotencyStoreError>> {
		let lease = crypto.randomUUID();
		let row: IdempotencyKeyRow | null;
		try {
			await this.#db.exec(sql`insert into idempotency_keys
	(id, fingerprint, lease, state, response, lease_expires_at, expires_at)
values
	(${request.id}, ${request.fingerprint}, ${lease}, 'in-flight', null, ${request.now + request.leaseMs}, ${request.expiresAt})
on conflict (id) do update set
	fingerprint = excluded.fingerprint,
	lease = excluded.lease,
	state = excluded.state,
	response = null,
	lease_expires_at = excluded.lease_expires_at,
	expires_at = excluded.expires_at
where idempotency_keys.expires_at <= ${request.now}
	or (idempotency_keys.state = 'in-flight' and idempotency_keys.lease_expires_at <= ${request.now})`);
			row = await this.#db.find(idempotencyKeys, { id: request.id });
		} catch (error) {
			return failure(
				new IdempotencyStoreError("The idempotency record could not be claimed", { cause: error }),
			);
		}

		if (row === null) {
			return failure(new IdempotencyStoreError("The claimed idempotency record is missing"));
		}
		if (row.lease === lease) return success({ status: "claimed", lease });
		if (row.state === "in-flight") {
			return success({ status: "in-flight", fingerprint: row.fingerprint });
		}

		let response = parseStoredResponse(row.response);
		if (response === null) {
			return failure(new IdempotencyStoreError("The stored idempotency response is unreadable"));
		}
		return success({ status: "completed", fingerprint: row.fingerprint, response });
	}

	/**
	 * Stores the outcome with one `update … where id = ? and lease = ?`, so a lease that
	 * was taken over matches no row.
	 *
	 * @param id - The record id
	 * @param lease - The lease `claim` handed out
	 * @param response - The outcome to replay
	 * @param expiresAt - Epoch milliseconds until which the outcome is replayed
	 */
	async complete(
		id: string,
		lease: string,
		response: StoredResponse,
		expiresAt: number,
	): Promise<Result<void, IdempotencyStoreError>> {
		try {
			await this.#db.updateMany(
				idempotencyKeys,
				{ state: "completed", response: JSON.stringify(response), expires_at: expiresAt },
				{ where: and(eq("id", id), eq("lease", lease)) },
			);
			return success(undefined);
		} catch (error) {
			return failure(
				new IdempotencyStoreError("The idempotency response could not be stored", { cause: error }),
			);
		}
	}

	/**
	 * Deletes the row while `lease` holds and it is still in flight, with one statement.
	 *
	 * @param id - The record id
	 * @param lease - The lease `claim` handed out
	 */
	async release(id: string, lease: string): Promise<Result<void, IdempotencyStoreError>> {
		try {
			await this.#db.deleteMany(idempotencyKeys, {
				where: and(eq("id", id), eq("lease", lease), eq("state", "in-flight")),
			});
			return success(undefined);
		} catch (error) {
			return failure(
				new IdempotencyStoreError("The idempotency record could not be released", { cause: error }),
			);
		}
	}
}

/**
 * Deletes every record whose expiry has passed, completed or abandoned. Run it from a
 * scheduled job; an expired row is already ignored by `claim`, so a late purge only costs
 * storage.
 *
 * @param db - A database whose schema includes {@link idempotencyKeys}
 * @param now - Epoch milliseconds to judge expiry by
 * @returns How many rows were deleted
 * @example await purgeExpired(ctx.db)
 */
export async function purgeExpired(
	db: Database,
	now: number = Date.now(),
): Promise<Result<number, IdempotencyStoreError>> {
	try {
		let result = await db.deleteMany(idempotencyKeys, { where: lte("expires_at", now) });
		return success(result.affectedRows);
	} catch (error) {
		return failure(
			new IdempotencyStoreError("Expired idempotency records could not be purged", {
				cause: error,
			}),
		);
	}
}

/**
 * Reads the `response` column back into a stored response.
 *
 * @param text - The column value
 * @returns The response, or `null` when the column is empty, not JSON, or the wrong shape
 */
function parseStoredResponse(text: string | null): StoredResponse | null {
	if (text === null) return null;
	let value: unknown;
	try {
		value = JSON.parse(text);
	} catch {
		return null;
	}
	return isStoredResponse(value) ? value : null;
}
