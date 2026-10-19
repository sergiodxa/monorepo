/**
 * The app's languages and message bundles, in one place so the page middleware, the mailers
 * and the command line reach the same copy. Add a language by adding its bundle under
 * `resources/locales/` and listing it in {@link SUPPORTED_LANGUAGES}.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTranslator } from "@sdxc/i18n";
import { currentLog } from "@sdxc/logger";

import en from "~/resources/locales/en";

/** The languages a page can render in; a request asking for any other gets the fallback. */
export const SUPPORTED_LANGUAGES = ["en"];

/** The language that answers a request asking for none the app speaks, and any key a bundle lacks. */
export const FALLBACK_LANGUAGE = "en";

/** The message bundles, one per supported language, as MessageFormat 2 strings. */
export const RESOURCES = { en };

/**
 * Translates outside a request, such as in an email, into the reader's language. An
 * unsupported language binds the fallback, and a broken message is logged on the
 * invocation's log and renders as its key.
 */
export const translate = createTranslator({
	resources: RESOURCES,
	supportedLanguages: SUPPORTED_LANGUAGES,
	fallbackLanguage: FALLBACK_LANGUAGE,
	onError(error, key) {
		currentLog()?.warn("i18n.error", { key, type: error.name, message: error.message });
	},
});
