/**
 * Language-resolution middleware layered over `@sdxc/i18n/middleware`. It resolves the
 * `reader:language` cookie, then `Accept-Language`, falling back to English, and
 * initializes a per-request i18next instance over the app's locale files, publishing
 * `ctx.locale` and `ctx.i18next`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import i18next from "@sdxc/i18n/middleware";

import { LANGUAGE_COOKIE } from "~/app/http/cookies";
import en from "~/app/locales/en";
import es from "~/app/locales/es";

/** Every language the app ships a full dictionary for, and the order a detector matches in. */
const SUPPORTED_LANGUAGES = ["en", "es"];

const DEFAULT_LANGUAGE = "en";

/**
 * Detects the request language and initializes a per-request i18next instance.
 * Interpolation escaping is off because `ctx.i18next.t(...)` is always rendered through
 * JSX, which already escapes text nodes, so a value passes through a single encoding pass.
 */
export const i18n = i18next({
	detection: {
		supportedLanguages: SUPPORTED_LANGUAGES,
		fallbackLanguage: DEFAULT_LANGUAGE,
		cookie: LANGUAGE_COOKIE,
		order: ["cookie", "header"],
	},
	i18next: {
		resources: {
			en: { translation: en },
			es: { translation: es },
		},
		interpolation: { escapeValue: false },
	},
});

export default i18n;
