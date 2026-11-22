/**
 * `/demo` and everything under it — where the demos lived before they joined the showcase.
 * Each address answers `308`, which keeps the method and body, so a bookmark, an indexed
 * result or a form posted from an open tab still lands on the same demo; the query rides along.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import { createRedirectResponse } from "remix/response/redirect";
import { createAction } from "remix/router";

import defaultHandler from "~/app/http/controllers/default-handler";
import { LEGACY_LANDING_SLUGS } from "~/app/services/demos";
import routes from "~/routes/web";

/** The params a demo's old address carries; `rest` is absent on its home. */
const DEMO_PARAMS = s.object({ slug: s.string(), rest: s.optional(s.string()) });

/**
 * A permanent redirect that keeps the request's method and query string.
 *
 * @param path The new address, without a query.
 * @param url The address the request came in on.
 */
function moved(path: string, url: URL): Response {
	return createRedirectResponse(`${path}${url.search}`, 308);
}

/** Where the gallery of every demo is now: the showcase, filtered to demos. */
function demoGallery(url: URL): Response {
	let target = new URL(routes.showcase.index.href(), url);
	for (let [key, value] of url.searchParams) target.searchParams.append(key, value);
	target.searchParams.set("kind", "demo");
	return createRedirectResponse(`${target.pathname}${target.search}`, 308);
}

/** Sends the old demo gallery to the showcase's demo filter. */
export const legacyGallery = createAction(routes.legacyDemos.gallery, (ctx) =>
	demoGallery(ctx.url),
);

/** Sends the old app gallery to the showcase's demo filter. */
export const legacyApps = createAction(routes.legacyDemos.apps, (ctx) => demoGallery(ctx.url));

/** Sends every address of a demo app, its frames, streams, files and posts included, to its new one. */
export const legacyApp = createAction(routes.legacyDemos.app, (ctx) => {
	let { rest, slug } = s.parse(DEMO_PARAMS, ctx.params);
	return moved(routes.showcase.demo.href({ slug, page: rest }), ctx.url);
});

/** Sends every address of a docs demo, its Markdown twins and votes included, to its new one. */
export const legacyDocs = createAction(routes.legacyDemos.docs, (ctx) => {
	let { rest, slug } = s.parse(DEMO_PARAMS, ctx.params);
	return moved(routes.showcase.demo.href({ slug, page: rest }), ctx.url);
});

/** Sends a docs demo's old fragment address to the frame under the demo's own path. */
export const legacyDocsFrame = createAction(routes.legacyDemos.docsFrame, (ctx) => {
	let { part, slug } = s.parse(s.object({ slug: s.string(), part: s.string() }), ctx.params);
	return moved(routes.showcase.demoFrame.href({ slug, part }), ctx.url);
});

/** Sends an old clip address to the clip's new one. */
export const legacyMedia = createAction(routes.legacyDemos.media, (ctx) => {
	let { file } = s.parse(s.object({ file: s.string() }), ctx.params);
	return moved(routes.showcase.media.href({ file }), ctx.url);
});

/**
 * Sends a landing demo's generic name to the page under its product's name. A slug no landing
 * ever had answers the site's 404.
 */
export const legacyLanding = createAction(routes.legacyDemos.landing, (ctx) => {
	let { slug } = s.parse(s.object({ slug: s.string() }), ctx.params);
	let next = Object.hasOwn(LEGACY_LANDING_SLUGS, slug) ? LEGACY_LANDING_SLUGS[slug] : undefined;
	if (next === undefined) return defaultHandler(ctx);
	return moved(routes.showcase.demo.href({ slug: next }), ctx.url);
});
