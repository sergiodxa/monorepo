import { ok } from "@pkg/http/response/html";

import { PostType } from "../../post-types/models/post-type";
import { Layout } from "../../shared/components/layout";
import { PostDate, PostFields } from "../../shared/components/post-render";
import action from "../../shared/lib/action";
import { renderDocument } from "../../shared/lib/render";
import { renderNotFound } from "../../shared/not-found";
import { loadSiteChrome } from "../../shared/site";
import { createMetaCodec } from "../models/meta-codec";
import { Post } from "../models/post";

/** Public post detail: `/:typePath/:slug`. Drafts and scheduled posts are hidden. */
export default action<"GET", "/:typePath/:slug">(async ({ db, params }) => {
	let type = await PostType.findByPath(db, params.typePath);
	if (!type || !type.visible) return renderNotFound(db);

	let codec = createMetaCodec(type);
	let post = await Post.findBySlugForType(db, type.name, params.slug, codec);
	if (!post || !Post.isPublished(post.published_at)) return renderNotFound(db);

	let chrome = await loadSiteChrome(db);
	let title = post.meta.title || "(untitled)";

	let body = await renderDocument(
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
	return ok(body);
});
