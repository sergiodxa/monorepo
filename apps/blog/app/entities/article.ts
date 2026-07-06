/**
 * Article entity for the blog. Extends the base PostSchema into a Zod schema for
 * article posts with title, slug, locale, optional excerpt, content, tags and
 * canonical URL, and transforms each parsed article to add a derived isPublished
 * flag. It exists to define, validate and normalize the shape of articles.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { z } from "zod";

import { PostSchema } from "./post";

export const ArticleSchema = PostSchema.extend({
	type: z.literal("article"),
	title: z.string(),
	slug: z.string(),
	locale: z.string(),
	excerpt: z.string().optional(),
	content: z.string(),
	tags: z.union([z.string(), z.array(z.string())]).optional(),
	canonicalUrl: z.string().optional(),
}).transform((article) => ({
	...article,
	isPublished: article.publishedAt === null || article.publishedAt <= new Date(),
}));

export type Article = z.output<typeof ArticleSchema>;
