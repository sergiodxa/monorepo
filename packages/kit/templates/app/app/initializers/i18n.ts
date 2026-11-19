/**
 * The app's languages and message bundles, in one place so the page middleware, a job and an
 * email reach the same copy. Add a language by adding its bundle under `resources/locales/`, typed
 * `satisfies LocaleMessages<typeof en>` so it holds English's keys, and listing it below.
 */

import { createTranslator } from "@sdxc/i18n";

import en from "~/resources/locales/en";

/** The languages a page can render in; a request asking for any other gets the fallback. */
export const SUPPORTED_LANGUAGES = ["en"];

/** The language that answers a request asking for none the app speaks, and any key a bundle lacks. */
export const FALLBACK_LANGUAGE = "en";

declare module "@sdxc/i18n" {
	/** Types every translator's keys and values by the English bundle, which every language mirrors. */
	interface I18nTypes {
		messages: typeof en;
	}
}

/** The message bundles, one per supported language, as MessageFormat 2 strings. */
export const RESOURCES = { en };

/**
 * Translates outside a request, such as in a job or an email, into the recipient's language:
 * `translate(user.language).t("home.title")`. An unsupported language binds the fallback.
 */
export const translate = createTranslator({
	resources: RESOURCES,
	supportedLanguages: SUPPORTED_LANGUAGES,
	fallbackLanguage: FALLBACK_LANGUAGE,
});
