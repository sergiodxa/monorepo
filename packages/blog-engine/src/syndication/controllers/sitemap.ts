/**
 * Controller for `/sitemap.xml`, listing the home page, each visible type index, and
 * every published post (with its last-modified date) so search engines can crawl the
 * whole public site.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { inject } from "@sdxc/service-container";
import { Sitemap } from "@sdxc/sitemap";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import { PostType } from "../../post-types/models/post-type.js";
import { createMetaCodec } from "../../posts/models/meta-codec.js";
import { Post } from "../../posts/models/post.js";
import routes from "../../routes.js";

/** Serves `/sitemap.xml`: home, each visible type index, and every published post. */
export default createAction(
	routes.sitemap,
	inject([Database] as const, async (db) => {
		let ctx = getContext();
		let origin = new URL(ctx.request.url).origin;
		let sitemap = new Sitemap();
		sitemap.append(new URL("/", origin));

		let types = await PostType.findVisible(db);
		let postsByType = await Promise.all(
			types.map(async (type) => ({
				type,
				posts: await Post.findManyForType(db, type.name, createMetaCodec(type)),
			})),
		);

		for (let { type, posts } of postsByType) {
			sitemap.append(new URL(`/${type.path}`, origin));
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
