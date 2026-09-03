/**
 * Sliding-window counters stored through `remix/data-table`, one row per counted
 * attempt. Talking to the query layer keeps the same limiter portable across D1
 * and Durable Object SQLite.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DurationInput } from "@sdxc/duration";
import type { Result } from "@sdxc/result";
import type { Database, TableRow } from "remix/data-table";

import { failure, success } from "@sdxc/result";
import { and, column as c, eq, gte, lt, table } from "remix/data-table";

import type { Adapter, RateLimitDecision } from "./types.js";

import { normalizeCost } from "./cost.js";
import { RateLimitError } from "./rate-limit-error.js";
import { retryAfterSeconds, windowLengthMs } from "./window.js";

/**
 * One counted attempt: which bucket it belongs to, what it cost, and when it
 * happened. `created_at` is epoch milliseconds so the sliding window is plain
 * integer arithmetic on every dialect. See {@link RATE_LIMIT_HITS_SCHEMA_SQL}.
 */
export const rateLimitHits = table({
	name: "rate_limit_hits",
	primaryKey: ["id"],
	columns: {
		id: c.text(),
		/** The prefixed rate limit key this attempt was counted against. */
		bucket: c.text(),
		/** Budget units the attempt spent, normally 1. */
		cost: c.integer(),
		/** Epoch milliseconds the attempt was counted at. */
		created_at: c.integer(),
	},
});

/**
 * SQL creating the table and index {@link DataTableAdapter} needs, for a host app
 * to paste into its own migration. The index carries both columns in query order,
 * because every read is "this bucket, since this instant".
 */
export const RATE_LIMIT_HITS_SCHEMA_SQL = `create table rate_limit_hits (
	id text primary key,
	bucket text not null,
	cost integer not null,
	created_at integer not null
);

create index rate_limit_hits_bucket_created_at_idx on rate_limit_hits (bucket, created_at);`;

/** A stored attempt, as loaded from the table. */
export type RateLimitHitRow = TableRow<typeof rateLimitHits>;

/** How a {@link DataTableAdapter} is configured. */
export interface DataTableAdapterOptions {
	/** Requests permitted per window. */
	limit: number;
	/** Length of the sliding window. */
	window: DurationInput;
}

/**
 * Counts attempts as rows over a window that slides with the clock, keeping
 * per-bucket rows inspectable with no shared boundary to stampede. D1 has no
 * interactive transactions, so concurrent attempts can push the limit over.
 */
export class DataTableAdapter implements Adapter {
	/** Requests permitted per window, as configured. */
	readonly limit: number;

	/** Length of the sliding window, as configured. */
	readonly window: DurationInput;

	/** The database holding the attempt rows. */
	#db: Database;

	/**
	 * Wraps a database as a sliding-window limiter.
	 *
	 * @param db - A `remix/data-table` database whose schema includes {@link rateLimitHits}.
	 * @param options - Limit and window; see {@link DataTableAdapterOptions}.
	 */
	constructor(db: Database, options: DataTableAdapterOptions) {
		this.#db = db;
		this.limit = options.limit;
		this.window = options.window;
	}

	/**
	 * Spends budget for a key, deleting rows aged out of the window before
	 * reading so the table stays proportional to traffic. A denial writes
	 * nothing, so reset reflects when the oldest attempt actually ages out.
	 *
	 * @param key - Namespaced identifier being limited.
	 * @param cost - Units to spend, at least 1; defaults to 1.
	 * @returns The decision, or a `RateLimitError` when a query fails.
	 */
	async consume(key: string, cost?: number): Promise<Result<RateLimitDecision, RateLimitError>> {
		let now = Date.now();
		let length = windowLengthMs(this.window);
		let windowStart = now - length;
		let spend = normalizeCost(cost);

		let rows: RateLimitHitRow[];
		try {
			await this.#db.deleteMany(rateLimitHits, {
				where: and(eq("bucket", key), lt("created_at", windowStart)),
			});

			rows = await this.#db.findMany(rateLimitHits, {
				where: and(eq("bucket", key), gte("created_at", windowStart)),
				orderBy: ["created_at", "asc"],
			});
		} catch (error) {
			return failure(
				new RateLimitError("The rate limit table could not be read", {
					backend: "data-table",
					key,
					cause: error,
				}),
			);
		}

		let used = rows.reduce((total, row) => total + normalizeStoredNumber(row.cost), 0);
		let requested = used + spend;
		let allowed = requested <= this.limit;

		if (allowed) {
			try {
				await this.#db.create(rateLimitHits, {
					id: crypto.randomUUID(),
					bucket: key,
					cost: spend,
					created_at: now,
				});
			} catch (error) {
				return failure(
					new RateLimitError("The rate limit table could not be written", {
						backend: "data-table",
						key,
						cause: error,
					}),
				);
			}
			used = requested;
		}

		let oldest = rows.length > 0 ? normalizeStoredNumber(rows[0]?.created_at) : now;
		let reset = oldest + length;

		return success({
			allowed,
			limit: this.limit,
			remaining: Math.max(0, this.limit - used),
			reset: new Date(reset),
			retryAfter: retryAfterSeconds(now, reset),
		});
	}

	/**
	 * Deletes every counted attempt for a key, including ones still inside the
	 * window, so the next attempt starts from an empty budget.
	 *
	 * @param key - Namespaced identifier to clear.
	 * @returns Success, or a `RateLimitError` when the delete fails.
	 */
	async reset(key: string): Promise<Result<void, RateLimitError>> {
		try {
			await this.#db.deleteMany(rateLimitHits, { where: eq("bucket", key) });
			return success(undefined);
		} catch (error) {
			return failure(
				new RateLimitError("The rate limit table could not be cleared", {
					backend: "data-table",
					key,
					cause: error,
				}),
			);
		}
	}
}

/**
 * Coerces a stored integer that an adapter may hand back as text or a bigint,
 * treating anything unreadable as zero so one bad row cannot deny a whole key.
 *
 * @param value - The column value as loaded.
 * @returns A finite whole number, never negative.
 */
function normalizeStoredNumber(value: unknown): number {
	let count = Number(value);
	if (!Number.isFinite(count) || count < 0) return 0;
	return Math.trunc(count);
}
