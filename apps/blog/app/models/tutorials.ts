/**
 * Tutorials: step-by-step posts with a Markdown body and tags, listed on `/tutorials` and read
 * at `/tutorials/:slug`, each suggesting the tutorials that share one of its tags.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ModelRow } from "@sdxc/data-model";

import { field } from "@sdxc/data-model";
import { notNull } from "remix/data-table";

import { compareByPublishedOrCreatedDesc, isPublishedAt, tutorialTags } from "./post-values";
import { Posts } from "./posts";

/** What a list of tutorials shows for each one. */
export interface TutorialListItem {
	id: string;
	title: string;
	slug: string;
	created_at: string;
	published_at: string | null;
}

/** A tutorial suggested beside another, with the tag they share. */
export interface RelatedTutorial {
	slug: string;
	title: string;
	matchedTag: string;
}

/** Whether a listing includes previews, which only the CMS shows. */
export interface TutorialListOptions {
	includePreview?: boolean;
}

export const Tutorials = Posts.extend("tutorial", {
	meta: {
		slug: field.text().required().default(""),
		title: field.text().required().default(""),
		excerpt: field.text().required().default(""),
		content: field.text().required().default(""),
		/** The tags as a JSON array; `tutorialTags()` reads it and `serializeTags()` writes it. */
		tags: field.text(),
	},

	methods: {
		/** Live tutorials newest first by creation, previews left out unless asked for. */
		async findAll(options?: TutorialListOptions) {
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
		 * Up to `limit` published tutorials sharing a tag with `tags`, in listing order, the
		 * current one left out.
		 */
		async findRelatedByTags(currentId: string, tags: string[], limit = 3) {
			if (tags.length === 0) return [];

			let related: RelatedTutorial[] = [];
			for (let tutorial of await this.findAll()) {
				if (tutorial.id === currentId) continue;
				let match = tutorialTags(tutorial.meta.tags).find((tag) => tags.includes(tag));
				if (match === undefined) continue;
				related.push({ slug: tutorial.meta.slug, title: tutorial.meta.title, matchedTag: match });
				if (related.length >= limit) break;
			}
			return related;
		},

		/**
		 * The title and slug of every live tutorial, newest first by publish date, falling back
		 * to the id for a tutorial missing either, so a list never shows a blank entry.
		 */
		async listItems(options?: TutorialListOptions): Promise<TutorialListItem[]> {
			let rows = await this.query().withMeta(["title", "slug"]).all();
			let items = rows
				.map((row) => ({
					id: row.id,
					title: row.meta.title.trim() || `Tutorial ${row.id}`,
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

/** A tutorial, as reads return it. */
export type Tutorial = ModelRow<typeof Tutorials>;

export default Tutorials;
