/**
 * `GET /u/error` — a terminal protocol failure with a correlation id, reached by
 * a `302` from every hosted screen's own `render`-class failure (an unknown or
 * expired interaction, most often). `/authorize` is the one exception: it has no
 * verified redirect target to have landed the browser on in the first place, so
 * it renders this same content inline instead of redirecting here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/router";

import { renderErrorPage } from "~/app/http/controllers/hosted/outcome";
import routes from "~/routes/tenant";

/**
 * Renders the error screen for the description its `description` query
 * parameter carries, falling back to a generic message when it carries none.
 *
 * @param ctx - The request context (provides `render`, `locale` and `i18next`).
 * @returns The rendered error page.
 * @example
 * router.map(routes.hostedError, errorShow);
 */
export const errorShow = createAction(routes.hostedError, async (ctx) => {
	let description =
		ctx.url.searchParams.get("description") ?? ctx.i18next.t("hostedError.invalidInteraction");

	return renderErrorPage(ctx, description);
});
