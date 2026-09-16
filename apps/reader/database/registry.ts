/**
 * The feed catalog, and the only module that holds its binding. A feed is named by an id
 * the catalog assigns it the first time anybody follows it, so every caller asks for an
 * id rather than writing SQL, and identity survives any later change to how a URL is
 * normalized.
 *
 * Every function here belongs to the follow path or to the end of a feed's life. Nothing
 * that renders a page reaches this database: a subscription stores the feed's id, so a
 * reader who already follows a feed reaches its object without a lookup.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createD1DatabaseAdapter } from "@sdxc/data-table-d1";
import { TypeID } from "@sdxc/typeid";
import { generateUUID } from "@sdxc/uuid";
import { env } from "cloudflare:workers";
import { Database, sql } from "remix/data-table";

import { catalogFeeds } from "~/database/catalog-schema";

/** The isolate's connection, opened by whichever follow or poll reaches it first. */
let database: Database | undefined;

/**
 * Opens the catalog's connection, once per isolate.
 *
 * `now` is overridden to epoch-ms because the timestamp columns hold milliseconds since
 * the epoch: D1 binds an integer, which sorts and compares correctly against every row
 * already stored.
 */
function connect(): Database {
	return (database ??= new Database(createD1DatabaseAdapter(env.PLATFORM_DB), {
		now: () => Date.now(),
	}));
}

/**
 * Exchanges a canonical feed URL for the id that names its Durable Object, minting one
 * for a URL nobody has followed yet and returning the existing id for one somebody has.
 *
 * Call this with the URL the follow path has already normalized and resolved through
 * discovery, since the URL is what decides whether two people are following one feed.
 * Concurrent first follows of one URL converge: both pass through `UNIQUE (feed_url)`,
 * and the loser of the race is handed the winner's id.
 *
 * @param feedUrl - The canonical URL, as discovery finally reported it
 * @param title - The feed's title, denormalized so a list reads without waking the object
 * @returns The feed's id, which `env.FEED.getByName` addresses its object by
 * @example
 * let feedId = await registerFeed(discovered.url, discovered.title);
 * await env.FEED.getByName(feedId).subscribe(subject);
 */
export async function registerFeed(feedUrl: string, title: string): Promise<string> {
	let minted = TypeID.fromUUID("feed", generateUUID()).toString();

	// Written as DO UPDATE rather than DO NOTHING, and the difference is the whole
	// statement: SQLite returns no row for a conflicting insert that does nothing, so
	// every follower after the first would get back nothing at all. Writing the URL onto
	// itself is what makes the statement always answer with an id.
	let { rows = [] } = await connect().exec(sql`
		insert into feeds (id, feed_url, title, created_at)
		values (${minted}, ${feedUrl}, ${title}, ${Date.now()})
		on conflict (feed_url) do update set feed_url = excluded.feed_url
		returning id
	`);

	let id = rows[0]?.["id"];
	if (typeof id !== "string") throw new Error(`the catalog returned no id for ${feedUrl}`);

	return id;
}

/**
 * Records that a feed published something, which is the only thing that moves the stamp:
 * call it where a poll stores an item, so a `304` and an idle feed both leave it alone
 * and the column means what a list of feeds would suggest it means.
 *
 * Best-effort, because the items are already stored by the time it runs: a failed write
 * costs a wrong timestamp in an administrative list and nothing else.
 *
 * @param feedId - The feed whose stamp moves
 * @returns Whether the stamp landed, so a caller that logs its poll can say it did not
 */
export async function stampActivity(feedId: string): Promise<boolean> {
	try {
		let { affectedRows } = await connect().updateMany(
			catalogFeeds,
			{ last_active_at: Date.now() },
			{ where: { id: feedId } },
		);

		return affectedRows > 0;
	} catch {
		return false;
	}
}

/**
 * Writes what a feed calls itself, once its own object has read the document and knows.
 *
 * The id is minted from a URL, before anything has been fetched, so the row starts out
 * named after the address it was created from. The name a list of feeds should show is
 * the one the publisher gave, and the object holding the feed is the only thing that has
 * read it.
 *
 * Best-effort, for the reason the activity stamp is: this runs after the feed is stored,
 * and a title that lags costs a readable line in an administrative list and nothing else.
 *
 * @param feedId - The feed being named
 * @param title - The title the feed document carries
 * @returns Whether the name landed
 */
export async function renameFeed(feedId: string, title: string): Promise<boolean> {
	try {
		let { affectedRows } = await connect().updateMany(
			catalogFeeds,
			{ title },
			{ where: { id: feedId } },
		);

		return affectedRows > 0;
	} catch {
		return false;
	}
}

/**
 * Marks a feed as having lost its last subscriber, which starts its grace period.
 *
 * The row stays. A feed serving out its week is visible as exactly that, and a reader who
 * follows it again inside the week is handed the same id and the same object, with its
 * items still in place.
 *
 * Best-effort, because the subscriber has already gone by the time it runs: it is called
 * from inside an alarm that must never reject and from an unfollow the reader has already
 * been told succeeded, and a row left unmarked costs an administrative list its accuracy.
 *
 * @param feedId - The feed whose last subscriber just left
 */
export async function retireFeed(feedId: string): Promise<void> {
	try {
		await connect().updateMany(catalogFeeds, { retired_at: Date.now() }, { where: { id: feedId } });
	} catch {
		return;
	}
}

/**
 * Returns a retired feed to service, for a subscriber arriving inside its grace period.
 *
 * Safe on a feed that was never retired: it clears a column that is already clear. Also
 * best-effort, for the reason retiring is — the subscription it accompanies is already
 * written, and a feed listed as retired while somebody reads it is a wrong line in a list
 * rather than anything a reader meets.
 *
 * @param feedId - The feed somebody has just followed again
 */
export async function reviveFeed(feedId: string): Promise<void> {
	try {
		await connect().updateMany(catalogFeeds, { retired_at: null }, { where: { id: feedId } });
	} catch {
		return;
	}
}

/**
 * Drops a feed from the catalog, which the purge does alongside clearing the object's
 * storage and its head key.
 *
 * Call it only from that purge. A row deleted while the object still holds items would
 * hand the next follower a new id, a new object, and no way ever to reach the old one.
 *
 * @param feedId - The feed being purged
 * @returns Whether a row was there to delete
 */
export async function deleteFeed(feedId: string): Promise<boolean> {
	return await connect().delete(catalogFeeds, { id: feedId });
}
