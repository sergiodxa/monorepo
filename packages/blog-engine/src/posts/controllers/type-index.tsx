import { ok } from "@pkg/http/response/html";

import { PostType } from "../../post-types/models/post-type";
import { Layout } from "../../shared/components/layout";
import { excerptFor, PostList, type PostListItem } from "../../shared/components/post-render";
import action from "../../shared/lib/action";
import { renderDocument } from "../../shared/lib/render";
import { renderNotFound } from "../../shared/not-found";
import { loadSiteChrome } from "../../shared/site";
import { createMetaCodec } from "../models/meta-codec";
import { Post } from "../models/post";

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
