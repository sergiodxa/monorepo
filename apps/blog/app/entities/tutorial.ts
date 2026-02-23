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
