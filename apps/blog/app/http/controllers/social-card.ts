/**
 * `GET /social/*path.png` — a page's social card. The page is rendered in-process with the
 * request's own environment and its microformats are read back, so only a published page
 * has a card and the card always says what the page publishes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { text } from "@sdxc/http/response";
import { createAction } from "remix/router";

import { currentEnv } from "~/app/http/middleware/env";
import { socialCardFonts } from "~/app/initializers/social-card-fonts";
import { socialCards } from "~/app/models/social-cards";
import {
	pagePathFromCardPath,
	readSocialCard,
	socialCardKey,
	socialCardVersion,
} from "~/app/services/social-card";
import { renderSocialCard } from "~/app/services/social-card-image";
import { PROFILE } from "~/config/profile";
import routes from "~/routes/web";

/**
 * A day: a listing's newest entries change with every post, so its card is fetched again
 * daily, while storage keeps every version the content has had.
 */
const CACHE_CONTROL = "public, max-age=86400";

/**
 * Serves the stored card, or renders, stores and serves it. Storing happens after the
 * response, so the first reader waits only for the drawing.
 */
export default createAction(routes.socialCard, async (ctx) => {
	let pagePath = pagePathFromCardPath(ctx.params.path);
	if (pagePath.startsWith("/social/")) return missing();
	let env = currentEnv();
	if (!env) return missing();

	let html = await renderPage(env, pagePath);
	let content = html === null ? null : readSocialCard(html, pagePath);
	if (!content) return missing();

	let storage = socialCards();
	let key = socialCardKey(content);
	let stored = await storage.get(key);
	if (stored) return png(stored);

	let fonts = socialCardFonts();
	if (fonts.status === "failure") {
		ctx.log.fail(fonts.error, { path: pagePath });
		return text("The card's fonts could not be read\n", { status: 500 });
	}
	let bytes = await renderSocialCard(content, fonts.data);
	let card = new File([bytes.slice()], `${socialCardVersion(key)}.png`, { type: "image/png" });
	env.waitUntil(Promise.resolve(storage.set(key, card)));
	ctx.log.set({ socialCard: { path: pagePath, rendered: true } });
	return png(card);
});

/**
 * Renders the page through the blog's own router as an anonymous visitor asking for HTML,
 * or `null` when the path is not a page that answers 200. The router is imported on demand
 * because it maps this controller too.
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

/** A path with no published page behind it has no card. */
function missing(): Response {
	return text("Not found\n", { status: 404 });
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
