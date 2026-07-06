/**
 * Tutorial entity for the blog. Extends the base PostSchema into a Zod schema for
 * tutorial posts with title, slug, optional excerpt, content and tags, and
 * transforms each parsed tutorial to add a derived isPublished flag. It exists to
 * define, validate and normalize the shape of tutorials across the app.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { z } from "zod";

import { PostSchema } from "./post";

export const TutorialSchema = PostSchema.extend({
	type: z.literal("tutorial"),
	title: z.string(),
	slug: z.string(),
	excerpt: z.string().optional(),
	content: z.string(),
	tags: z.union([z.string(), z.array(z.string())]).optional(),
}).transform((tutorial) => ({
	...tutorial,
	isPublished: tutorial.publishedAt === null || tutorial.publishedAt <= new Date(),
}));

export type Tutorial = z.output<typeof TutorialSchema>;
