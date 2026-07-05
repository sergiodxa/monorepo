/**
 * Home feed controller for `/`: the site's front page, aggregating recent published
 * posts across every visible post type into one newest-first list.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import { PostType } from "../../post-types/models/post-type";
import routes from "../../routes";
import { Layout } from "../../shared/components/layout";
import { excerptFor, PostList, type PostListItem } from "../../shared/components/post-render";
import { loadSiteChrome } from "../../shared/site";
import { createMetaCodec } from "../models/meta-codec";
import { Post } from "../models/post";

/** Home feed: recent published posts across every visible post type. */
export default createAction(
	routes.feed,
	inject([Database] as const, async (db) => {
		let ctx = getContext();
		let chrome = await loadSiteChrome(db);
		let types = await PostType.findVisible(db);

		let items: PostListItem[] = [];
		for (let type of types) {
			let codec = createMetaCodec(type);
			let posts = await Post.findManyForType(db, type.name, codec, { limit: 20 });
			for (let post of posts) {
				if (!Post.isPublished(post.published_at)) continue;
				items.push({
					title: post.meta.title || "(untitled)",
					href: `/${type.path}/${post.slug}`,
					publishedAt: post.published_at,
					excerpt: excerptFor(type, post.meta),
				});
			}
		}
		items.sort(
			(a, b) => (Date.parse(b.publishedAt ?? "") || 0) - (Date.parse(a.publishedAt ?? "") || 0),
		);

		return ctx.render(
			<Layout title={chrome.siteTitle} {...chrome}>
				<PostList items={items.slice(0, 20)} />
			</Layout>,
		);
	}),
);
