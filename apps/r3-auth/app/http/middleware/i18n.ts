/**
 * Language-resolution middleware over `@sdxc/i18n/middleware`: reads the language from
 * the `sdx:i18n` cookie, then `Accept-Language`, falling back to English, and publishes
 * `ctx.locale` and `ctx.intl` for the rendered HTML pages.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import i18nMiddleware from "@sdxc/i18n/middleware";
import { createCookie } from "remix/cookie";

import { FALLBACK_LANGUAGE, RESOURCES, SUPPORTED_LANGUAGES } from "~/app/initializers/i18n";

/**
 * Cookie holding a chosen language. The name is kept as it is because browsers that
 * visited the server before this port still carry it.
 */
const languageCookie = createCookie("sdx:i18n", { path: "/", sameSite: "Lax" });

/**
 * Detects the request language and publishes a per-request translator. Values
 * interpolate raw, since every translated string renders through JSX, which escapes text.
 */
export const i18n = i18nMiddleware({
	detection: {
		supportedLanguages: SUPPORTED_LANGUAGES,
		fallbackLanguage: FALLBACK_LANGUAGE,
		cookie: languageCookie,
		order: ["cookie", "header"],
	},
	resources: RESOURCES,
});

export default i18n;
