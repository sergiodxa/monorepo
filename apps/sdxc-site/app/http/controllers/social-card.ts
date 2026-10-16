/**
 * `GET /social/*path.png` — a page's social card. The card's text comes from the page
 * itself, rendered in-process and read from its Open Graph tags, so only a path that is a
 * page has a card and the card always says what the page says.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { waitUntil } from "cloudflare:workers";
import * as s from "remix/data-schema";
import { createAction } from "remix/router";
import { text } from "sdxc/http/response";

import { socialCardFonts } from "~/app/initializers/social-card-fonts";
import { socialCards } from "~/app/models/social-cards";
import {
	pagePathFromCardPath,
	readPageFacts,
	socialCardContent,
	socialCardHash,
	socialCardKey,
} from "~/app/services/social-card";
import { renderSocialCard } from "~/app/services/social-card-image";
import { absoluteUrl } from "~/config/site";
import routes from "~/routes/web";

/** A year, for a card whose URL names its content's hash and so can never change. */
const IMMUTABLE = "public, max-age=31536000, immutable";

/** An hour, for a card asked for without its hash, whose page may change under it. */
const REVALIDATE = "public, max-age=3600";

/**
 * Serves the stored card, or renders, stores and serves it. Storing happens after the
 * response, so the first reader waits only for the drawing.
 */
export default createAction(routes.socialCard, async (ctx) => {
	let { path } = s.parse(s.object({ path: s.string() }), ctx.params);
	let pagePath = pagePathFromCardPath(path);
	if (pagePath.startsWith("/social/")) return missing();

	let page = await renderPage(pagePath);
	if (!page) return missing();

	let content = socialCardContent(page);
	let hash = socialCardHash(content);
	let cacheControl = ctx.url.searchParams.get("v") === hash ? IMMUTABLE : REVALIDATE;
	let storage = socialCards();
	let key = socialCardKey(content);

	let stored = await storage.get(key);
	if (stored) return png(stored, cacheControl);

	let fonts = socialCardFonts();
	if (fonts.status === "failure") {
		ctx.log.fail(fonts.error, { path: pagePath });
		return text("The card's fonts could not be read\n", { status: 500 });
	}
	let bytes = await renderSocialCard(content, fonts.data);
	let card = new File([bytes.slice()], `${hash}.png`, {
		type: "image/png",
	});
	waitUntil(Promise.resolve(storage.set(key, card)));
	ctx.log.set({ socialCard: { path: pagePath, rendered: true } });
	return png(card, cacheControl);
});

/**
 * Renders the page through the site's own router and reads its title and description,
 * or `null` when the path is not a page. The router is imported on demand because it maps
 * this controller too.
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

/** A path with no page behind it has no card. */
function missing(): Response {
	return text("Not found\n", { status: 404 });
}
