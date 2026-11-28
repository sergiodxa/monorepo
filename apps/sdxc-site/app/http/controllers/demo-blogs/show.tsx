/**
 * `GET /showcase/:slug/demo(/*page)` — a complete sample blog built from `@sdxc/ui`: one mixed
 * feed at the root, every post, an archive, topics, search, an about page, a newsletter
 * sign-up, an RSS feed and a 404. Marked `noindex, nofollow`, since each blog is invented.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";

import { isFailure } from "@sdxc/result";
import { RSS } from "@sdxc/rss";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import type { DemoBlogPost } from "~/app/services/demo-blogs";
import type { DemoBlogContext, DemoBlogSite, DemoBlogView } from "~/resources/views/demo-blogs";

import { withStreamCache } from "~/app/http/caching";
import defaultHandler from "~/app/http/controllers/default-handler";
import { SUBSCRIBED_PARAM } from "~/app/http/controllers/demo-blogs/subscribe";
import { NOINDEX_NOFOLLOW } from "~/app/initializers/seo";
import {
	countTags,
	findFeaturedPost,
	findNeighbourPosts,
	findRelatedPosts,
	listPosts,
	listSeries,
	readArticle,
	searchPosts,
} from "~/app/services/demo-blogs";
import { SITE_URL } from "~/config/constants";
import DocumentLayout from "~/resources/layouts/document";
import {
	ABOUT_PAGE,
	ARCHIVE_PAGE,
	demoBlogHref,
	FEED_PAGE,
	findDemoBlogSite,
	SEARCH_PAGE,
	SUBSCRIBE_PAGE,
	TAGS_PAGE,
} from "~/resources/views/demo-blogs";
import routes from "~/routes/web";

/** The params a request carries; `page` is absent on the feed. */
const PARAMS = s.object({ slug: s.string(), page: s.optional(s.string()) });

/**
 * Renders the page a path names, or the blog's own 404 inside its frame. A kind's bare path
 * redirects to the feed narrowed to it, since the blog keeps one feed rather than one per kind.
 */
export default createAction(routes.showcase.demo, async (ctx) => {
	let { page: path, slug } = s.parse(PARAMS, ctx.params);
	let site = await findDemoBlogSite(slug);
	if (site === null) return defaultHandler(ctx);

	let href = demoBlogHref(slug);
	let posts = await listPosts(site);
	let context: DemoBlogContext = { site, slug, href, posts };
	let query = ctx.url.searchParams;
	let type = readType(site, query.get("type"));

	let render = async (title: string, view: DemoBlogView, status = 200) => {
		let renderPage = async () =>
			ctx.render(
				<DocumentLayout
					assets={ctx.assets}
					title={title === site.name ? site.name : `${title} — ${site.name}`}
					description={site.description}
					robots={NOINDEX_NOFOLLOW}
					siteFooter={false}
				>
					{site.render(view, context) as RemixNode}
				</DocumentLayout>,
				{ status },
			);
		if (status !== 200) return await renderPage();
		return await withStreamCache(ctx.request, ctx.url.search, renderPage);
	};
	let notFound = () => render("Page not found", { view: "not-found", path: ctx.url.pathname }, 404);

	if (path === undefined) {
		let filtered = type === null ? posts : posts.filter((post) => post.kind === type);
		let pageCount = Math.max(1, Math.ceil(filtered.length / site.pageSize));
		let page = readPage(query.get("page"));
		if (page === null || page > pageCount) return notFound();
		let pageHref = (n: number) => feedHref(href(), type, n);
		let featured = type === null && page === 1 ? findFeaturedPost(posts) : null;
		return render(type === null ? site.name : (site.kinds[type]?.label ?? site.name), {
			view: "feed",
			feed: filtered.slice((page - 1) * site.pageSize, page * site.pageSize),
			type,
			page,
			pageCount,
			pageHref,
			featured,
		});
	}

	if (path === FEED_PAGE) return feed(site, slug, posts);
	if (path === ARCHIVE_PAGE) {
		let filtered = type === null ? posts : posts.filter((post) => post.kind === type);
		return render("Archive", { view: "archive", posts: filtered, type });
	}
	if (path === TAGS_PAGE) return render("Topics", { view: "tags", tags: countTags(posts) });
	if (path.startsWith(`${TAGS_PAGE}/`)) {
		let tag = decodeURIComponent(path.slice(TAGS_PAGE.length + 1));
		let tagged = posts.filter((post) => post.tags.includes(tag));
		if (tagged.length === 0) return notFound();
		return render(`Posts about ${tag}`, { view: "tag", tag, posts: tagged });
	}
	if (path === SEARCH_PAGE) {
		let text = query.get("q") ?? "";
		let matches = searchPosts(posts, text);
		let results = type === null ? matches : matches.filter((post) => post.kind === type);
		let title = text.trim() === "" ? "Search" : `Search: ${text.trim()}`;
		return render(title, { view: "search", query: text, type, matches, results });
	}
	if (path === ABOUT_PAGE) return render(`About ${site.author.name}`, { view: "about" });
	if (path === SUBSCRIBE_PAGE) {
		return render("Subscribe", { view: "subscribe", sent: query.has(SUBSCRIBED_PARAM) });
	}
	if (Object.hasOwn(site.kinds, path)) {
		return new Response(null, {
			status: 301,
			headers: { Location: feedHref(href(), path, 1) },
		});
	}

	let [kind, postSlug, ...rest] = path.split("/");
	if (kind === undefined || postSlug === undefined || rest.length > 0) return notFound();
	let article = await readArticle(site, kind, postSlug);
	if (isFailure(article)) return failed(article.error);
	if (article.data === null) return notFound();
	let { post } = article.data;
	return render(post.title, {
		view: "post",
		article: article.data,
		...findNeighbourPosts(posts, post.path),
		related: findRelatedPosts(posts, post),
		series: listSeries(posts, post.series),
	});
});

