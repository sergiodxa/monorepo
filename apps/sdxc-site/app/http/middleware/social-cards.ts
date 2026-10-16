/**
 * Serves any page's social card at the page's own address with `.png` added
 * (`/api/jwt.png`, `/index.png` for the home page). It runs before routing, since page
 * patterns such as `/docs/*slug` would otherwise claim the `.png` path as a page of theirs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { waitUntil } from "cloudflare:workers";
import { currentLog } from "sdxc/logger";

import { socialCards as cardStorage } from "~/app/models/social-cards";
import {
	pagePathFromCardPath,
	readPageFacts,
	socialCardContent,
	socialCardHash,
	socialCardKey,
} from "~/app/services/social-card";
import { absoluteUrl } from "~/config/site";

/** A year, for a card whose URL names its content's hash and so can never change. */
const IMMUTABLE = "public, max-age=31536000, immutable";

/** An hour, for a card asked for without its hash, whose page may change under it. */
const REVALIDATE = "public, max-age=3600";

/**
 * Answers a `GET` for `<page>.png` with that page's card: the stored one, or one rendered,
 * stored after the response, and returned. The drawing code and fonts load on the first
 * card drawn, so every other request runs without them. A `.png` path naming no page continues to the
 * router, so it answers as any unknown address does.
 */
export default function socialCards(): Middleware {
	return async (context, next) => {
		let { pathname } = context.url;
		if (context.request.method !== "GET" || !pathname.endsWith(".png")) return next();
		let pagePath = pagePathFromCardPath(pathname.slice(1, -".png".length));
		if (pagePath.endsWith(".png")) return next();

		let page = await renderPage(pagePath);
		if (!page) return next();

		let content = socialCardContent(page);
		let hash = socialCardHash(content);
		let cacheControl = context.url.searchParams.get("v") === hash ? IMMUTABLE : REVALIDATE;
		let storage = cardStorage();
		let key = socialCardKey(content);

		let stored = await storage.get(key);
		if (stored) return png(stored, cacheControl);

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
		let card = new File([bytes.slice()], `${hash}.png`, { type: "image/png" });
		waitUntil(Promise.resolve(storage.set(key, card)));
		currentLog()?.set({ socialCard: { path: pagePath, rendered: true } });
		return png(card, cacheControl);
	};
}

/**
 * Renders the page through the site's own router and reads its title and description,
 * or `null` when the path is not a page. The router is imported on demand because it
 * installs this middleware too.
 */
async function renderPage(pagePath: string) {
	let { createWebRouter } = await import("~/app/initializers/router");
	let response = await createWebRouter().fetch(new Request(absoluteUrl(pagePath)));
	if (response.status !== 200) return null;
	if (!response.headers.get("content-type")?.includes("text/html")) return null;
	return readPageFacts(await response.text(), pagePath);
}

/** The card as an image response, cacheable by any shared cache. */
function png(file: File, cacheControl: string): Response {
	return new Response(file.stream(), {
		headers: {
			"content-type": "image/png",
			"content-length": String(file.size),
			"cache-control": cacheControl,
		},
	});
}
