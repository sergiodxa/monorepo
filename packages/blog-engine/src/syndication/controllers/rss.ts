/**
 * RSS feed controllers: the global `/rss.xml` feed across all visible post types and
 * the per-type `/:typePath.rss` feed. Both emit only published posts, mapping each to
 * an RSS item built from the type's fields, and advertise the blog's WebSub hub when set.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Database } from "remix/data-table";
import type { Action } from "remix/router";

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
import { advertiseHub } from "../websub.js";

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

/**
 * The feed as an RSS response, carrying the hub's `Link` header when the blog has a hub.
 * @param body - The serialized feed.
 * @param headers - Extra headers, the hub advertisement's.
 * @returns The response.
 */
function xmlResponse(body: string, headers: HeadersInit): Response {
	let response = new Headers(headers);
	response.set("content-type", "application/rss+xml; charset=utf-8");
	return new Response(body, { headers: response });
}

/**
 * Global feed `/rss.xml`: published posts across all visible types. RSS requires a channel
 * description, so a blog whose owner left it blank describes its feed by its title.
 */
export const feedRss: Action<typeof routes.rss> = createAction(routes.rss, async (ctx) => {
	let origin = new URL(ctx.request.url).origin;
	let [siteTitle, description, types, hubUrl] = await Promise.all([
		Settings.siteTitle(ctx.db),
		Settings.siteDescription(ctx.db),
		PostType.findVisible(ctx.db),
		Settings.websubHub(ctx.db),
	]);
	let hub = advertiseHub(hubUrl, new URL(routes.rss.href(), origin).toString());

	let items: RSS.Item[] = [];
	for (let type of types) items.push(...(await itemsForType(ctx.db, origin, type)));

	let rss = new RSS({
		title: siteTitle,
		description: description || siteTitle,
		link: origin,
		atomLink: hub.atomLink,
	});
	for (let item of items) rss.addItem(item);
	return xmlResponse(rss.toString(), hub.headers);
});

/** Per-type feed `/:typePath.rss`, described by the type's label when its description is blank. */
export const typeRss: Action<typeof routes.typeRss> = createAction(routes.typeRss, async (ctx) => {
	let { typePath } = s.parse(s.object({ typePath: s.string() }), ctx.params);
	let type = await PostType.findByPath(ctx.db, typePath);
	if (!type || !type.visible) return renderNotFound(ctx);

	let origin = new URL(ctx.request.url).origin;
	let [siteTitle, items, hubUrl] = await Promise.all([
		Settings.siteTitle(ctx.db),
		itemsForType(ctx.db, origin, type),
		Settings.websubHub(ctx.db),
	]);
	let hub = advertiseHub(hubUrl, new URL(routes.typeRss.href({ typePath }), origin).toString());

	let rss = new RSS({
		title: `${siteTitle} — ${type.label}`,
		description: type.description || type.label,
		link: `${origin}/${type.path}`,
		atomLink: hub.atomLink,
	});
	for (let item of items) rss.addItem(item);
	return xmlResponse(rss.toString(), hub.headers);
});
