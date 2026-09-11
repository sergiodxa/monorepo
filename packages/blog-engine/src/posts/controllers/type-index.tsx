/**
 * Public per-type index controller for `/:typePath`: lists a visible post type's
 * published posts. Unknown or hidden types fall through to the themed 404.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { PostType } from "../../post-types/models/post-type.js";
import routes from "../../routes.js";
import { Layout } from "../../shared/components/layout.js";
import { excerptFor, PostList, type PostListItem } from "../../shared/components/post-render.js";
import { renderNotFound } from "../../shared/not-found.js";
import { loadSiteChrome } from "../../shared/site.js";
import { createMetaCodec } from "../models/meta-codec.js";
import { Post } from "../models/post.js";

/** Public per-type index: `/:typePath` lists published posts of that type. */
export default createAction(routes.typeIndex, async (ctx) => {
	let { typePath } = s.parse(s.object({ typePath: s.string() }), ctx.params);
	let type = await PostType.findByPath(ctx.db, typePath);
	if (!type || !type.visible) return renderNotFound(ctx);

	let chrome = await loadSiteChrome(ctx.db);
	let codec = createMetaCodec(type);
	let posts = await Post.findManyForType(ctx.db, type.name, codec, { limit: 50 });
	let items: PostListItem[] = posts
		.filter((post) => Post.isPublished(post.published_at))
		.map((post) => ({
			title: post.meta.title || "(untitled)",
			href: `/${type.path}/${post.slug}`,
			publishedAt: post.published_at,
			excerpt: excerptFor(type, post.meta),
		}));

	return ctx.render(
		<Layout title={`${type.label} · ${chrome.siteTitle}`} {...chrome}>
			<h1>{type.label}</h1>
			<PostList items={items} />
		</Layout>,
	);
});
