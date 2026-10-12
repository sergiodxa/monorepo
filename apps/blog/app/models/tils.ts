/**
 * TILs: short things learned, each a title, Markdown content and tags, read at
 * `/til/<title slug>` and shared on X as "TIL" and the content. The title names the page and
 * the slug; the content alone is what X receives.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ModelRow } from "@sdxc/data-model";

import { field } from "@sdxc/data-model";
import { notNull } from "remix/data-table";

import { isPublishedAt } from "./post-values";
import { Posts } from "./posts";

export const Tils = Posts.extend("til", {
	meta: {
		slug: field.text().required().default(""),
		title: field.text().required().default(""),
		/** The Markdown shared on X after "TIL" with the permalink after it, so it fits X's limit. */
		content: field.text().required().default(""),
		/** The tags as a JSON array; `tutorialTags()` reads it and `serializeTags()` writes it. */
		tags: field.text(),
	},

	methods: {
		/** Live TILs newest first by creation, previews left out unless asked for. */
		async findAll(options?: { includePreview?: boolean }) {
			let rows = await this.newest().all();
			return options?.includePreview ? rows : rows.filter((row) => isPublishedAt(row.published_at));
		},

		/** The deleted TIL that had `slug`, which its permalink answers 410 Gone for. */
		findTombstone(slug: string) {
			return this.unscoped().where(notNull("deleted_at")).whereMeta("slug", slug).first();
		},

		findBySlug(slug: string) {
			return this.whereMeta("slug", slug).first();
		},
	},
});

/** A TIL, as reads return it. */
export type Til = ModelRow<typeof Tils>;

export default Tils;
