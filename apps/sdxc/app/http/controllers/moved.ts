/**
 * `GET /docs/packages` and everything under it — the package reference's old address.
 * Each path answers with a permanent redirect to the same path under `/api`, so a
 * bookmark, an indexed result or a README link written before the move reaches its page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import { createRedirectResponse } from "remix/response/redirect";
import { createAction } from "remix/router";

import routes from "~/routes/web";

/** Sends the old index to the new one. */
export const movedPackages = createAction(routes.moved.packages, () => {
	return createRedirectResponse(routes.api.index.href(), 301);
});

/**
 * Sends any path under the old index to the same path under `/api`, the `.md` twins and
 * the catalogue pages included. The query string rides along, so a filtered link keeps
 * its filter.
 */
export const movedPackage = createAction(routes.moved.package, (ctx) => {
	let { path } = s.parse(s.object({ path: s.string() }), ctx.params);
	return createRedirectResponse(`${routes.api.index.href()}/${path}${ctx.url.search}`, 301);
});
