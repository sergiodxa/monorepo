/**
 * `GET /demo/:slug` — a complete sample landing built only from `@sdxc/ui`'s marketing
 * parts, each with its own invented product and palette. Marked `noindex, nofollow`, since
 * the page is a specimen of the components rather than a page about sdxc.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import { withStreamCache } from "~/app/http/caching";
import defaultHandler from "~/app/http/controllers/default-handler";
import { NOINDEX_NOFOLLOW } from "~/app/initializers/seo";
import DocumentLayout from "~/resources/layouts/document";
import { findDemoLanding } from "~/resources/views/demos";
import routes from "~/routes/web";

/**
 * Reuses the landing's streamed render under the current build's cache key, which holds the
 * query, so each answer to a demo's GET form is cached on its own. A request naming one of
 * the demo's frames in `X-Remix-Target` answers that frame's content alone, cached apart.
 */
export default createAction(routes.demo, async (ctx) => {
	let { slug } = s.parse(s.object({ slug: s.string() }), ctx.params);
	let demo = await findDemoLanding(slug);
	if (demo === null) return defaultHandler(ctx);

	let url = new URL(ctx.request.url);
	let target = ctx.request.headers.get("X-Remix-Target");
	let fragment = target === null ? null : (demo.target?.(target, url) ?? null);
	if (target !== null && fragment !== null) {
		return varyByTarget(
			await withStreamCache(ctx.request, target, async () => ctx.render(fragment)),
		);
	}

	return varyByTarget(
		await withStreamCache(ctx.request, "", async () =>
			ctx.render(
				<DocumentLayout
					assets={ctx.assets}
					title={demo.title}
					description={demo.description}
					robots={NOINDEX_NOFOLLOW}
					siteFooter={false}
				>
					{demo.render(url)}
				</DocumentLayout>,
			),
		),
	);
});

/**
 * Marks an answer as varying by `X-Remix-Target`, since one address answers a whole landing
 * or one of its frames, so a browser or proxy never serves a stored fragment for a page load.
 */
function varyByTarget(response: Response): Response {
	let headers = new Headers(response.headers);
	headers.append("Vary", "X-Remix-Target");
	return new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers,
	});
}
