/**
 * The system's record of each bookmark: the address that keeps a URL from being saved
 * twice, and what the latest read of the page came to. The database's unique index on the
 * address is the guarantee; the lookups here only let a caller answer a duplicate politely.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { notNull, sql } from "remix/data-table";

import * as schema from "~/database/schema";

/** Types for the bookmark record. */
export namespace Bookmark {
	/**
	 * What reading a page came to. Only `moved` and `gone` raise a flag; `blocked` and
	 * `flaky` mean the read could not tell.
	 */
	export type Status = "ok" | "moved" | "gone" | "blocked" | "flaky";

	/** The outcomes that raise a flag for review. */
	export type Flag = "moved" | "gone";

	/** One read of a bookmarked page, as the record stores it. */
	export interface Reading {
		status: Status;
		/** The final response's status, or `null` when no response arrived. */
		httpStatus: number | null;
		/** Where the redirect chain ended, or `null` when no response arrived. */
		finalUrl: string | null;
	}
}

/** Every outcome a read can record, in the order the CMS explains them. */
const STATUSES: ReadonlyArray<Bookmark.Status> = ["ok", "moved", "gone", "blocked", "flaky"];

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
	 * A record's latest outcome, or `null` while the page was never read.
	 *
	 * @param record A bookmark's record.
	 */
	static statusOf(record: schema.SelectBookmark): Bookmark.Status | null {
		return STATUSES.find((status) => status === record.status) ?? null;
	}

	/**
	 * A record's raised flag, or `null` while none is raised.
	 *
	 * @param record A bookmark's record.
	 */
	static flagOf(record: schema.SelectBookmark): Bookmark.Flag | null {
		return record.flag === "moved" || record.flag === "gone" ? record.flag : null;
	}

	/**
	 * Whether a reading would raise a flag the bookmark does not hold yet, which is the
	 * reading worth confirming before it is recorded.
	 *
	 * @param record The bookmark's record, or `null` while it has none.
	 * @param reading What the page came to now.
	 */
	static raises(record: schema.SelectBookmark | null, reading: Bookmark.Reading): boolean {
		let flagged = reading.status === "moved" || reading.status === "gone";
		return flagged && record?.flag !== reading.status;
	}

	/**
	 * Records a read of the page and moves the flag with it: `ok` clears it, a `moved` or
	 * `gone` the flag does not already say raises it anew, and `blocked` or `flaky` leave it
	 * as it was, since they say nothing about the page itself.
	 *
	 * @param db Database handle used for the write.
	 * @param postId The bookmark that was read.
	 * @param reading What the page came to.
	 */
	static async record(db: Database, postId: string, reading: Bookmark.Reading): Promise<void> {
		let now = new Date().toISOString();
		let raised = reading.status === "moved" || reading.status === "gone" ? reading.status : null;
		await db.exec(sql`
			update "bookmarks" set
				"status" = ${reading.status},
				"http_status" = ${reading.httpStatus},
				"final_url" = ${reading.finalUrl},
				"checked_at" = ${now},
				"flag" = case
					when ${reading.status} = 'ok' then null
					when ${raised} is not null then ${raised}
					else "flag"
				end,
				"flagged_at" = case
					when ${reading.status} = 'ok' then null
					when ${raised} is not null and ("flag" is null or "flag" <> ${raised}) then ${now}
					else "flagged_at"
				end
			where "post_id" = ${postId}
		`);
	}

	/**
	 * Stamps the attempt to fill a bookmark's title and description from its page, made or
	 * not, so the record says when the page last had a chance to describe it.
	 *
	 * @param db Database handle used for the write.
	 * @param postId The bookmark that was described.
	 */
	static async described(db: Database, postId: string): Promise<void> {
		await db.exec(sql`
			update "bookmarks" set "described_at" = ${new Date().toISOString()} where "post_id" = ${postId}
		`);
	}

	/**
	 * Whether a record's flag is open: raised, and raised after the last CMS save.
	 *
	 * @param record A bookmark's record.
	 */
	static isOpen(record: schema.SelectBookmark): boolean {
		if (record.flag === null || record.flagged_at === null) return false;
		return record.reviewed_at === null || record.reviewed_at < record.flagged_at;
	}

	/**
	 * Every open flag the digest has not reported, oldest first, so a flag reaches the inbox
	 * once and a flag raised again after a review reaches it again.
	 *
	 * @param db Database handle used for the lookup.
	 */
	static async findUnreported(db: Database): Promise<schema.SelectBookmark[]> {
		let rows = await db.findMany(this.table, { where: notNull("flag") });
		return rows
			.filter((row) => this.isOpen(row))
			.filter((row) => row.notified_at === null || row.notified_at < (row.flagged_at ?? ""))
			.sort((a, b) => (a.flagged_at ?? "").localeCompare(b.flagged_at ?? ""));
	}

	/**
	 * Every open flag, for the CMS list to mark.
	 *
	 * @param db Database handle used for the lookup.
	 * @returns The open records keyed by bookmark.
	 */
	static async findOpen(db: Database): Promise<Map<string, schema.SelectBookmark>> {
		let rows = await db.findMany(this.table, { where: notNull("flag") });
		return new Map(rows.filter((row) => this.isOpen(row)).map((row) => [row.post_id, row]));
	}

	/**
	 * Stamps the flags a digest reported.
	 *
	 * @param db Database handle used for the write.
	 * @param postIds The bookmarks the digest listed.
	 * @param at When the digest was sent.
	 */
	static async reported(db: Database, postIds: string[], at: string): Promise<void> {
		for (let postId of postIds) await db.update(this.table, postId, { notified_at: at });
	}

	/**
	 * Every record, keyed by bookmark, for the weekly check to decide what is due.
	 *
	 * @param db Database handle used for the lookup.
	 */
	static async findAll(db: Database): Promise<Map<string, schema.SelectBookmark>> {
		let rows = await db.findMany(this.table);
		return new Map(rows.map((row) => [row.post_id, row]));
	}

	/**
	 * Holds the Wayback Machine capture being taken, so the next run of the archive job reads
	 * its progress instead of asking for another.
	 *
	 * @param db Database handle used for the write.
	 * @param postId The bookmark being archived.
	 * @param jobId The capture job Save Page Now answered.
	 */
	static async archiving(db: Database, postId: string, jobId: string): Promise<void> {
		await db.update(this.table, postId, {
			archive_job: jobId,
			archive_attempted_at: new Date().toISOString(),
		});
	}

	/**
	 * Ends an archive attempt, captured or not: the capture job is released and the attempt
	 * dated, which is what spaces a failed bookmark's next attempt.
	 *
	 * @param db Database handle used for the write.
	 * @param postId The bookmark that was archived.
	 */
	static async archived(db: Database, postId: string): Promise<void> {
		await db.update(this.table, postId, {
			archive_job: null,
			archive_attempted_at: new Date().toISOString(),
		});
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
