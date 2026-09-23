/**
 * Language-resolution middleware layered over `@sdxc/i18n/middleware`. It resolves the
 * `reader:language` cookie, then `Accept-Language`, falling back to English, and
 * initializes a per-request i18next instance over the app's locale files, publishing
 * `ctx.locale` and `ctx.intl`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import i18nMiddleware from "@sdxc/i18n/middleware";

import { LANGUAGE_COOKIE } from "~/app/http/cookies";
import en from "~/app/locales/en";
import es from "~/app/locales/es";

/** Every language the app ships a full dictionary for, and the order a detector matches in. */
const SUPPORTED_LANGUAGES = ["en", "es"];

const DEFAULT_LANGUAGE = "en";

/**
 * Detects the request language and publishes a translator fixed to it. A key missing from
 * Spanish resolves through English, so a reader sees copy rather than a raw key.
 */
export const i18n = i18nMiddleware({
	detection: {
		supportedLanguages: SUPPORTED_LANGUAGES,
		fallbackLanguage: DEFAULT_LANGUAGE,
		cookie: LANGUAGE_COOKIE,
		order: ["cookie", "header"],
	},
	resources: { en, es },
});

export default i18n;
