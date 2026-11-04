/**
 * `GET /og.png`: the landing's Open Graph card. The first request in a colo
 * draws it; later requests for the same revision read the colo's stored copy.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { isFailure } from "@sdxc/result";
import { createAction } from "remix/router";

import { OG_CACHE_CONTROL, serveOgImage } from "~/app/http/caching";
import { ogFonts } from "~/app/initializers/og-fonts";
import { renderOgImage } from "~/app/services/og-image";
import routes from "~/routes/web";

/** Answers `GET /og.png` with the landing card. A face that fails to parse answers 500 with `no-store`, so the next request can draw again. */
export default createAction(routes.og, async (ctx) => {
	return serveOgImage(ctx.request, async () => {
		let fonts = ogFonts();
		if (isFailure(fonts)) {
			ctx.log.fail(fonts.error);
			return new Response("The Open Graph image could not be drawn.", {
				status: 500,
				headers: {
					"content-type": "text/plain; charset=utf-8",
					"cache-control": "no-store",
				},
			});
		}
		ctx.log.note("og.draw");
		let bytes = await renderOgImage(fonts.data);
		return new Response(bytes.slice(), {
			headers: {
				"content-type": "image/png",
				"cache-control": OG_CACHE_CONTROL,
				"content-length": String(bytes.byteLength),
			},
		});
	});
});
