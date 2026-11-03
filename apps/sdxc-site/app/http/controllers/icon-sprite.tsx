/**
 * `GET /api/icons/sprite.svg` — every icon as a `<symbol>`, the one file the gallery's tiles
 * reference. Asked for as `?v=<Lucide version>`, it is cached for good by browsers and by the
 * colo's Workers cache, so it is drawn once per release of the icons in each location.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { LUCIDE_VERSION } from "@sdxc/icons";
import { waitUntil } from "cloudflare:workers";
import { renderToString } from "remix/component/server";
import { createAction } from "remix/router";

import { edgeCache } from "~/app/http/caching";
import IconSprite from "~/resources/components/icon-sprite";
import routes from "~/routes/web";

/** A year, for the sprite of the version this build ships, whose content never changes. */
const IMMUTABLE = "public, max-age=31536000, immutable";

/**
 * An hour, for a sprite asked for under any other version, such as a page cached before an
 * upgrade: it receives today's icons, under a policy short enough that its old address is
 * never held to them.
 */
const REVALIDATE = "public, max-age=3600";

/**
 * Answers with the sprite. Only the current version is stored at the edge and marked
 * immutable; any other `v`, or none, is drawn fresh on the short policy.
 */
export default createAction(routes.api.iconSprite, async (ctx) => {
	let current = ctx.url.searchParams.get("v") === LUCIDE_VERSION;
	let edge = current ? edgeCache() : null;

	let cached = await edge?.match(ctx.url.href);
	if (cached) return cached;

	let response = new Response(await renderToString(<IconSprite />), {
		headers: {
			"Content-Type": "image/svg+xml; charset=utf-8",
			"Cache-Control": current ? IMMUTABLE : REVALIDATE,
		},
	});
	if (edge) waitUntil(edge.put(ctx.url.href, response.clone()));
	return response;
});
