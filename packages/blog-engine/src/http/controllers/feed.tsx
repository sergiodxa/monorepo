import { ok } from "@pkg/http/response/html";

import { createMetaCodec } from "../../domain/meta-codec";
import { Post } from "../../domain/post";
import { PostType } from "../../domain/post-type";
import action from "../../shared/lib/action";
import { renderDocument } from "../../shared/lib/render";
import { Layout } from "../../views/layout";
import { excerptFor, PostList, type PostListItem } from "../../views/post-render";
import { loadSiteChrome } from "../../views/site";

/** Home feed: recent published posts across every visible post type. */
export default action<"GET", "/">(async ({ db }) => {
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

	let body = await renderDocument(
		<Layout title={chrome.siteTitle} {...chrome}>
			<PostList items={items.slice(0, 20)} />
		</Layout>,
	);
	return ok(body);
});
