/**
 * HTTP action for Wakaba's landing at `/apps/wakaba`, the Marketing URL of the app's App Store
 * listing, in the reader's language.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createAction } from "remix/router";

import { resolvePageLocale } from "~/app/services/page-locale";
import { WakabaLandingView } from "~/resources/views/wakaba/landing";
import routes from "~/routes/web";

/**
 * Renders the landing in English or Spanish, from `?lang=` or `Accept-Language`, so the
 * response varies on that header. The App Store call reads the listing from
 * `config/wakaba.ts`, showing "coming soon" before release and the download link after.
 *
 * @returns The landing page in the reader's language.
 */
export default createAction(routes.wakaba, (ctx) => {
	let locale = resolvePageLocale(ctx.url, ctx.request.headers.get("Accept-Language"));
	return ctx.render(
		WakabaLandingView,
		{ locale },
		{ headers: { "Content-Language": locale, Vary: "Accept-Language" } },
	);
});
