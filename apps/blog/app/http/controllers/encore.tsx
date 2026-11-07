/**
 * HTTP action for Encore's landing at `/apps/encore`, the Marketing URL of the app's App Store
 * listing, in the reader's language: English, Argentine Spanish or Japanese, as the app is.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/router";

import { resolveLocale } from "~/app/services/page-locale";
import { ENCORE_LOCALES } from "~/config/encore";
import { EncoreLandingView } from "~/resources/views/encore/landing";
import routes from "~/routes/web";

/**
 * Renders the landing in the language `?lang=` or `Accept-Language` picks, so the response
 * varies on that header.
 *
 * @returns The landing page in the reader's language.
 */
export default createAction(routes.encore, (ctx) => {
	let locale = resolveLocale(ctx.url, ctx.request.headers.get("Accept-Language"), ENCORE_LOCALES);
	return ctx.render(
		EncoreLandingView,
		{ locale },
		{ headers: { "Content-Language": locale, Vary: "Accept-Language" } },
	);
});
