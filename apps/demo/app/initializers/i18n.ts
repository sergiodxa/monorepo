/**
 * The board's languages and message bundles, stated once so the request middleware and the
 * background job that writes an email reach the same copy. A job runs outside a request, so
 * it builds its own translator for the language the submission was made in.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTranslator } from "@sdxc/i18n";

import en from "~/resources/locales/en";
import es from "~/resources/locales/es";

/** Languages the board answers in. */
export const SUPPORTED_LANGUAGES = ["en", "es"];

/** Language a request falls back to when it asks for none the board speaks. */
export const FALLBACK_LANGUAGE = "en";

declare module "@sdxc/i18n" {
	/** Types every translator's keys and values by the English bundle, which Spanish mirrors. */
	interface I18nTypes {
		messages: typeof en;
	}
}

/** Message bundles, one per supported language. */
export const RESOURCES = { en, es };

/**
 * Translates outside a request, such as in an email, into the reader's language; an
 * unsupported language binds the fallback.
 */
export const translate = createTranslator({
	resources: RESOURCES,
	supportedLanguages: SUPPORTED_LANGUAGES,
	fallbackLanguage: FALLBACK_LANGUAGE,
});
