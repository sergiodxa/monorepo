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
export default createAction(routes.post, async (ctx) => {
	let { db, params } = ctx;
	let type = await PostType.findByPath(db, params.typePath);
	if (!type || !type.visible) return renderNotFound(ctx);

	let codec = createMetaCodec(type);
	let post = await Post.findBySlugForType(db, type.name, params.slug, codec);
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
});
