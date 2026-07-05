import { ok } from "@pkg/http/response/html";

import { createMetaCodec } from "../../domain/meta-codec";
import { Post } from "../../domain/post";
import { PostType } from "../../domain/post-type";
import action from "../../shared/lib/action";
import { renderDocument } from "../../shared/lib/render";
import { Layout } from "../../views/layout";
import { excerptFor, PostList, type PostListItem } from "../../views/post-render";
import { loadSiteChrome } from "../../views/site";

import { renderNotFound } from "./not-found";

/** Public per-type index: `/:typePath` lists published posts of that type. */
export default action<"GET", "/:typePath">(async ({ db, params }) => {
	let type = await PostType.findByPath(db, params.typePath);
	if (!type || !type.visible) return renderNotFound(db);

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

	let body = await renderDocument(
		<Layout title={`${type.label} · ${chrome.siteTitle}`} {...chrome}>
			<h1>{type.label}</h1>
			<PostList items={items} />
		</Layout>,
	);
	return ok(body);
});
