/**
 * Notes: short Markdown posts with no title, read at `/notes/<slug>` and shared on X whole.
 * A note's slug is the instant it publishes, in base-36 seconds, so its permalink is short
 * and fixed from the moment it is written.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ModelRow } from "@sdxc/data-model";

import { field } from "@sdxc/data-model";
import { notNull } from "remix/data-table";

import { isPublishedAt, parseTimestamp } from "./post-values";
import { Posts } from "./posts";

/**
 * The slug a note publishing at `instant` takes: its epoch seconds in base 36, six characters
 * until late 2038 and seven after. Ordering reads the publish date, never this slug.
 *
 * @param instant When the note publishes, as epoch milliseconds.
 */
export function noteSlugAt(instant: number): string {
	return Math.floor(instant / 1000).toString(36);
}

export const Notes = Posts.extend("note", {
	meta: {
		slug: field.text().required().default(""),
		/** The Markdown shared on X with the permalink after it, so it fits X's limit. */
		content: field.text().required().default(""),
	},

	methods: {
		/** Live notes newest first by creation, previews left out unless asked for. */
		async findAll(options?: { includePreview?: boolean }) {
			let rows = await this.newest().all();
			return options?.includePreview ? rows : rows.filter((row) => isPublishedAt(row.published_at));
		},

		/** The deleted note that had `slug`, which its permalink answers 410 Gone for. */
		findTombstone(slug: string) {
			return this.unscoped().where(notNull("deleted_at")).whereMeta("slug", slug).first();
		},

		findBySlug(slug: string) {
			return this.whereMeta("slug", slug).first();
		},

		/**
		 * The slug for a note publishing at `publishedAt`, or now for one published on save. A
		 * second note in the same second, deleted ones included since their URL answers 410,
		 * appends a digit, so every note keeps a permalink of its own.
		 *
		 * @param publishedAt The note's stored publish date, `null` when it publishes now.
		 */
		async nextSlug(publishedAt: string | null): Promise<string> {
			let instant = publishedAt === null ? Date.now() : parseTimestamp(publishedAt);
			let base = noteSlugAt(Number.isNaN(instant) ? Date.now() : instant);
			let slug = base;
			let suffix = 0;
			while ((await this.unscoped().whereMeta("slug", slug).first()) !== null) {
				suffix += 1;
				slug = `${base}${String(suffix)}`;
			}
			return slug;
		},
	},
});

/** A note, as reads return it. */
export type Note = ModelRow<typeof Notes>;

export default Notes;
