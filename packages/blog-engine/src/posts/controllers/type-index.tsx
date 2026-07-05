import { createAction } from "remix/fetch-router";

import { PostType } from "../../post-types/models/post-type";
import routes from "../../routes";
import { Layout } from "../../shared/components/layout";
import { excerptFor, PostList, type PostListItem } from "../../shared/components/post-render";
import { renderNotFound } from "../../shared/not-found";
import { loadSiteChrome } from "../../shared/site";
import { createMetaCodec } from "../models/meta-codec";
import { Post } from "../models/post";

/** Public per-type index: `/:typePath` lists published posts of that type. */
export default createAction(routes.typeIndex, async (ctx) => {
	let { db, params } = ctx;
	let type = await PostType.findByPath(db, params.typePath);
	if (!type || !type.visible) return renderNotFound(ctx);

	let chrome = await loadSiteChrome(db);
	let codec = createMetaCodec(type);
	let posts = await Post.findManyForType(db, type.name, codec, { limit: 50 });
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
