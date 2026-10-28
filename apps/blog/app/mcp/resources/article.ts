/**
 * Serves published articles as resources a person can attach, each read as the Markdown it
 * was written in. Both halves are cached, since a picker lists on every refresh.
 *
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createResource } from "@sdxc/mcp/server";

import { cached } from "~/app/mcp/cache";
import { findPublished } from "~/app/mcp/posts";
import resourceset from "~/app/mcp/resources";

/**
 * Serves published articles as pickable resources.
 *
 * Both halves are cached explicitly, because resources have no middleware layer to do it
 * for them: a picker calls `list` on every refresh, and it reads every published article.
 */
export default createResource(resourceset.article, {
	list: (ctx) =>
		cached("resources/articles", null, async () => {
			let articles = await ctx.models.articles.listItems({ includePreview: false });

			return articles.map((article) => ({
				uri: resourceset.article.href({ slug: article.slug }),
				name: article.slug,
				title: article.title,
			}));
		}),

	read: (ctx) =>
		cached("resources/article", ctx.variables, async () => {
			let found = await findPublished(ctx.models, "articles", ctx.variables.slug);
			return found?.post.meta.content ?? null;
		}),
});
