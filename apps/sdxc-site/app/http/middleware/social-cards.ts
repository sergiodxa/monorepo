/**
 * Serves any page's social card at the page's own address with `.png` added
 * (`/api/jwt.png`, `/index.png` for the home page). It runs before routing, since page
 * patterns such as `/docs/*slug` would otherwise claim the `.png` path as a page of theirs.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { currentLog } from "@sdxc/logger";
import { waitUntil } from "cloudflare:workers";

import { socialCards as cardStorage } from "~/app/models/social-cards";
import {
	pagePathFromCardPath,
	readPageFacts,
	socialCardContent,
	socialCardHash,
	socialCardKey,
} from "~/app/services/social-card";
import { absoluteUrl } from "~/config/constants";

/** A year, for a card whose URL names its content's hash and so can never change. */
const IMMUTABLE = "public, max-age=31536000, immutable";

/** An hour, for a card asked for without its hash, whose page may change under it. */
const REVALIDATE = "public, max-age=3600";

/**
 * Answers a `GET` for `<page>.png` with that page's card. A repeat request is answered from the edge
 * cache; a `v` naming a stored card is served without rendering its page; otherwise the page is
 * rendered, its card read from storage or drawn, stored after the response, and returned.
 *
 * @param fetchPage Answers a request through the router installing this middleware.
 */
export default function socialCards(
	fetchPage: (request: Request) => Promise<Response>,
): Middleware {
	return async (context, next) => {
		let { pathname } = context.url;
		if (context.request.method !== "GET" || !pathname.endsWith(".png")) return next();
		let pagePath = pagePathFromCardPath(pathname.slice(1, -".png".length));
		if (pagePath.endsWith(".png")) return next();

		let edge = edgeCache();
		let cached = await edge?.match(context.request);
		if (cached) return cached;
		let respond = (response: Response) => {
			if (edge) waitUntil(edge.put(context.request, response.clone()));
			return response;
		};

		let storage = cardStorage();
		let version = context.url.searchParams.get("v");
		if (version && /^[0-9a-z]+$/.test(version)) {
			let stored = await storage.get(socialCardKey(version));
			if (stored) return respond(png(stored, IMMUTABLE));
		}

		let page = await renderPage(fetchPage, pagePath);
		if (!page) return next();

		let content = socialCardContent(page);
		let hash = socialCardHash(content);
		let cacheControl = version === hash ? IMMUTABLE : REVALIDATE;
		let key = socialCardKey(hash);

		let stored = await storage.get(key);
		if (stored) return respond(png(stored, cacheControl));

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
		return respond(png(card, cacheControl));
	};
}

/**
 * Renders the page through the site's own router and reads its title and description,
 * or `null` when the path is not a page.
 */
async function renderPage(fetchPage: (request: Request) => Promise<Response>, pagePath: string) {
	let response = await fetchPage(new Request(absoluteUrl(pagePath)));
	if (response.status !== 200) return null;
	if (!response.headers.get("content-type")?.includes("text/html")) return null;
	return readPageFacts(await response.text(), pagePath);
}

/**
 * The colo's Workers cache, which answers a repeated card request before any page renders;
 * absent outside the Workers runtime. Cast, since the DOM's `CacheStorage` type shadows the
 * Workers declaration that has `default`.
 */
function edgeCache(): Cache | null {
	if (typeof caches === "undefined") return null;
	return (caches as unknown as { default: Cache }).default;
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
