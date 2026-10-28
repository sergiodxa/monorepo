/**
 * Serves published tutorials as resources a person can attach, each read as the Markdown it
 * was written in, cached like the articles.
 *
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createResource } from "@sdxc/mcp/server";

import { cached } from "~/app/mcp/cache";
import { findPublished } from "~/app/mcp/posts";
import resourceset from "~/app/mcp/resources";

/** Lists and reads published tutorials, cached like the articles: a picker lists on every refresh. */
export default createResource(resourceset.tutorial, {
	list: (ctx) =>
		cached("resources/tutorials", null, async () => {
			let tutorials = await ctx.models.tutorials.listItems({ includePreview: false });

			return tutorials.map((tutorial) => ({
				uri: resourceset.tutorial.href({ slug: tutorial.slug }),
				name: tutorial.slug,
				title: tutorial.title,
			}));
		}),

	read: (ctx) =>
		cached("resources/tutorial", ctx.variables, async () => {
			let found = await findPublished(ctx.models, "tutorials", ctx.variables.slug);
			return found?.post.meta.content ?? null;
		}),
});
