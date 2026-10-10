/**
 * The page a like bookmarks, keyed by its post: the address duplicates are judged by, what the
 * latest read of the page came to, and the flag a moved or gone page raises for review. Writes
 * that must land whole on D1 are single statements, so two requests cannot both claim a page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createModel } from "@sdxc/data-model";
import { notNull, sql } from "remix/data-table";

import type { SelectBookmark } from "~/database/schema";

import { bookmarks } from "~/database/schema";

/** What the latest read of a bookmarked page came to. */
export type BookmarkStatus = "ok" | "moved" | "gone" | "blocked" | "flaky";

/** The outcomes that raise a flag for review. */
export type BookmarkFlag = "moved" | "gone";

/** One read of a bookmarked page. */
export interface BookmarkReading {
	status: BookmarkStatus;
	httpStatus: number | null;
	finalUrl: string | null;
}

/** The statuses a stored row may hold, so an unknown value reads as unchecked. */
const STATUSES: ReadonlyArray<BookmarkStatus> = ["ok", "moved", "gone", "blocked", "flaky"];

/** A bookmark's latest status, or `null` while the page was never read. */
export function statusOf(record: SelectBookmark): BookmarkStatus | null {
	return STATUSES.find((status) => status === record.status) ?? null;
}

/** The flag a bookmark raised, or `null` when none is raised. */
export function flagOf(record: SelectBookmark): BookmarkFlag | null {
	return record.flag === "moved" || record.flag === "gone" ? record.flag : null;
}

/** Whether a reading raises a flag the bookmark does not already carry. */
export function raises(record: SelectBookmark | null, reading: BookmarkReading): boolean {
	let flagged = reading.status === "moved" || reading.status === "gone";
	return flagged && record?.flag !== reading.status;
}

/** Whether a bookmark's flag awaits review: raised after the last CMS save, if any. */
export function isOpen(record: SelectBookmark): boolean {
	if (record.flag === null || record.flagged_at === null) return false;
	return record.reviewed_at === null || record.reviewed_at < record.flagged_at;
}

export const Bookmarks = createModel(bookmarks, {
	methods: {
		findByAddress(address: string) {
			return this.findBy({ address });
		},

		/**
		 * Claims `address` for a post in one statement, which keeps the first claim when two
		 * requests race for the same page.
		 *
		 * @returns Whether this post holds the address now.
		 */
		async claim(postId: string, address: string, reading: BookmarkReading | null) {
			let now = new Date().toISOString();
			let checkedAt = reading ? now : null;
			let describedAt = reading?.status === "ok" ? now : null;
			await this.db.exec(sql`
				insert into "bookmarks" ("post_id", "address", "status", "http_status", "final_url", "checked_at", "described_at")
				values (${postId}, ${address}, ${reading?.status ?? null}, ${reading?.httpStatus ?? null}, ${reading?.finalUrl ?? null}, ${checkedAt}, ${describedAt})
				on conflict do nothing
			`);

			let claimed = await this.find(postId);
			return claimed?.address === address;
		},

		/** Points a post's bookmark at a new address, forgetting everything read of the old one. */
		async readdress(postId: string, address: string): Promise<void> {
			await this.db.exec(sql`
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
		},

		/** Marks a CMS save of the bookmark, which closes every flag raised before it. */
		async review(postId: string): Promise<void> {
			await this.query()
				.where({ post_id: postId })
				.update({ reviewed_at: new Date().toISOString() });
		},

		/**
		 * Records one reading in a single statement: an `ok` read clears the flag, a moved or
		 * gone read raises it, and any other keeps it, restamping `flagged_at` only for a change.
		 */
		async record(postId: string, reading: BookmarkReading): Promise<void> {
			let now = new Date().toISOString();
			let raised = reading.status === "moved" || reading.status === "gone" ? reading.status : null;
			await this.db.exec(sql`
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
		},

		/** Notes that the bookmark's missing title or description was looked up just now. */
		async described(postId: string): Promise<void> {
			await this.query()
				.where({ post_id: postId })
				.update({ described_at: new Date().toISOString() });
		},

		/** The open flags no digest has reported yet, oldest flag first. */
		async findUnreported(): Promise<SelectBookmark[]> {
			let rows = await this.query().where(notNull("flag")).all();
			return rows
				.filter((row) => isOpen(row))
				.filter((row) => row.notified_at === null || row.notified_at < (row.flagged_at ?? ""))
				.sort((a, b) => (a.flagged_at ?? "").localeCompare(b.flagged_at ?? ""));
		},

		/** The bookmarks whose flag awaits review, keyed by post. */
		async findOpen(): Promise<Map<string, SelectBookmark>> {
			let rows = await this.query().where(notNull("flag")).all();
			return new Map(rows.filter((row) => isOpen(row)).map((row) => [row.post_id, row]));
		},

		/** Stamps the digest that reported these bookmarks' flags. */
		async reported(postIds: string[], at: string): Promise<void> {
			for (let postId of postIds) {
				await this.query().where({ post_id: postId }).update({ notified_at: at });
			}
		},

		/** Every bookmark, keyed by post. */
		async findAll(): Promise<Map<string, SelectBookmark>> {
			let rows = await this.query().all();
			return new Map(rows.map((row) => [row.post_id, row]));
		},

		/** Notes a Wayback Machine capture job the archive job is polling. */
		async archiving(postId: string, jobId: string): Promise<void> {
			await this.query()
				.where({ post_id: postId })
				.update({ archive_job: jobId, archive_attempted_at: new Date().toISOString() });
		},

		/** Notes that the archive attempt ended, captured or not. */
		async archived(postId: string): Promise<void> {
			await this.query()
				.where({ post_id: postId })
				.update({ archive_job: null, archive_attempted_at: new Date().toISOString() });
		},

		/** Forgets a post's bookmark. */
		async remove(postId: string): Promise<void> {
			await this.query().where({ post_id: postId }).delete();
		},
	},
});

export default Bookmarks;
