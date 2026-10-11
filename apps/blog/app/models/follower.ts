/**
 * The ActivityPub followers of the blog's actor, stored in `activitypub_followers` and read
 * the way the federation package asks: idempotent single-statement writes, so D1 needs no
 * transaction, and keyset cursors that visit each follower and delivery target once.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Follower, FollowerStore, StorePage } from "@sdxc/activitypub";
import type { Result } from "@sdxc/result";
import type { Database } from "remix/data-table";

import { decodeCursor, encodeCursor, InvalidCursorError } from "@sdxc/pagination";
import { failure, isFailure, success, wrap } from "@sdxc/result";
import { rawSql, sql } from "remix/data-table";

import * as schema from "~/database/schema";

/** The keyset `list` pages by: newest follower first, the id breaking a tie. */
const LIST_KEYS = ["created_at", "id"] as const;

/** The keyset `inboxes` pages by: the delivery target itself, which is distinct per page. */
const INBOX_KEYS = ["target"] as const;

/** The columns a follower is read back from, in the order `toFollower` expects. */
const FOLLOWER_COLUMNS = `"actor", "id", "inbox", "shared_inbox", "follow_id", "state", "created_at"`;

/** A row as `list` reads it, with the timestamp its cursor carries. */
interface ListedRow extends Omit<schema.SelectActivityPubFollower, "updated_at"> {}

/** Reads and writes the followers of local ActivityPub actors over the blog's database. */
export class FollowerRepository implements FollowerStore {
	readonly #db: Database;

	/** @param db The request's or job's database, as the context publishes it. */
	constructor(db: Database) {
		this.#db = db;
	}

