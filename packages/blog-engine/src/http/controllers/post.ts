import { ok } from "@pkg/http/response/html";

import { createMetaCodec } from "../../domain/meta-codec";
import { Post } from "../../domain/post";
import { PostType } from "../../domain/post-type";
import action from "../../shared/lib/action";
import { escape } from "../../views/html";
import { documentLayout } from "../../views/layout";
import { renderDate, renderFields } from "../../views/post-render";
import { loadSiteChrome } from "../../views/site";

import { renderNotFound } from "./not-found";

/** Public post detail: `/:typePath/:slug`. Drafts and scheduled posts are hidden. */
export default action<"GET", "/:typePath/:slug">(async ({ db, params }) => {
	let type = await PostType.findByPath(db, params.typePath);
	if (!type || !type.visible) return renderNotFound(db);

	let codec = createMetaCodec(type);
	let post = await Post.findBySlugForType(db, type.name, params.slug, codec);
	if (!post || !Post.isPublished(post.published_at)) return renderNotFound(db);

	let chrome = await loadSiteChrome(db);
	let title = post.meta.title || "(untitled)";
	let body =
		`<article>` +
		`<header><h1>${escape(title)}</h1>${renderDate(post.published_at)}</header>` +
		renderFields(type, post.meta) +
		`</article>`;

	return ok(
		documentLayout({
			title: `${title} · ${chrome.siteTitle}`,
			siteTitle: chrome.siteTitle,
			description: chrome.description,
			themeStyle: chrome.themeStyle,
			customCss: chrome.customCss,
			navLinks: chrome.navLinks,
			body,
		}),
	);
});
