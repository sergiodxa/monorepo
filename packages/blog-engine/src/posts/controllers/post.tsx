/**
 * Public post detail controller for `/:typePath/:slug`: renders one published post's
 * title, date, and fields. Drafts, scheduled posts, and unknown/hidden types fall
 * through to the themed 404.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { inject } from "@sdxc/service-container";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { createAction } from "remix/router";

import { PostType } from "../../post-types/models/post-type.js";
import routes from "../../routes.js";
import { Layout } from "../../shared/components/layout.js";
import { PostDate, PostFields } from "../../shared/components/post-render.js";
import { renderNotFound } from "../../shared/not-found.js";
import { loadSiteChrome } from "../../shared/site.js";
import { createMetaCodec } from "../models/meta-codec.js";
import { Post } from "../models/post.js";

/** Public post detail: `/:typePath/:slug`. Drafts and scheduled posts are hidden. */
export default createAction(
	routes.post,
	inject([Database] as const, async (db) => {
		let ctx = getContext();
		let { typePath, slug } = s.parse(
			s.object({ typePath: s.string(), slug: s.string() }),
			ctx.params,
		);
		let type = await PostType.findByPath(db, typePath);
		if (!type || !type.visible) return renderNotFound(ctx);

		let codec = createMetaCodec(type);
		let post = await Post.findBySlugForType(db, type.name, slug, codec);
		if (!post || !Post.isPublished(post.published_at)) return renderNotFound(ctx);

		let chrome = await loadSiteChrome(db);
		let title = post.meta.title || "(untitled)";

		return ctx.render(
			<Layout title={`${title} · ${chrome.siteTitle}`} {...chrome}>
				<article>
					<header>
						<h1>{title}</h1>
						<PostDate publishedAt={post.published_at} />
					</header>
					<PostFields definition={type} meta={post.meta} />
				</article>
			</Layout>,
		);
	}),
);
