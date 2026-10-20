/**
 * Language-resolution middleware layered over `@sdxc/i18n/middleware`. It resolves the
 * `reader:language` cookie, then `Accept-Language`, falling back to English, and
 * initializes a per-request i18next instance over the app's locale files, publishing
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import i18nMiddleware from "@sdxc/i18n/middleware";

import { LANGUAGE_COOKIE } from "~/app/initializers/cookies";
import { FALLBACK_LANGUAGE, RESOURCES, SUPPORTED_LANGUAGES } from "~/app/initializers/i18n";

/**
 * Detects the request language and publishes a translator fixed to it. A key missing from
 * Spanish resolves through English, so a reader sees copy rather than a raw key.
 */
export const i18n = i18nMiddleware({
	detection: {
		supportedLanguages: SUPPORTED_LANGUAGES,
		fallbackLanguage: FALLBACK_LANGUAGE,
		cookie: LANGUAGE_COOKIE,
		order: ["cookie", "header"],
	},
	resources: RESOURCES,
});

export default i18n;