/** Reads `?type=` into one of the blog's kinds; anything else is the whole feed. */
function readType(site: DemoBlogSite, value: string | null): string | null {
	return value !== null && Object.hasOwn(site.kinds, value) ? value : null;
}

/** Reads `?page=` as a page number from 1; a value that is not one is `null`. */
function readPage(value: string | null): number | null {
	if (value === null) return 1;
	let page = Number(value);
	return Number.isInteger(page) && page >= 1 ? page : null;
}

/** The feed's address narrowed to a kind and a page, leaving out what is the default. */
function feedHref(root: string, type: string | null, page: number): string {
	let search = new URLSearchParams();
	if (type !== null) search.set("type", type);
	if (page > 1) search.set("page", String(page));
	let text = search.toString();
	return text === "" ? root : `${root}?${text}`;
}

/**
 * The blog as RSS 2.0, every post with its lead, a bookmark linking to the page it saves.
 * Addresses name the site's one origin, since a feed reader stores them as identities.
 */
function feed(site: DemoBlogSite, slug: string, posts: DemoBlogPost[]): Response {
	let href = demoBlogHref(slug);
	let absolute = (path: string) => new URL(path, SITE_URL).href;
	let xml = RSS.stringify({
		channel: {
			title: site.name,
			description: site.description,
			link: absolute(href()),
			language: "en",
			atomLink: { href: absolute(href(FEED_PAGE)), rel: "self", type: "application/rss+xml" },
		},
		items: posts.map((post) => ({
			guid: { value: absolute(href(post.path)), isPermaLink: true },
			title: post.title,
			description: post.description,
			link: post.url ?? absolute(href(post.path)),
			pubDate: new Date(`${post.date}T12:00:00Z`).toUTCString(),
			category: post.tags,
		})),
	});
	if (isFailure(xml)) return failed(xml.error);
	return new Response(xml.data, {
		headers: {
			"Content-Type": "application/rss+xml; charset=utf-8",
			"Cache-Control": "public, max-age=300",
			"X-Robots-Tag": "noindex",
		},
	});
}

/** A plain-text `500` naming what failed to read, so a broken post fails loudly in one place. */
function failed(error: Error): Response {
	return new Response(`This page could not be built: ${error.message}`, {
		status: 500,
		headers: { "Content-Type": "text/plain; charset=utf-8" },
	});
}
