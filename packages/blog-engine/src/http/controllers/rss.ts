import type { Database } from "remix/data-table";

import { RSS } from "@pkg/rss";

import { createMetaCodec } from "../../domain/meta-codec";
import { Post } from "../../domain/post";
import { PostType, type PostTypeDefinition } from "../../domain/post-type";
import { Settings } from "../../domain/settings";
import action from "../../shared/lib/action";
import { excerptFor } from "../../views/post-render";

import { renderNotFound } from "./not-found";

/** Builds RSS items for one post type's published posts. */
async function itemsForType(
	db: Database,
	origin: string,
	type: PostTypeDefinition,
): Promise<RSS.Item[]> {
	let codec = createMetaCodec(type);
	let posts = await Post.findManyForType(db, type.name, codec);
	let items: RSS.Item[] = [];
	for (let post of posts) {
		if (!Post.isPublished(post.published_at)) continue;
		items.push({
			title: post.meta.title || "(untitled)",
			link: `${origin}/${type.path}/${post.slug}`,
			description: excerptFor(type, post.meta),
			pubDate: post.published_at ? new Date(post.published_at).toUTCString() : undefined,
		});
	}
	return items;
}

function xmlResponse(body: string): Response {
	return new Response(body, { headers: { "content-type": "application/rss+xml; charset=utf-8" } });
}

/** Global feed `/rss.xml`: published posts across all visible types. */
export const feedRss = action<"GET", "/rss.xml">(async ({ db, request }) => {
	let origin = new URL(request.url).origin;
	let [siteTitle, description, types] = await Promise.all([
		Settings.siteTitle(db),
		Settings.siteDescription(db),
		PostType.findVisible(db),
	]);

	let items: RSS.Item[] = [];
	for (let type of types) items.push(...(await itemsForType(db, origin, type)));

	let rss = new RSS({ title: siteTitle, description, link: origin, items });
	return xmlResponse(rss.toString());
});

/** Per-type feed `/:typePath.rss`. */
export const typeRss = action<"GET", "/:typePath.rss">(async ({ db, request, params }) => {
	let type = await PostType.findByPath(db, params.typePath);
	if (!type || !type.visible) return renderNotFound(db);

	let origin = new URL(request.url).origin;
	let [siteTitle, items] = await Promise.all([
		Settings.siteTitle(db),
		itemsForType(db, origin, type),
	]);

	let rss = new RSS({
		title: `${siteTitle} — ${type.label}`,
		description: type.description,
		link: `${origin}/${type.path}`,
		items,
	});
	return xmlResponse(rss.toString());
});
