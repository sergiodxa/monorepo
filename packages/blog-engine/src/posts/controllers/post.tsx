/**
 * Public post detail controller for `/:typePath/:slug`: renders one published post's
 * title, date, and fields. Drafts, scheduled posts, and unknown/hidden types fall
 * through to the themed 404.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import { PostType } from "../../post-types/models/post-type";
import routes from "../../routes";
import { Layout } from "../../shared/components/layout";
import { PostDate, PostFields } from "../../shared/components/post-render";
import { renderNotFound } from "../../shared/not-found";
import { loadSiteChrome } from "../../shared/site";
import { createMetaCodec } from "../models/meta-codec";
import { Post } from "../models/post";

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
