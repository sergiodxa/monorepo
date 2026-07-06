/**
 * RSS feed controllers: the global `/rss.xml` feed across all visible post types and
 * the per-type `/:typePath.rss` feed. Both emit only published posts, mapping each to
 * an RSS item built from the type's fields.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { RSS } from "@pkg/rss";
import { inject } from "@pkg/service-container";
import { getContext } from "remix/async-context-middleware";
import * as s from "remix/data-schema";
import { Database } from "remix/data-table";
import { createAction } from "remix/fetch-router";

import { PostType, type PostTypeDefinition } from "../../post-types/models/post-type";
import { createMetaCodec } from "../../posts/models/meta-codec";
import { Post } from "../../posts/models/post";
import routes from "../../routes";
import { Settings } from "../../settings/models/settings";
import { excerptFor } from "../../shared/components/post-render";
import { renderNotFound } from "../../shared/not-found";

/**
 * Builds RSS items for one post type's published posts (drafts and scheduled posts
 * are skipped), linking each to its absolute URL.
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
export const feedRss = createAction(
	routes.rss,
	inject([Database] as const, async (db) => {
		let ctx = getContext();
		let origin = new URL(ctx.request.url).origin;
		let [siteTitle, description, types] = await Promise.all([
			Settings.siteTitle(db),
			Settings.siteDescription(db),
			PostType.findVisible(db),
		]);

		let items: RSS.Item[] = [];
		for (let type of types) items.push(...(await itemsForType(db, origin, type)));

		let rss = new RSS({ title: siteTitle, description, link: origin });
		for (let item of items) rss.addItem(item);
		return xmlResponse(rss.toString());
	}),
);

/** Per-type feed `/:typePath.rss`. */
export const typeRss = createAction(
	routes.typeRss,
	inject([Database] as const, async (db) => {
		let ctx = getContext();
		let { typePath } = s.parse(s.object({ typePath: s.string() }), ctx.params);
		let type = await PostType.findByPath(db, typePath);
		if (!type || !type.visible) return renderNotFound(ctx);

		let origin = new URL(ctx.request.url).origin;
		let [siteTitle, items] = await Promise.all([
			Settings.siteTitle(db),
			itemsForType(db, origin, type),
		]);

		let rss = new RSS({
			title: `${siteTitle} — ${type.label}`,
			description: type.description,
			link: `${origin}/${type.path}`,
		});
		for (let item of items) rss.addItem(item);
		return xmlResponse(rss.toString());
	}),
);
