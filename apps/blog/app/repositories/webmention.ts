/**
 * Webmention repository: stores what verifying a mention found, keyed by its
 * source/target pair so a resend updates the same row, and holds the per-host policy
 * that approves or drops a source before moderation. Every write is one statement.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Webmention as Protocol } from "@sdxc/webmention";
import type { Database } from "remix/data-table";

import * as schema from "~/database/schema";

/** Types for stored mentions and moderation policies. */
export namespace Webmention {
	/** Where a mention stands: only `approved` renders under its post. */
	export type Status = schema.SelectWebmention["status"];

	/** A moderation policy for a source host. */
	export type Policy = schema.SelectWebmentionDomain["policy"];

	/** A stored mention row. */
	export type Row = schema.SelectWebmention;
}

/** Reads and writes received Webmentions and their moderation policies. */
export class Webmention {
	/** Table the mentions are stored in. */
	static table = schema.webmentions;

	/** Table the per-host policies are stored in. */
	static domains = schema.webmentionDomains;

	/**
	 * Stores a verified mention. A new pair starts as `status`; an existing pair keeps a
	 * moderator's `approved` or `rejected` decision and only refreshes what the source says,
	 * while a pair that was `deleted` comes back as `status`.
	 *
	 * @param db Database handle used for writes.
	 * @param input The post it mentions, the pair, what verification read, and the arrival status.
	 * @returns The stored row.
	 */
	static async upsert(
		db: Database,
		input: {
			postId: string;
			pair: Protocol.Pair;
			mention: Protocol.Mention;
			status: "pending" | "approved";
		},
	): Promise<Webmention.Row> {
		let now = new Date().toISOString();
		let fields = {
			post_id: input.postId,
			kind: input.mention.kind,
			url: input.mention.url,
			author_name: input.mention.author?.name ?? null,
			author_url: input.mention.author?.url ?? null,
			author_photo: input.mention.author?.photo ?? null,
			name: input.mention.name,
			content_html: input.mention.content?.html ?? null,
			content_text: input.mention.content?.text ?? null,
			published_at: input.mention.published?.toISOString() ?? null,
			updated_at: now,
		};

		let existing = await this.findByPair(db, input.pair);
		if (existing) {
			let status = existing.status === "deleted" ? input.status : existing.status;
			return db.update(this.table, existing.id, { ...fields, status });
		}

		return db.create(
			this.table,
			{
				id: crypto.randomUUID(),
				source: input.pair.source.href,
				target: input.pair.target.href,
				status: input.status,
				created_at: now,
				...fields,
			},
			{ returnRow: true },
		);
	}

	/**
	 * Marks a pair's mention deleted, which is what a source answering 410 or no longer
	 * linking means. A pair never stored is left alone.
	 *
	 * @param db Database handle used for writes.
	 * @param pair The mention's source and target.
	 * @returns The post the mention was on, when there was one.
	 */
	static async markDeleted(db: Database, pair: Protocol.Pair): Promise<string | null> {
		let existing = await this.findByPair(db, pair);
		if (!existing) return null;

		await db.update(this.table, existing.id, {
			status: "deleted",
			updated_at: new Date().toISOString(),
		});
		return existing.post_id;
	}

	/**
	 * @param db Database handle used for lookups.
	 * @param pair The mention's source and target.
	 * @returns The stored mention for the pair, or `null`.
	 */
	static findByPair(db: Database, pair: Protocol.Pair) {
		return db.findOne(this.table, {
			where: { source: pair.source.href, target: pair.target.href },
		});
	}

	/**
	 * @param db Database handle used for lookups.
	 * @param id Mention identifier.
	 * @returns The mention, or `null`.
	 */
	static findById(db: Database, id: string) {
		return db.find(this.table, id);
	}

	/**
	 * The mentions a post renders, oldest first so a conversation reads in order.
	 *
	 * @param db Database handle used for lookups.
	 * @param postId The post the mentions target.
	 */
	static findApprovedForPost(db: Database, postId: string) {
		return db.findMany(this.table, {
			where: { post_id: postId, status: "approved" },
			orderBy: ["created_at", "asc"],
		});
	}

	/**
	 * Mentions in one moderation state, newest first, for the CMS queue.
	 *
	 * @param db Database handle used for lookups.
	 * @param status The state to list.
	 */
	static findByStatus(db: Database, status: Webmention.Status) {
		return db.findMany(this.table, {
			where: { status },
			orderBy: ["updated_at", "desc"],
			limit: 200,
		});
	}

	/**
	 * Records a moderator's decision on one mention.
	 *
	 * @param db Database handle used for writes.
	 * @param id Mention identifier.
	 * @param status `approved` to show it, `rejected` to hide it.
	 */
	static async setStatus(db: Database, id: string, status: "approved" | "rejected") {
		return db.update(this.table, id, { status, updated_at: new Date().toISOString() });
	}

	/**
	 * Rejects every pending or approved mention from a host, which is what blocking it
	 * means for mentions that arrived before the block.
	 *
	 * @param db Database handle used for writes.
	 * @param host The source host being blocked.
	 * @returns The posts whose rendered mentions changed.
	 */
	static async rejectFromHost(db: Database, host: string): Promise<string[]> {
		let rows = await db.findMany(this.table, { where: { status: "approved" } });
		let pending = await db.findMany(this.table, { where: { status: "pending" } });
		let affected = new Set<string>();

		for (let row of [...rows, ...pending]) {
			if (hostOf(row.source) !== host) continue;
			await this.setStatus(db, row.id, "rejected");
			if (row.status === "approved") affected.add(row.post_id);
		}

		return [...affected];
	}

	/**
	 * @param db Database handle used for lookups.
	 * @param host A source's host name.
	 * @returns The host's policy, or `null` when mentions from it wait for moderation.
	 */
	static async policyFor(db: Database, host: string): Promise<Webmention.Policy | null> {
		let row = await db.find(this.domains, host);
		return row?.policy ?? null;
	}

	/**
	 * Sets a host's policy, replacing any earlier one.
	 *
	 * @param db Database handle used for writes.
	 * @param host A source's host name.
	 * @param policy `allow` to approve on arrival, `block` to drop at the endpoint.
	 */
	static async setPolicy(db: Database, host: string, policy: Webmention.Policy) {
		let now = new Date().toISOString();
		let existing = await db.find(this.domains, host);
		if (existing) return db.update(this.domains, host, { policy, updated_at: now });
		await db.create(this.domains, { host, policy, created_at: now, updated_at: now });
	}
}

/**
 * The host a stored URL names, or `""` for a value that no longer parses, so a
 * comparison against a real host never matches it.
 */
export function hostOf(url: string): string {
	try {
		return new URL(url).hostname;
	} catch {
		return "";
	}
}
