/**
 * Weekly releases posts: one per ISO week, listing the packages the author released, read at
 * `/releases/<ISO year>-w<ISO week>`. The weekly job writes each one from the week's GitHub
 * releases; the author edits its title and content afterwards in the CMS.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ModelRow } from "@sdxc/data-model";
import type { Result } from "@sdxc/result";

import { field } from "@sdxc/data-model";
import { failure, isFailure, success } from "@sdxc/result";
import * as s from "remix/data-schema";
import { notNull } from "remix/data-table";

import type { ReleasedPackage, WeeklyReleaseSummary } from "~/app/services/releases/packages";

import { isPublishedAt } from "./post-values";
import { Posts } from "./posts";

/** The title every weekly releases post starts with. */
export const RELEASE_TITLE = "What I released this week";

/** A package as the post stores it, which the share text lists by name. */
const RELEASED_PACKAGE = s.object({ name: s.string(), url: s.string() });

/**
 * The post's Markdown body: one list item per package, each linking where a reader installs
 * or reads about it, in the summary's order.
 *
 * @param packages The packages the week released.
 */
export function releaseContent(packages: ReadonlyArray<ReleasedPackage>): string {
	return packages.map((pkg) => `- [${pkg.name}](${pkg.url})`).join("\n");
}

export const Releases = Posts.extend("release", {
	meta: {
		slug: field.text().required().default(""),
		title: field.text().required().default(""),
		content: field.text().required().default(""),
		/** The packages the job found, kept as written so the share text lists them after an edit. */
		packages: field.json(s.array(RELEASED_PACKAGE)).default([]),
	},

	methods: {
		/** Live releases posts newest first by creation, previews left out unless asked for. */
		async findAll(options?: { includePreview?: boolean }) {
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
		 * Writes the week's post, published now, unless a post with its slug already exists,
		 * live or deleted: a retried run never duplicates it, and a post the author edited or
		 * deleted stays as they left it.
		 *
		 * @param summary The week's slug and packages.
		 * @param authorId The user the post is attributed to.
		 * @returns The created post's id, or `null` when the week already has one.
		 */
		async publishWeek(
			summary: WeeklyReleaseSummary,
			authorId: string,
		): Promise<Result<string | null, Error>> {
			let existing = await this.unscoped().whereMeta("slug", summary.slug).first();
			if (existing !== null) return success(null);

			let created = await this.create({
				author_id: authorId,
				published_at: null,
				meta: {
					slug: summary.slug,
					title: RELEASE_TITLE,
					content: releaseContent(summary.packages),
					packages: summary.packages,
				},
			});
			if (isFailure(created)) return failure(created.error);
			return success(created.data?.id ?? null);
		},
	},
});

/** A weekly releases post, as reads return it. */
export type Release = ModelRow<typeof Releases>;

export default Releases;
