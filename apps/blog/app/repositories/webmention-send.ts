/**
 * The record of what each post has notified: one row per post and target, holding
 * the endpoint's answer. Planning a send reads it to notify removed links as well, and
 * a removed link's row is dropped once that target has been told.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { and } from "remix/data-table";

import * as schema from "~/database/schema";

/** Types for the send record. */
export namespace WebmentionSend {
	/** What delivering to one target came to. */
	export interface Outcome {
		status: "sent" | "no-endpoint" | "failed";
		endpoint: string | null;
		code: number | null;
		location: string | null;
	}
}

/** Reads and writes the targets each post has notified. */
export class WebmentionSend {
	/** Table the send record lives in. */
	static table = schema.webmentionSends;

	/**
	 * Every target the post notified before, however that delivery ended, which is what
	 * `plan()` needs to notify a link the post no longer carries.
	 *
	 * @param db Database handle used for lookups.
	 * @param postId The sending post.
	 * @returns Each target as a URL; a stored value that no longer parses is skipped.
	 */
	static async targetsFor(db: Database, postId: string): Promise<URL[]> {
		let rows = await db.findMany(this.table, { where: { post_id: postId } });
		return rows.flatMap((row) => (URL.canParse(row.target) ? [new URL(row.target)] : []));
	}

	/**
	 * Records the latest delivery to a target, replacing an earlier one for the same pair.
	 *
	 * @param db Database handle used for writes.
	 * @param postId The sending post.
	 * @param target The notified page.
	 * @param outcome What the delivery came to.
	 */
	static async record(
		db: Database,
		postId: string,
		target: string,
		outcome: WebmentionSend.Outcome,
	) {
		let now = new Date().toISOString();
		let existing = await db.findOne(this.table, { where: { post_id: postId, target } });
		if (existing) {
			await db.update(this.table, existing.id, { ...outcome, updated_at: now });
			return;
		}
		await db.create(this.table, {
			id: crypto.randomUUID(),
			post_id: postId,
			target,
			...outcome,
			created_at: now,
			updated_at: now,
		});
	}

	/**
	 * Drops a target from the record once it has been told the link is gone, so later
	 * updates of the post leave it alone.
	 *
	 * @param db Database handle used for writes.
	 * @param postId The sending post.
	 * @param target The page the post stopped linking to.
	 */
	static async forget(db: Database, postId: string, target: string) {
		await db.deleteMany(this.table, { where: and({ post_id: postId }, { target }) });
	}
}
