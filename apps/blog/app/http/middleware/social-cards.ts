/**
 * Serves any page's social card at the page's own address with `.png` added
 * (`/articles/the-remix-way.png`, `/index.png` for the home page). It runs before routing,
 * since the post and topic patterns take an extension and would claim the `.png` path.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CacheTag } from "@sdxc/workers-cache";
import type { Middleware } from "remix/router";

import { currentLog } from "@sdxc/logger";
import { cacheTag } from "@sdxc/workers-cache";

import type { SocialCard } from "~/app/services/social-card";

import { currentEnv } from "~/app/http/middleware/env";
import { TAGS } from "~/app/initializers/cache";
import { socialCards as cardStorage } from "~/app/models/social-cards";
import {
	pagePathFromCardPath,
	readSocialCard,
	socialCardKey,
	socialCardVersion,
} from "~/app/services/social-card";
import { PROFILE } from "~/config/profile";

/**
 * A post's card at the edge until the post is edited, which purges its tag: nothing else
 * changes what the card shows. A browser keeps it an hour.
 */
const POST_CACHE_CONTROL = "public, max-age=3600, s-maxage=2592000";

/**
 * A listing's card for an hour. Every CMS write purges it at once, and the hour bounds how
 * long a scheduled post that goes live without a write waits to appear; storage is keyed by
 * content, so an expiry with nothing new costs a page render and no drawing.
 */
const LISTING_CACHE_CONTROL = "public, max-age=3600, s-maxage=3600";

/**
 * Answers a `GET` for `<page>.png` with that page's card: the stored one, or one rendered,
 * stored after the response, and returned. A `.png` path naming no published page continues
 * to the router. The drawing code and fonts load on the first card drawn.
 */
export default function socialCards(): Middleware {
	return async (context, next) => {
		let { pathname } = context.url;
		if (context.request.method !== "GET" || !pathname.endsWith(".png")) return next();
		let pagePath = pagePathFromCardPath(pathname.slice(1, -".png".length));
		let env = currentEnv();
		if (pagePath.endsWith(".png") || !env) return next();

		let html = await renderPage(env, pagePath);
		let content = html === null ? null : readSocialCard(html, pagePath);
		if (!content) return next();

		let cards = cardStorage();
		let key = socialCardKey(content);
		let stored = await cards.get(key);
		let tag = cardTag(content, pagePath);
		let cacheControl = content.kind === "post" ? POST_CACHE_CONTROL : LISTING_CACHE_CONTROL;
		if (stored) return png(stored, tag, cacheControl);

		let [{ socialCardFonts }, { renderSocialCard }] = await Promise.all([
			import("~/app/initializers/social-card-fonts"),
			import("~/app/services/social-card-image"),
		]);
		let fonts = socialCardFonts();
		if (fonts.status === "failure") {
			currentLog()?.fail(fonts.error, { path: pagePath });
			return new Response("The card's fonts could not be read\n", { status: 500 });
		}
		let bytes = await renderSocialCard(content, fonts.data);
		let card = new File([bytes.slice()], `${socialCardVersion(key)}.png`, { type: "image/png" });
		env.waitUntil(Promise.resolve(cards.set(key, card)));
		currentLog()?.set({ socialCard: { path: pagePath, rendered: true } });
		return png(card, tag, cacheControl);
	};
}

/**
 * Renders the page through the blog's own router as an anonymous visitor asking for HTML,
 * or `null` when the path is not a page that answers 200. The router is imported on demand
 * because it installs this middleware too.
 */
async function renderPage(env: App.Env, pagePath: string): Promise<string | null> {
	let { createWebRouter } = await import("~/app/initializers/router");
	let request = new Request(new URL(pagePath, PROFILE.canonical.origin), {
		headers: { accept: "text/html" },
	});
	let response = await createWebRouter(env).fetch(request);
	if (response.status !== 200) return null;
	if (!response.headers.get("content-type")?.includes("text/html")) return null;
	return await response.text();
}

/**
 * The cache tag the card's page carries, so the purge that clears the page clears its card:
 * a post's own tag, purged when the post is edited, and the post list's for a listing,
 * purged by every write that adds or changes a post.
 */
function cardTag(content: SocialCard.Content, pagePath: string): CacheTag {
	let [, postType = "", postSlug = ""] = pagePath.split("/");
	return content.kind === "post" ? TAGS.post(postType, postSlug) : TAGS.postList();
}

/** The card as an image response, tagged like its page and cacheable by any shared cache. */
function png(file: File, tag: CacheTag, cacheControl: string): Response {
	return new Response(file.stream(), {
		headers: {
			"content-type": "image/png",
			"content-length": String(file.size),
			"cache-control": cacheControl,
			"cache-tag": cacheTag([tag]),
		},
	});
}
