import { Sitemap } from "@pkg/sitemap";

import { PostType } from "../../post-types/models/post-type";
import { createMetaCodec } from "../../posts/models/meta-codec";
import { Post } from "../../posts/models/post";
import action from "../../shared/lib/action";

/** Serves `/sitemap.xml`: home, each visible type index, and every published post. */
export default action<"GET", "/sitemap.xml">(async ({ db, request }) => {
	let origin = new URL(request.url).origin;
	let sitemap = new Sitemap();
	sitemap.append(new URL("/", origin));

	let types = await PostType.findVisible(db);
	for (let type of types) {
		sitemap.append(new URL(`/${type.path}`, origin));
		let codec = createMetaCodec(type);
		let posts = await Post.findManyForType(db, type.name, codec);
		for (let post of posts) {
			if (!Post.isPublished(post.published_at)) continue;
			sitemap.append(new URL(`/${type.path}/${post.slug}`, origin), {
				updatedAt: new Date(post.updated_at),
			});
		}
	}

	return new Response(sitemap.toString(), {
		headers: { "content-type": "application/xml; charset=utf-8" },
	});
});
