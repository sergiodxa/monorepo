/**
 * Service that loads a single tutorial by its slug. It queries the post_meta table
 * for the matching slug, joins in the post, its meta and author, assembles the
 * key/value meta rows into a Tutorial shape and validates it with TutorialSchema,
 * returning a Result with a TutorialNotFoundError when nothing matches. It exists
 * to give tutorial routes one typed lookup from slug to a domain entity.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { type Result, failure, success } from "@pkg/result";

import type { Tutorial } from "~/entities/tutorial";

import { TutorialSchema } from "~/entities/tutorial";
import { getDB } from "~/middleware/drizzle";
import { measure } from "~/middleware/server-timing";

export class TutorialNotFoundError extends Error {
	override name = "TutorialNotFoundError";
	constructor(public slug: string) {
		super(`Couldn't find tutorial with slug ${slug}`);
	}
}

export default async function findTutorialBySlug(
	slug: Tutorial["slug"],
): Promise<Result<Tutorial, TutorialNotFoundError>> {
	let db = getDB();

	let result = await measure("findTutorialBySlug", () => {
		return db.query.postMeta.findFirst({
			with: { post: { with: { meta: true, author: true } } },
			where(fields, { and, eq }) {
				return and(eq(fields.key, "slug"), eq(fields.value, slug));
			},
		});
	});

	if (!result) return failure(new TutorialNotFoundError(slug));

	return success(
		TutorialSchema.parse({
			id: result.postId,
			authorId: result.post.authorId,
			type: result.post.type,
			createdAt: result.post.createdAt,
			updatedAt: result.post.updatedAt,
			publishedAt: result.post.publishedAt,
			author: {
				id: result.post.author.id,
				role: result.post.author.role,
				email: result.post.author.email,
				username: result.post.author.username,
				displayName: result.post.author.displayName,
				avatar: result.post.author.avatar,
				createdAt: result.post.author.createdAt,
				updatedAt: result.post.author.updatedAt,
			},
			title: result.post.meta.find((m) => m.key === "title")?.value,
			slug: result.post.meta.find((m) => m.key === "slug")?.value,
			excerpt: result.post.meta.find((m) => m.key === "excerpt")?.value,
			content: result.post.meta.find((m) => m.key === "content")?.value,
			tags: result.post.meta.filter((m) => m.key === "tags").map((m) => m.value),
		}),
	);
}
