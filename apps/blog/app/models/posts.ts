/**
 * Every post type in one table, discriminated by `type`, with open-ended attributes in
 * `post_meta`. A deleted post stays as a tombstone every read skips, and each write keeps the
 * post's search document in step with what its pages show.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ModelRow } from "@sdxc/data-model";

import { createModel } from "@sdxc/data-model";
import { unwrap } from "@sdxc/result";
import { generateUUID } from "@sdxc/uuid/v7";
import { inList, isNull, notNull, sql } from "remix/data-table";

import { PostSearch } from "~/app/repositories/search";
import { postMeta, posts } from "~/database/schema";

import {
	isPublishedAt,
	parseTimestamp,
	PUBLIC_TYPES,
	timestampFromPublishedOrCreated,
} from "./post-values";

/** A published article or tutorial in the order the ActivityPub outbox lists it. */
export interface Federatable {
	id: string;
	/** Epoch milliseconds of its publish date, else its creation date. */
	timestamp: number;
}

export const Posts = createModel(posts, {
	inheritance: "type",
	optional: ["id"],
	metaTable: {
		table: postMeta,
		foreignKey: "post_id",
		latest: ["updated_at", "created_at"],
		generateId: generateUUID,
	},

	/** A deleted post is a tombstone: its row and metadata stay, and every read skips it. */
	defaultScope: (query) => query.where({ deleted_at: null }),

	scopes: {
		/** The types with public permalinks, which send Webmentions and federate. */
		permalinked: (query) => query.where(inList("type", Object.values(PUBLIC_TYPES))),
		newest: (query) => query.orderBy("created_at", "desc"),
	},

	methods: {
		/**
		 * The posts whose scheduled publish date arrived since they last sent their Webmentions.
		 * A post published on save sends from the CMS and never lands here.
		 */
		async findDueForMentions(): Promise<string[]> {
			let rows = await this.permalinked().where(notNull("published_at")).all();
			return rows
				.filter((row) => {
					if (row.published_at === null || !isPublishedAt(row.published_at)) return false;
					if (row.mentions_sent_at === null) return true;
					return parseTimestamp(row.mentions_sent_at) < parseTimestamp(row.published_at);
				})
				.map((row) => row.id);
		},

		/**
		 * The posts whose scheduled publish date arrived and whose `Create` followers never
		 * received; one published on save federates from the CMS instead.
		 */
		async findDueForFederation(): Promise<string[]> {
			let rows = await this.permalinked()
				.where(isNull("federated_at"))
				.where(notNull("published_at"))
				.all();
			return rows.filter((row) => isPublishedAt(row.published_at)).map((row) => row.id);
		},

		/**
		 * The published articles and tutorials, newest first with the id breaking a tie, which is
		 * the order the outbox pages through and the count NodeInfo reports.
		 */
		async findFederatable(): Promise<Federatable[]> {
			let rows = await this.permalinked().all();
			return rows
				.filter((row) => isPublishedAt(row.published_at))
				.map((row) => ({ id: row.id, timestamp: timestampFromPublishedOrCreated(row) }))
				.filter((row) => Number.isFinite(row.timestamp))
				.sort((a, b) => b.timestamp - a.timestamp || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
		},

		/**
		 * Stamps a post as sent to its followers, leaving `updated_at` alone because nothing a
		 * reader sees changed. One statement, so it is safe on D1.
		 */
		async markFederated(id: string): Promise<void> {
			let now = new Date().toISOString();
			await this.db.exec(sql`update "posts" set "federated_at" = ${now} where "id" = ${id}`);
		},

		/** Stamps a post as having sent its Webmentions now, off the cron's list until it moves. */
		async markMentionsSent(id: string): Promise<void> {
			await this.query().where({ id }).update({ mentions_sent_at: new Date().toISOString() });
		},

		/**
		 * Deletes a post by leaving a tombstone: its URL then answers 410 Gone, so Webmention
		 * receivers learn it was withdrawn, and its search document goes with it.
		 *
		 * @returns Whether a live post was tombstoned.
		 */
		async tombstone(id: string): Promise<boolean> {
			let existing = await this.find(id);
			if (existing === null) return false;
			unwrap(await this.update(id, { deleted_at: new Date().toISOString() }));
			return true;
		},
	},

	callbacks: {
		async beforeCreate(values) {
			return { ...values, id: values.id ?? generateUUID() };
		},

		/** Writes the post's search document, read through its own type's model. */
		async afterCreate(row, ctx) {
			await PostSearch.index(ctx, row.id, row.type);
		},

		/** Rewrites the search document, which a tombstone removes. */
		async afterUpdate(row, ctx) {
			await PostSearch.index(ctx, row.id, row.type);
		},
	},
});

/** A post of any type, as reads return it. */
export type Post = ModelRow<typeof Posts>;

export default Posts;
