/**
 * Language-resolution middleware. Thin configuration over `@pkg/i18n/middleware`:
 * reads the language from the `sdx:i18n` cookie, then `Accept-Language`, falling back
 * to English, and publishes `ctx.locale` and `ctx.i18next` for the rendered pages.
 *
 * Only the HTML surface needs it. The OAuth, API and discovery endpoints answer with
 * machine-read JSON that is never translated.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import i18next from "@pkg/i18n/middleware";
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
 * Detects the request language and initializes a per-request i18next instance.
 *
 * Interpolation escaping is off because every translated string is rendered through
 * JSX, which escapes text nodes already; leaving it on would double-encode.
 */
export const i18n = i18next({
	detection: {
		supportedLanguages: [DEFAULT_LANGUAGE],
		fallbackLanguage: DEFAULT_LANGUAGE,
		cookie: languageCookie,
		order: ["cookie", "header"],
	},
	i18next: {
		resources: { en: { translation: en } },
		interpolation: { escapeValue: false },
	},
});

export default i18n;
