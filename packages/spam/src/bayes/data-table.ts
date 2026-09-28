/**
 * A token store over `remix/data-table`, for D1 and Durable Object SQLite alike. Every write is
 * an `insert … on conflict do update` adding to the stored counts, so concurrent reports never
 * lose an increment without the transactions D1 lacks. The host app owns the table's migration.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";
import type { Database, TableRow } from "remix/data-table";

import { failure, success } from "@sdxc/result";
import { column as c, inList, rawSql, table } from "remix/data-table";

import type { Label } from "../check.js";

import { SpamCheckError } from "../check.js";

import type { TokenStore } from "./store.js";

/**
 * One row per token with the number of spam and ham documents it appeared in. The row for
 * {@link DOCUMENTS_TOKEN} holds the document totals. See {@link SPAM_TOKENS_SCHEMA_SQL}.
 */
export const spamTokens = table({
	name: "spam_tokens",
	primaryKey: ["token"],
	columns: {
		token: c.text(),
		spam: c.integer(),
		ham: c.integer(),
	},
});

/** A token's counts, as loaded from {@link spamTokens}. */
export type SpamTokenRow = TableRow<typeof spamTokens>;

/**
 * SQL creating the table {@link DataTableTokenStore} needs, for a host app to paste into its own
 * migration. The primary key is the only index, since every read and write is by token.
 */
export const SPAM_TOKENS_SCHEMA_SQL = `create table spam_tokens (
	token text primary key,
	spam integer not null default 0,
	ham integer not null default 0
);`;

/**
 * The row holding the document totals. Tokenized content never contains `@` outside a prefixed
 * token, so this key never collides with a real token.
 */
export const DOCUMENTS_TOKEN = "@documents";

/** Tokens bound per statement, keeping each query under D1's limit of 100 bound parameters. */
const TOKENS_PER_STATEMENT = 90;

/**
 * Stores counts in {@link spamTokens}. A report writes its tokens in statements of at most
 * {@link TOKENS_PER_STATEMENT}, with the document total in the last one, so a failure part way
 * undercounts a document's tokens and never counts a document whose tokens were not written.
 */
export class DataTableTokenStore implements TokenStore {
	#db: Database;

	/**
	 * @param db - A database whose schema includes {@link spamTokens}; one per tenant
	 */
	constructor(db: Database) {
		this.#db = db;
	}

	/**
	 * Reads the requested tokens and the totals row in batches of {@link TOKENS_PER_STATEMENT}.
	 *
	 * @returns The counts, or an `unavailable` error when a query fails
	 */
	async read(tokens: readonly string[]): Promise<Result<TokenStore.Counts, SpamCheckError>> {
		let keys = [DOCUMENTS_TOKEN, ...new Set(tokens)];
		let rows: SpamTokenRow[] = [];
		try {
			for (let batch of chunk(keys, TOKENS_PER_STATEMENT)) {
				rows.push(...(await this.#db.findMany(spamTokens, { where: inList("token", batch) })));
			}
		} catch (error) {
			return failure(storeError("could not be read", error));
		}

		let documents: TokenStore.Tally = { spam: 0, ham: 0 };
		let found = new Map<string, TokenStore.Tally>();
		for (let row of rows) {
			let tally = { spam: storedCount(row.spam), ham: storedCount(row.ham) };
			if (row.token === DOCUMENTS_TOKEN) documents = tally;
			else found.set(row.token, tally);
		}
		return success({ documents, tokens: found });
	}

	/**
	 * Adds one document with single-statement upserts; see {@link DataTableTokenStore}.
	 *
	 * @returns Success, or an `unavailable` error when a write fails
	 */
	async increment(tokens: readonly string[], label: Label): Promise<Result<void, SpamCheckError>> {
		let batches = chunk([...new Set(tokens)], TOKENS_PER_STATEMENT);
		if (batches.length === 0) batches.push([]);
		let row = label === "spam" ? "(?, 1, 0)" : "(?, 0, 1)";
		try {
			for (let [index, batch] of batches.entries()) {
				let keys = index === batches.length - 1 ? [...batch, DOCUMENTS_TOKEN] : batch;
				await this.#db.exec(
					rawSql(
						`insert into spam_tokens (token, spam, ham) values ${keys.map(() => row).join(", ")}
on conflict (token) do update set
	spam = spam_tokens.spam + excluded.spam,
	ham = spam_tokens.ham + excluded.ham`,
						keys,
					),
				);
			}
		} catch (error) {
			return failure(storeError("could not be written", error));
		}
		return success(undefined);
	}
}

/**
 * Splits `items` into consecutive batches of at most `size`.
 *
 * @template T - The item type
 * @returns No batches for an empty list
 */
function chunk<T>(items: readonly T[], size: number): T[][] {
	let batches: T[][] = [];
	for (let start = 0; start < items.length; start += size) {
		batches.push(items.slice(start, start + size));
	}
	return batches;
}

/**
 * Coerces a stored count that a driver may hand back as text or a bigint, reading anything
 * unusable as zero so one bad row leaves the rest of the classification intact.
 */
function storedCount(value: unknown): number {
	let count = Number(value);
	return Number.isFinite(count) && count > 0 ? Math.trunc(count) : 0;
}

/** Wraps a driver error as the `unavailable` failure the filter records and moves past. */
function storeError(what: string, cause: unknown): SpamCheckError {
	let reason = cause instanceof Error ? cause.message : String(cause);
	return new SpamCheckError("unavailable", `the spam token table ${what}: ${reason}`);
}
