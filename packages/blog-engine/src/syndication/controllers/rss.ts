/**
 * RSS feed controllers: the global `/rss.xml` feed across all visible post types and
 * the per-type `/:typePath.rss` feed. Both emit only published posts, mapping each to
 * an RSS item built from the type's fields.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";

import { RSS } from "@sdxc/rss";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { PostType, type PostTypeDefinition } from "../../post-types/models/post-type.js";
import { createMetaCodec } from "../../posts/models/meta-codec.js";
import { Post } from "../../posts/models/post.js";
import routes from "../../routes.js";
import { Settings } from "../../settings/models/settings.js";
import { excerptFor } from "../../shared/components/post-render.js";
import { renderNotFound } from "../../shared/not-found.js";

/**
 * Builds RSS items for one post type's published posts, linking each to its
 * absolute URL.
 * @param db - Database handle.
 * @param origin - The request origin used to build absolute links.
 * @param type - The post type whose posts become feed items.
 * @returns The RSS items for the type's published posts.
 */
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
export const feedRss = createAction(routes.rss, async (ctx) => {
	let origin = new URL(ctx.request.url).origin;
	let [siteTitle, description, types] = await Promise.all([
		Settings.siteTitle(ctx.db),
		Settings.siteDescription(ctx.db),
		PostType.findVisible(ctx.db),
	]);

	let items: RSS.Item[] = [];
	for (let type of types) items.push(...(await itemsForType(ctx.db, origin, type)));

	let rss = new RSS({ title: siteTitle, description, link: origin });
	for (let item of items) rss.addItem(item);
	return xmlResponse(rss.toString());
});

/** Per-type feed `/:typePath.rss`. */
export const typeRss = createAction(routes.typeRss, async (ctx) => {
	let { typePath } = s.parse(s.object({ typePath: s.string() }), ctx.params);
	let type = await PostType.findByPath(ctx.db, typePath);
	if (!type || !type.visible) return renderNotFound(ctx);

	let origin = new URL(ctx.request.url).origin;
	let [siteTitle, items] = await Promise.all([
		Settings.siteTitle(ctx.db),
		itemsForType(ctx.db, origin, type),
	]);

	let rss = new RSS({
		title: `${siteTitle} — ${type.label}`,
		description: type.description,
		link: `${origin}/${type.path}`,
	});
	for (let item of items) rss.addItem(item);
	return xmlResponse(rss.toString());
});
