/**
 * Like (bookmark) entity for the blog. Extends the base PostSchema into a Zod
 * schema for "like" posts, adding a title and a validated url, and exports the
 * inferred Like type. It exists to define and validate the shape of bookmarked
 * links surfaced in the blog's bookmarks feature.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { z } from "zod";

import { PostSchema } from "./post";

export const LikeSchema = PostSchema.extend({
	type: z.literal("like"),
	title: z.string(),
	url: z.string().url(),
});

export type Like = z.output<typeof LikeSchema>;
