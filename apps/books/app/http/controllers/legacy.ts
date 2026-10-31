/**
 * The URLs the site published while it sold a single book: `/release`, `/sample` and
 * `/upgrade`. Each answers with a permanent redirect to the same page under the featured
 * book's slug, so links in old newsletters and posts keep landing where they meant to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { redirect } from "@sdxc/http/response";
import { createAction } from "remix/router";

import { FEATURED_BOOK } from "~/config/books";
import routes from "~/routes/web";

/**
 * A 308 to `pathname` carrying the request's query, so campaign parameters on an old link
 * still reach the attribution middleware on the new page, and a POST stays a POST.
 */
function moved(url: URL, pathname: string): Response {
	return redirect(`${pathname}${url.search}`, { status: redirect.Status.Permanent });
}

/** `/release` — the old sales page, now the featured book's landing. */
export const release = createAction(routes.legacy.release, (ctx) =>
	moved(ctx.url, routes.book.href({ book: FEATURED_BOOK.slug })),
);

/** `/sample` — the old free-chapter page, now under the featured book. */
export const sample = createAction(routes.legacy.sample, (ctx) =>
	moved(ctx.url, routes.sample.index.href({ book: FEATURED_BOOK.slug })),
);

/** `/upgrade` — the old upgrade form, now under the featured book. */
export const upgrade = createAction(routes.legacy.upgrade, (ctx) =>
	moved(ctx.url, routes.upgrade.index.href({ book: FEATURED_BOOK.slug })),
);
