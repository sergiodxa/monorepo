/**
 * MCP tools and resources for articles and tutorials.
 *
 * One file per content area, holding both the model-invoked tools and the person-picked
 * resources over the same posts, so the publish rule they share is stated once here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { createResource, createToolController, ToolError } from "@sdxc/mcp";

import type { Post as PostTypes } from "~/app/repositories/post";

import { getDatabase } from "~/app/http/middleware/database";
import { cached } from "~/app/mcp/cache";
import resourceset from "~/app/mcp/resources";
import toolset from "~/app/mcp/tools";
import { Post } from "~/app/repositories/post";
import { ArticlePost } from "~/app/repositories/posts/article";
import { TutorialPost } from "~/app/repositories/posts/tutorial";

/** Where each collection's pages live, for building a post's public URL. */
const COLLECTION_PATHS = { articles: "/articles", tutorials: "/tutorials" } as const;

/**
 * Reads one published post, or reports it as absent.
 *
 * The publish rule is enforced here because `findByTypeAndSlug` returns preview posts too;
 * only the HTML route otherwise guards against a slug learned elsewhere reaching a draft.
 *
 * @param db Database connection used for the lookup.
 * @param postType Which collection to look in.
 * @param postSlug The post's slug.
 * @returns The post, or `null` when it is missing or still in preview.
 */
async function findPublished(
	db: Database,
	postType: PostTypes.PublicTypePath,
	postSlug: string,
): Promise<PostTypes.PublicFoundByTypeAndSlug | null> {
	let found = await Post.findByTypeAndSlug(db, { postType, postSlug });
	if (!found) return null;
	if (!Post.isPublishedAt(found.post.published_at)) return null;
	return found;
}

/** Projects a list row for a machine reader, carrying the URL so a citation is possible. */
function listItem(
	collection: keyof typeof COLLECTION_PATHS,
	item: { title: string; slug: string; published_at: string | null; created_at: string },
) {
	let timestamp = Post.timestampFromPublishedOrCreated(item);

	return {
		title: item.title,
		slug: item.slug,
		url: `${COLLECTION_PATHS[collection]}/${item.slug}`,
		publishedAt: Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString(),
	};
}

/** Answers `list_posts` and `get_post`. */
export const postsController = createToolController(toolset.posts, {
	actions: {
		/** Lists one collection, newest first, paged. */
		list: async (ctx) => {
			let db = getDatabase(ctx);
			let items =
				ctx.input.type === "articles"
					? await ArticlePost.listItems(db, { includePreview: false })
					: await TutorialPost.listItems(db, { includePreview: false });

			let page = items.slice(ctx.input.offset, ctx.input.offset + ctx.input.limit);

			return {
				type: ctx.input.type,
				total: items.length,
				offset: ctx.input.offset,
				posts: page.map((item) => listItem(ctx.input.type, item)),
			};
		},

		/** Reads one post in full, as the Markdown it was written in. */
		get: async (ctx) => {
			let found = await findPublished(getDatabase(ctx), ctx.input.type, ctx.input.slug);
			if (!found) {
				let noun = ctx.input.type === "articles" ? "article" : "tutorial";
				throw new ToolError(
					`No published ${noun} has the slug "${ctx.input.slug}". Call search_posts or list_posts to find one.`,
				);
			}

			return {
				type: found.postType,
				title: found.post.meta.title,
				slug: found.post.meta.slug,
				url: `${COLLECTION_PATHS[found.postType]}/${found.post.meta.slug}`,
				excerpt: found.post.meta.excerpt,
				tags: found.postType === "tutorials" ? found.tags : [],
				content: found.post.meta.content,
			};
		},
	},
});

/**
 * Serves published articles as pickable resources.
 *
 * Both halves are cached explicitly, because resources have no middleware layer to do it
 * for them: a picker calls `list` on every refresh, and it reads every published article.
 */
export const articleResource = createResource(resourceset.article, {
	list: (ctx) =>
		cached("resources/articles", null, async () => {
			let articles = await ArticlePost.listItems(getDatabase(ctx), { includePreview: false });

			return articles.map((article) => ({
				uri: resourceset.article.href({ slug: article.slug }),
				name: article.slug,
				title: article.title,
			}));
		}),

	read: (ctx) =>
		cached("resources/article", ctx.variables, async () => {
			let found = await findPublished(getDatabase(ctx), "articles", ctx.variables.slug);
			return found?.post.meta.content ?? null;
		}),
});

/** Serves published tutorials as pickable resources. Cached like the articles above. */
export const tutorialResource = createResource(resourceset.tutorial, {
	list: (ctx) =>
		cached("resources/tutorials", null, async () => {
			let tutorials = await TutorialPost.listItems(getDatabase(ctx), { includePreview: false });

			return tutorials.map((tutorial) => ({
				uri: resourceset.tutorial.href({ slug: tutorial.slug }),
				name: tutorial.slug,
				title: tutorial.title,
			}));
		}),

	read: (ctx) =>
		cached("resources/tutorial", ctx.variables, async () => {
			let found = await findPublished(getDatabase(ctx), "tutorials", ctx.variables.slug);
			return found?.post.meta.content ?? null;
		}),
});
