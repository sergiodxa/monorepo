/**
 * The system's record of each bookmark: the address that keeps a URL from being saved
 * twice, and what the latest read of the page came to. The database's unique index on the
 * address is the guarantee; the lookups here only let a caller answer a duplicate politely.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { sql } from "remix/data-table";

import * as schema from "~/database/schema";

/** Types for the bookmark record. */
export namespace Bookmark {
	/**
	 * What reading a page came to. Only `moved` and `gone` raise a flag; `blocked` and
	 * `flaky` mean the read could not tell.
	 */
	export type Status = NonNullable<schema.SelectBookmark["status"]>;

	/** One read of a bookmarked page, as the record stores it. */
	export interface Reading {
		status: Status;
		/** The final response's status, or `null` when no response arrived. */
		httpStatus: number | null;
		/** Where the redirect chain ended, or `null` when no response arrived. */
		finalUrl: string | null;
	}
}

/** Reads and writes the `bookmarks` table. */
export class Bookmark {
	/** Table the record lives in. */
	static table = schema.bookmarks;

	/** The record of one bookmark, or `null` while it has none. */
	static findByPostId(db: Database, postId: string) {
		return db.findOne(this.table, { where: { post_id: postId } });
	}

	/**
	 * The live bookmark holding an address. Deleting a bookmark removes its record, so a
	 * match is always a bookmark that still exists.
	 *
	 * @param db Database handle used for the lookup.
	 * @param address An address from `LikePost.address`.
	 */
	static findByAddress(db: Database, address: string) {
		return db.findOne(this.table, { where: { address } });
	}

	/**
	 * Gives a new bookmark its address, unless another bookmark took it first: the insert
	 * yields to the unique index, so of two concurrent saves of one URL exactly one claims it.
	 * A page read as `ok` while saving also counts as the attempt to describe the bookmark.
	 *
	 * @param db Database handle used for the write.
	 * @param postId The bookmark claiming the address.
	 * @param address Its address.
	 * @param reading What reading the page came to, when it was read before saving.
	 * @returns Whether this bookmark holds the address now.
	 */
	static async claim(
		db: Database,
		postId: string,
		address: string,
		reading: Bookmark.Reading | null,
	): Promise<boolean> {
		let now = new Date().toISOString();
		let checkedAt = reading ? now : null;
		let describedAt = reading?.status === "ok" ? now : null;
		await db.exec(sql`
			insert into "bookmarks" ("post_id", "address", "status", "http_status", "final_url", "checked_at", "described_at")
			values (${postId}, ${address}, ${reading?.status ?? null}, ${reading?.httpStatus ?? null}, ${reading?.finalUrl ?? null}, ${checkedAt}, ${describedAt})
			on conflict do nothing
		`);

		let claimed = await this.findByPostId(db, postId);
		return claimed?.address === address;
	}

	/**
	 * Moves a bookmark to a new address and forgets everything read from the old one: its
	 * check, its flag and its archive attempts all belonged to the previous URL. A bookmark
	 * that had no record gets one.
	 *
	 * @param db Database handle used for the write.
	 * @param postId The bookmark whose URL changed.
	 * @param address The new URL's address, which the caller checked is free.
	 */
	static async readdress(db: Database, postId: string, address: string): Promise<void> {
		await db.exec(sql`
			insert into "bookmarks" ("post_id", "address") values (${postId}, ${address})
			on conflict ("post_id") do update set
				"address" = excluded."address",
				"status" = null,
				"http_status" = null,
				"final_url" = null,
				"checked_at" = null,
				"flag" = null,
				"flagged_at" = null,
				"notified_at" = null,
				"described_at" = null,
				"archive_attempted_at" = null,
				"archive_job" = null
		`);
	}

	/**
	 * Closes every flag raised before now: the bookmark was looked at and saved, whether or
	 * not anything changed.
	 *
	 * @param db Database handle used for the write.
	 * @param postId The reviewed bookmark.
	 */
	static async review(db: Database, postId: string): Promise<void> {
		await db.exec(sql`
			update "bookmarks" set "reviewed_at" = ${new Date().toISOString()} where "post_id" = ${postId}
		`);
	}

	/**
	 * Releases a deleted bookmark's address.
	 *
	 * @param db Database handle used for the write.
	 * @param postId The deleted bookmark.
	 */
	static async remove(db: Database, postId: string): Promise<void> {
		await db.exec(sql`delete from "bookmarks" where "post_id" = ${postId}`);
	}
}
