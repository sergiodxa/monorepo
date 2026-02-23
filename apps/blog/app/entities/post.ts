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
