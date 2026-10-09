/**
 * `GET` and `POST /examples/*path` — the destination of every link and form inside a live
 * component example. Each answers with a `303` back to the page the reader pressed it on,
 * so trying an example keeps them where they were reading.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RequestContext } from "remix/router";

import { createRedirectResponse } from "remix/response/redirect";
import { createAction } from "remix/router";

import routes from "~/routes/web";

/** Follows an example's link back to the page that holds it. */
export const exampleVisit = createAction(routes.examples.visit, (ctx) => returnToPage(ctx));

/** Accepts an example's submission and returns the reader to the page that holds it. */
export const exampleSubmit = createAction(routes.examples.submit, (ctx) => returnToPage(ctx));

/**
 * The page the request came from, when it is one of this site's own pages, and the component
 * reference otherwise, so a redirect never leaves the site or lands on another example address.
 */
function returnToPage(ctx: RequestContext): Response {
	let referer = URL.parse(ctx.request.headers.get("referer") ?? "");
	let back =
		referer && referer.origin === ctx.url.origin && !referer.pathname.startsWith("/examples/")
			? `${referer.pathname}${referer.search}${referer.hash}`
			: routes.api.show.href({ name: "ui" });
	return createRedirectResponse(back, 303);
}
