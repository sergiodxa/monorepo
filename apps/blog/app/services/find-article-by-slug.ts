/**
 * Service that loads a single article by its slug. It queries the post_meta table
 * for the matching slug, joins in the post, its meta and author, assembles those
 * key/value meta rows into an Article shape and validates it with ArticleSchema,
 * returning a Result with an ArticleNotFoundError when nothing matches. It exists
 * to give article routes one typed lookup from slug to a domain entity.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { type Result, failure, success } from "@pkg/result";

import type { Article } from "~/entities/article";

import { ArticleSchema } from "~/entities/article";
import { getDB } from "~/middleware/drizzle";
import { measure } from "~/middleware/server-timing";

export class ArticleNotFoundError extends Error {
	override name = "ArticleNotFoundError";
	constructor(public slug: string) {
		super(`Couldn't find article with slug ${slug}`);
	}
}

export default async function findArticleBySlug(
	slug: Article["slug"],
): Promise<Result<Article, ArticleNotFoundError>> {
	let db = getDB();

	let result = await measure("findArticleBySlug", () => {
		return db.query.postMeta.findFirst({
			with: { post: { with: { meta: true, author: true } } },
			where(fields, { and, eq }) {
				return and(eq(fields.key, "slug"), eq(fields.value, slug));
			},
		});
	});

	if (!result) return failure(new ArticleNotFoundError(slug));

	return success(
		ArticleSchema.parse({
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
			// Meta
			title: result.post.meta.find((m) => m.key === "title")?.value,
			slug: result.post.meta.find((m) => m.key === "slug")?.value,
			locale: result.post.meta.find((m) => m.key === "locale")?.value,
			excerpt: result.post.meta.find((m) => m.key === "excerpt")?.value,
			content: result.post.meta.find((m) => m.key === "content")?.value,
			tags: result.post.meta.filter((m) => m.key === "tags").map((m) => m.value),
			canonicalUrl: result.post.meta.find((m) => m.key === "canonical_url")?.value,
		}),
	);
}
