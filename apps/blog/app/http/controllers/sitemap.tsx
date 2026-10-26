/**
 * HTTP action for the XML sitemap. It decides every route the blog declares, listing the section
 * pages, the topic index, every author's topic and every published article and tutorial, with
 * `lastmod` hints from the freshest post per section, so crawlers get the site's public pages.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { xml } from "@sdxc/http/response";
import { fromRoutes } from "@sdxc/sitemap/remix";
import { createAction } from "remix/router";

import { isBuiltInTopic } from "~/app/models/topics";
import routes from "~/routes/web";

/** The newest of `dates`, or `undefined` when no section has a post yet. */
function latest(...dates: Array<string | undefined>): Date | undefined {
	let times = dates.filter((date) => date !== undefined).map((date) => new Date(date).getTime());
	return times.length > 0 ? new Date(Math.max(...times)) : undefined;
}

/** Serves the XML sitemap covering the section pages and every published post. */
export default createAction(
	routes.sitemap,
	/**
	 * Repository `findAll` results arrive newest-first, so `.at(0)` holds the latest
	 * timestamp for each listing page. A kind's topic answers at its own section page, so only
	 * authors' topics list under `/topics/:slug`.
	 * @returns XML response for the sitemap endpoint.
	 */
	async function sitemapAction(ctx) {
		let [articles, tutorials, likes, topics] = await Promise.all([
			ctx.models.articles.findAll({ includePreview: false }),
			ctx.models.tutorials.findAll({ includePreview: false }),
			ctx.models.likes.findAll(),
			ctx.models.topics.findAll(),
		]);

		let lastArticleDate = articles.at(0)?.created_at;
		let lastTutorialDate = tutorials.at(0)?.created_at;
		let lastBookmarkDate = likes.at(0)?.created_at;

		let sitemap = fromRoutes(routes, ctx.url, {
			feed: { updatedAt: latest(lastArticleDate, lastTutorialDate, lastBookmarkDate) },
			colors: false,
			sponsor: false,
			sponsors: false,
			wellKnown: false,
			activityPub: false,
			nodeInfo: false,
			sitemap: false,
			health: false,
			mcp: false,
			mcpMarkdown: false,
			encoreSupport: false,
			encorePrivacy: false,
			encorePrivacyMarkdown: false,
			press: { index: true },
			pressMarkdown: false,
			about: true,
			aboutMarkdown: false,
			now: true,
			nowMarkdown: false,
			uses: true,
			usesMarkdown: false,
			resume: true,
			resumeMarkdown: false,
			articles: { updatedAt: latest(lastArticleDate) },
			tutorials: { updatedAt: latest(lastTutorialDate) },
			bookmarks: { updatedAt: latest(lastBookmarkDate) },
			glossary: true,
			releases: false,
			notes: false,
			til: false,
			topics: true,
			topic: topics
				.filter((topic) => !isBuiltInTopic(topic.slug))
				.map((topic) => ({ params: { slug: topic.slug } })),
			search: false,
			searchFrame: false,
			post: [
				...articles.map((article) => ({
					params: { postType: "articles", postSlug: article.meta.slug },
					updatedAt: new Date(article.created_at),
				})),
				...tutorials.map((tutorial) => ({
					params: { postType: "tutorials", postSlug: tutorial.meta.slug },
					updatedAt: new Date(tutorial.created_at),
				})),
			],
			postRelated: false,
			auth: false,
			rss: false,
			atom: false,
			jsonFeed: false,
			cms: false,
			robots: false,
		});

		return xml(sitemap.toString());
	},
);
