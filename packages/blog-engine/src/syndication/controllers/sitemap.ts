import { inject } from "@pkg/service-container";
import { Sitemap } from "@pkg/sitemap";
import { getContext } from "remix/async-context-middleware";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import { PostType } from "../../post-types/models/post-type";
import { createMetaCodec } from "../../posts/models/meta-codec";
import { Post } from "../../posts/models/post";
import routes from "../../routes";

/** Serves `/sitemap.xml`: home, each visible type index, and every published post. */
export default createAction(
	routes.sitemap,
	inject([Database] as const, async (db) => {
		let ctx = getContext();
		let origin = new URL(ctx.request.url).origin;
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
	}),
);
