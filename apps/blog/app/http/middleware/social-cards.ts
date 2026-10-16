/**
 * Serves any page's social card at the page's own address with `.png` added
 * (`/articles/the-remix-way.png`, `/index.png` for the home page). It runs before routing,
 * since the post and topic patterns take an extension and would claim the `.png` path.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { currentLog } from "@sdxc/logger";

import { currentEnv } from "~/app/http/middleware/env";
import { socialCards as cardStorage } from "~/app/models/social-cards";
import {
	pagePathFromCardPath,
	readSocialCard,
	socialCardKey,
	socialCardVersion,
} from "~/app/services/social-card";
import { PROFILE } from "~/config/profile";

/**
 * A day: a listing's newest entries change with every post, so its card is fetched again
 * daily, while storage keeps every version the content has had.
 */
const CACHE_CONTROL = "public, max-age=86400";

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
		if (stored) return png(stored);

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
		return png(card);
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

/** The card as an image response, cacheable by any shared cache. */
function png(file: File): Response {
	return new Response(file.stream(), {
		headers: {
			"content-type": "image/png",
			"content-length": String(file.size),
			"cache-control": CACHE_CONTROL,
		},
	});
}
