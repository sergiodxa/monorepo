/**
 * Glossary entity for the blog. Extends the base PostSchema into a Zod schema for
 * glossary posts, adding a "glossary" type literal plus slug, term, optional title
 * and definition fields, and exports the inferred Glossary type. It exists to
 * define and validate the shape of glossary terms across the app.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { z } from "zod";

import { PostSchema } from "./post";

export const GlossarySchema = PostSchema.extend({
	type: z.literal("glossary"),
	slug: z.string(),
	term: z.string(),
	title: z.string().optional(),
	definition: z.string(),
});

export type Glossary = z.output<typeof GlossarySchema>;
