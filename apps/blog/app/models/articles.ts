/**
 * Articles: long-form posts with a Markdown body, listed on `/articles` and read at
 * `/articles/:slug`. A post whose publish date is still ahead is a preview, which only the
 * CMS lists.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ModelRow } from "@sdxc/data-model";

import { field } from "@sdxc/data-model";
import { notNull } from "remix/data-table";

import { compareByPublishedOrCreatedDesc, isPublishedAt } from "./post-values";
import { Posts } from "./posts";

/** What a list of articles shows for each one. */
export interface ArticleListItem {
	id: string;
	title: string;
	slug: string;
	created_at: string;
	published_at: string | null;
}

/** Whether a listing includes previews, which only the CMS shows. */
export interface ArticleListOptions {
	includePreview?: boolean;
}

export const Articles = Posts.extend("article", {
	meta: {
		slug: field.text().required().default(""),
		title: field.text().required().default(""),
		locale: field.text().default("en"),
		content: field.text().required().default(""),
		excerpt: field.text(),
		canonical_url: field.text(),
	},

	methods: {
		/** Live articles newest first by creation, previews left out unless asked for. */
		async findAll(options?: ArticleListOptions) {
			let rows = await this.newest().all();
			return options?.includePreview ? rows : rows.filter((row) => isPublishedAt(row.published_at));
		},

		/** The deleted post that had `slug`, which its permalink answers 410 Gone for. */
		findTombstone(slug: string) {
			return this.unscoped().where(notNull("deleted_at")).whereMeta("slug", slug).first();
		},

		findBySlug(slug: string) {
			return this.whereMeta("slug", slug).first();
		},

		/**
		 * The title and slug of every live article, newest first by publish date, falling back
		 * to the id for an article missing either, so a list never shows a blank entry.
		 */
		async listItems(options?: ArticleListOptions): Promise<ArticleListItem[]> {
			let rows = await this.query().withMeta(["title", "slug"]).all();
			let items = rows
				.map((row) => ({
					id: row.id,
					title: row.meta.title.trim() || `Article ${row.id}`,
					slug: row.meta.slug.trim() || row.id,
					created_at: row.created_at,
					published_at: row.published_at,
				}))
				.sort(compareByPublishedOrCreatedDesc);
			return options?.includePreview
				? items
				: items.filter((item) => isPublishedAt(item.published_at));
		},
	},
});

/** An article, as reads return it. */
export type Article = ModelRow<typeof Articles>;

export default Articles;
