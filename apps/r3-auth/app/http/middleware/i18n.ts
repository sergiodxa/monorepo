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

import en from "~/app/locales/en";

/** The only language this server currently serves. */
const DEFAULT_LANGUAGE = "en";

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
		supportedLanguages: [DEFAULT_LANGUAGE],
		fallbackLanguage: DEFAULT_LANGUAGE,
		cookie: languageCookie,
		order: ["cookie", "header"],
	},
	resources: { en },
});

export default i18n;
