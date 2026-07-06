/**
 * Base post entity for the blog. Defines the Zod PostSchema shared by all post
 * types (id, type, author, timestamps and nullable publishedAt), a variant that
 * derives an isPublished flag, and the related exported types. It exists as the
 * common foundation the article, tutorial, like and glossary entities extend.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { z } from "zod";

import { UserSchema } from "./user";

export const PostSchema = z.object({
	id: z.string().uuid(),
	type: z.enum(["like", "tutorial", "article", "comment", "glossary"]),
	author: UserSchema,
	createdAt: z.date(),
	updatedAt: z.date(),
	publishedAt: z.date().nullable(),
});

export type PostSchemaType = typeof PostSchema;

export const PostSchemaWithIsPublished = PostSchema.transform((post) => ({
	...post,
	isPublished: post.publishedAt !== null && post.publishedAt <= new Date(),
}));

export type Post = z.output<typeof PostSchema>;
