/**
 * The Webmentions and ActivityPub responses a post received, one row per source and target
 * pair, with the moderation status the CMS sets. Receiving a mention again refreshes what it
 * says while keeping the status an editor already gave it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ModelRow } from "@sdxc/data-model";
import type { Webmention as Protocol } from "@sdxc/webmention";

import { createModel } from "@sdxc/data-model";
import { unwrap } from "@sdxc/result";
import { generateUUID } from "@sdxc/uuid/v7";

import type { SelectWebmention } from "~/database/schema";

import { webmentions } from "~/database/schema";

/** What a mention can be moderated to. */
export type WebmentionStatus = SelectWebmention["status"];

/** One received mention, as the store keeps it. */
export interface ReceivedMention {
	postId: string;
	pair: Protocol.Pair;
	mention: Protocol.Mention;
	/** `approved` for a source the moderation policy allows, `pending` otherwise. */
	status: "pending" | "approved";
}

/**
 * The host a mention's source URL names, which moderation policies are keyed by; an
 * unparsable URL answers an empty host, which no policy names.
 */
export function hostOf(url: string): string {
	try {
		return new URL(url).hostname;
	} catch {
		return "";
	}
}

export const Webmentions = createModel(webmentions, {
	optional: ["id"],

	methods: {
		findByPair(pair: Protocol.Pair) {
			return this.findBy({ source: pair.source.href, target: pair.target.href });
		},

		/** The approved mentions of a post, oldest first, which is the order the post lists them. */
		findApprovedForPost(postId: string) {
			return this.query()
				.where({ post_id: postId, status: "approved" })
				.orderBy("created_at", "asc")
				.all();
		},

		/** The latest 200 mentions in one status, most recently changed first, for the CMS queue. */
		findByStatus(status: WebmentionStatus) {
			return this.query().where({ status }).orderBy("updated_at", "desc").limit(200).all();
		},

		/**
		 * Stores a mention, or refreshes the one already stored for its pair. A refresh keeps the
		 * status an editor gave it, except that a mention withdrawn earlier takes `status` again.
		 *
		 * @throws {Error} When the row cannot be written, which a verify job retries.
		 */
		async record(input: ReceivedMention): Promise<SelectWebmention> {
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
			};

			let existing = await this.findBy({
				source: input.pair.source.href,
				target: input.pair.target.href,
			});

			if (existing !== null) {
				let status = existing.status === "deleted" ? input.status : existing.status;
				return unwrap(await this.update(existing.id, { ...fields, status }));
			}

			return unwrap(
				await this.create({
					...fields,
					source: input.pair.source.href,
					target: input.pair.target.href,
					status: input.status,
				}),
			);
		},

		/**
		 * Marks the mention of a pair as withdrawn, which hides it from the post.
		 *
		 * @returns The post it was on, or `null` when the pair was never stored.
		 */
		async markDeleted(pair: Protocol.Pair): Promise<string | null> {
			let existing = await this.findBy({ source: pair.source.href, target: pair.target.href });
			if (existing === null) return null;
			unwrap(await this.update(existing.id, { status: "deleted" }));
			return existing.post_id;
		},

		/** Withdraws every mention a source made, in one statement, when the source is deleted. */
		async markSourceDeleted(source: URL): Promise<void> {
			await this.query().where({ source: source.href }).update({ status: "deleted" });
		},

		/** Sets an editor's decision on one mention. */
		async setStatus(id: string, status: "approved" | "rejected"): Promise<void> {
			unwrap(await this.update(id, { status }));
		},

		/**
		 * Rejects every pending and approved mention from a host an editor just blocked.
		 *
		 * @returns The posts that lose an approved mention, whose pages need refreshing.
		 */
		async rejectFromHost(host: string): Promise<string[]> {
			let rows = await this.query().where({ status: "approved" }).all();
			let pending = await this.query().where({ status: "pending" }).all();
			let affected = new Set<string>();

			for (let row of [...rows, ...pending]) {
				if (hostOf(row.source) !== host) continue;
				unwrap(await this.update(row.id, { status: "rejected" }));
				if (row.status === "approved") affected.add(row.post_id);
			}

			return [...affected];
		},
	},

	callbacks: {
		async beforeCreate(values) {
			return { ...values, id: values.id ?? generateUUID() };
		},
	},
});

/** A stored mention, as reads return it. */
export type Webmention = ModelRow<typeof Webmentions>;

export default Webmentions;
