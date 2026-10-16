/**
 * Serves any public page's social card at the page's address with `.png` added
 * (`/vs/pingdom.png`, `/status/acme.png`, `/index.png` for the home page). It answers before
 * routing, since page patterns would claim the `.png` path; a path naming no page continues.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { currentLog } from "@sdxc/logger";
import { env, waitUntil } from "cloudflare:workers";

import type { UptimeModels } from "~/app/models";
import type { SocialCard } from "~/app/services/social-card";

import { socialCards as cardStorage } from "~/app/models/social-cards";
import { loadStatusCard } from "~/app/services/social-card";
import {
	marketingCardContent,
	pagePathFromCardPath,
	readPageFacts,
	socialCardHash,
	socialCardKey,
} from "~/app/services/social-card";
import { loadStatusPageOverview } from "~/app/services/status-page-overview";
import { absoluteUrl } from "~/config/origin";

/**
 * A day for a marketing card. Its URL's version follows the page's title and description, and
 * a day bounds how long an edited headline under an unchanged title takes to show.
 */
const MARKETING = "public, max-age=86400";

/**
 * Five minutes for a status card: its status can change at any moment, and a new status is a
 * new card under a new URL, so a short lifetime only bounds how long the bare address lags.
 */
const STATUS = "public, max-age=300";

/** A status page's address, whose slug names the page a status card reports. */
const STATUS_PATH = /^\/status\/([^/]+)$/;

/**
 * Answers a `GET` for `<page>.png` with that page's card: from the edge cache, from storage when
 * a status card's `v` names a stored card, or drawn, stored after the response and returned. The drawing
 * code and fonts load on the first card drawn, so every other request runs without them.
 */
export default function socialCards(): Middleware {
	return async (ctx, next) => {
		let { pathname } = ctx.url;
		if (ctx.request.method !== "GET" || !pathname.endsWith(".png")) return next();
		let pagePath = pagePathFromCardPath(pathname);
		if (pagePath.endsWith(".png")) return next();

		let edge = edgeCache();
		let cached = await edge?.match(ctx.request);
		if (cached) return cached;
		let respond = (response: Response) => {
			if (edge) waitUntil(edge.put(ctx.request, response.clone()));
			return response;
		};

		let storage = cardStorage();
		let version = ctx.url.searchParams.get("v");
		let isStatus = STATUS_PATH.test(pagePath);
		if (isStatus && version && /^[0-9a-z]+$/.test(version)) {
			let stored = await storage.get(socialCardKey(version));
			if (stored) return respond(png(stored, STATUS));
		}

		let content = isStatus
			? await statusPageCard(ctx.models, STATUS_PATH.exec(pagePath)?.[1] ?? "")
			: await marketingContent(pagePath);
		if (!content) return next();

		let hash = socialCardHash(content);
		let cacheControl = isStatus ? STATUS : MARKETING;
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

/** A public status page's card by its slug, or `null` for a slug naming no public page. */
async function statusPageCard(
	models: UptimeModels,
	slug: string,
): Promise<SocialCard.StatusContent | null> {
	let page = await models.statusPages.findPublic(slug);
	if (!page) return null;
	return await loadStatusCard(models, page, await loadStatusPageOverview(models, page));
}

/**
 * A marketing or docs page's card, read from the page as the site's own router renders it to
 * an anonymous visitor, or `null` when the path is not a page that answers 200. The router is
 * imported on demand because it installs this middleware too.
 */
async function marketingContent(pagePath: string): Promise<SocialCard.MarketingContent | null> {
	let [{ createWebRouter }, { countedKv }] = await Promise.all([
		import("~/app/initializers/router"),
		import("~/app/services/cost"),
	]);
	let router = createWebRouter({
		kv: countedKv(env.KV),
		cookieSecret: env.COOKIE_SESSION_SECRET,
		secure: true,
	});
	let response = await router.fetch(
		new Request(absoluteUrl(pagePath), { headers: { accept: "text/html" } }),
	);
	if (response.status !== 200) return null;
	if (!response.headers.get("content-type")?.includes("text/html")) return null;
	let facts = readPageFacts(await response.text(), pagePath);
	return facts ? marketingCardContent(facts) : null;
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