	/**
	 * Inserts the follower, or replaces inbox, shared inbox, Follow id and state of the row
	 * already stored for `(actor, id)` in the same statement, keeping when it first followed.
	 */
	async put(follower: Follower): Promise<Result<void, Error>> {
		let now = new Date().toISOString();
		let written = await wrap(() =>
			this.#db.exec(sql`
				insert into "activitypub_followers" ("actor", "id", "inbox", "shared_inbox", "follow_id", "state", "created_at", "updated_at")
				values (${follower.actor}, ${follower.id}, ${follower.inbox}, ${follower.sharedInbox}, ${follower.followId}, ${follower.state}, ${now}, ${now})
				on conflict ("actor", "id") do update set
					"inbox" = excluded."inbox",
					"shared_inbox" = excluded."shared_inbox",
					"follow_id" = excluded."follow_id",
					"state" = excluded."state",
					"updated_at" = excluded."updated_at"
			`),
		);
		if (isFailure(written)) return written;
		return success(undefined);
	}

	/** The follower in either state, so an Undo of a pending Follow still finds it. */
	async get(actor: string, id: string): Promise<Result<Follower | null, Error>> {
		let row = await wrap(() =>
			this.#db.findOne(schema.activityPubFollowers, { where: { actor, id } }),
		);
		if (isFailure(row)) return row;
		return success(row.data ? toFollower(row.data) : null);
	}

	/** Deleting an absent follower succeeds, so a repeated Undo is harmless. */
	async remove(actor: string, id: string): Promise<Result<void, Error>> {
		let deleted = await wrap(() =>
			this.#db.exec(
				sql`delete from "activitypub_followers" where "actor" = ${actor} and "id" = ${id}`,
			),
		);
		if (isFailure(deleted)) return deleted;
		return success(undefined);
	}

	/** Drops every follower, of any local actor and in any state, delivered through `inbox`. */
	async removeInbox(inbox: string): Promise<Result<void, Error>> {
		let deleted = await wrap(() =>
			this.#db.exec(
				sql`delete from "activitypub_followers" where "inbox" = ${inbox} or "shared_inbox" = ${inbox}`,
			),
		);
		if (isFailure(deleted)) return deleted;
		return success(undefined);
	}

	/**
	 * Accepted followers, newest first. `origin` keeps the ids under exactly that scheme, host
	 * and port, so `https://a.com` never matches `https://a.com.evil.net`; an origin that does
	 * not parse matches nobody. A cursor minted by another listing is an `InvalidCursorError`.
	 */
	async list(
		actor: string,
		options: { cursor: string | null; limit: number; origin?: string },
	): Promise<Result<StorePage<Follower>, Error>> {
		let conditions = [`"actor" = ?`, `"state" = 'accepted'`];
		let values: unknown[] = [actor];

		if (options.origin !== undefined) {
			let origin = originOf(options.origin);
			if (origin === null) return success({ items: [], next: null });
			let prefix = `${origin}/`;
			conditions.push(`("id" = ? or substr("id", 1, length(?)) = ?)`);
			values.push(origin, prefix, prefix);
		}

		if (options.cursor !== null) {
			let after = cursorValues(options.cursor, LIST_KEYS);
			if (isFailure(after)) return after;
			let [createdAt, id] = after.data;
			conditions.push(`("created_at" < ? or ("created_at" = ? and "id" < ?))`);
			values.push(createdAt, createdAt, id);
		}

		let limit = pageSize(options.limit);
		let result = await wrap(() =>
			this.#db.exec(
				rawSql(
					`select ${FOLLOWER_COLUMNS} from "activitypub_followers" where ${conditions.join(" and ")} order by "created_at" desc, "id" desc limit ?`,
					[...values, limit + 1],
				),
			),
		);
		if (isFailure(result)) return result;

		let rows = (result.data.rows ?? []) as ListedRow[];
		let page = rows.slice(0, limit);
		let last = page.at(-1);
		if (rows.length <= limit || last === undefined) {
			return success({ items: page.map(toFollower), next: null });
		}

		let next = encodeCursor("after", LIST_KEYS, [last.created_at, last.id]);
		if (isFailure(next)) return next;
		return success({ items: page.map(toFollower), next: next.data });
	}

	/** Accepted followers only, which is the `totalItems` the followers collection publishes. */
	async count(actor: string): Promise<Result<number, Error>> {
		return wrap(() =>
			this.#db.count(schema.activityPubFollowers, { where: { actor, state: "accepted" } }),
		);
	}

	/**
	 * Each accepted follower's delivery target, its shared inbox when it has one, listed once
	 * per URL in ascending order so the cursor is the last target itself.
	 */
	async inboxes(
		actor: string,
		options: { cursor: string | null; limit: number },
	): Promise<Result<StorePage<string>, Error>> {
		let target = `coalesce("shared_inbox", "inbox")`;
		let conditions = [`"actor" = ?`, `"state" = 'accepted'`];
		let values: unknown[] = [actor];

		if (options.cursor !== null) {
			let after = cursorValues(options.cursor, INBOX_KEYS);
			if (isFailure(after)) return after;
			conditions.push(`${target} > ?`);
			values.push(after.data[0]);
		}

		let limit = pageSize(options.limit);
		let result = await wrap(() =>
			this.#db.exec(
				rawSql(
					`select distinct ${target} as "target" from "activitypub_followers" where ${conditions.join(" and ")} order by "target" asc limit ?`,
					[...values, limit + 1],
				),
			),
		);
		if (isFailure(result)) return result;

		let targets = (result.data.rows ?? []).map((row) => String(row.target));
		let page = targets.slice(0, limit);
		let last = page.at(-1);
		if (targets.length <= limit || last === undefined) return success({ items: page, next: null });

		let next = encodeCursor("after", INBOX_KEYS, [last]);
		if (isFailure(next)) return next;
		return success({ items: page, next: next.data });
	}
}

/** The package's shape of a stored row; the table's CHECK keeps `state` to the two values. */
function toFollower(row: ListedRow): Follower {
	return {
		actor: row.actor,
		id: row.id,
		inbox: row.inbox,
		sharedInbox: row.shared_inbox,
		followId: row.follow_id,
		state: row.state === "pending" ? "pending" : "accepted",
	};
}

/** At least one row per page, so a cursor always advances. */
function pageSize(limit: number): number {
	return Math.max(1, Math.trunc(limit));
}

/** The serialized origin of `value`, or `null` for one that is not an absolute URL. */
function originOf(value: string): string | null {
	try {
		let origin = new URL(value).origin;
		return origin === "null" ? null : origin;
	} catch {
		return null;
	}
}

/**
 * The string values a cursor carries for `keys`, refusing one minted for any other keyset,
 * so a followers cursor handed to `inboxes` fails instead of seeking from a wrong value.
 */
function cursorValues(
	cursor: string,
	keys: ReadonlyArray<string>,
): Result<string[], InvalidCursorError> {
	let decoded = decodeCursor(cursor);
	if (isFailure(decoded)) return decoded;

	let { columns, values } = decoded.data;
	let matches = columns.length === keys.length && columns.every((key, at) => key === keys[at]);
	if (!matches || decoded.data.direction !== "after") {
		return failure(new InvalidCursorError("minted for another listing"));
	}

	let strings = values.filter((value) => typeof value === "string");
	if (strings.length !== keys.length) return failure(new InvalidCursorError("not a text keyset"));
	return success(strings);
}
