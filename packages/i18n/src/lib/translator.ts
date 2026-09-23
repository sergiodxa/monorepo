/**
 * Translator factory for code that runs with no request behind it — background jobs, queue
 * consumers, scheduled work, browser bootstraps, tests — where the middleware's per-request
 * `context.intl` does not exist. It resolves one translator per supported language and caches it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { I18n, I18nErrorHandler, Messages, Translate } from "./i18n.js";

import { createI18n } from "./i18n.js";

/** Options that configure a {@link Translator}. */
export interface TranslatorOptions {
	/** MessageFormat 2 bundles keyed by language. */
	resources: Readonly<Record<string, Messages>>;
	/**
	 * The languages the caller ships. A language outside this list resolves to
	 * {@link fallbackLanguage}, so a translator is always bound to a language with bundles.
	 */
	supportedLanguages: readonly string[];
	/**
	 * The language used when none is asked for or the asked-for one is unsupported, and the
	 * one every key missing from another language's bundle resolves through.
	 */
	fallbackLanguage: string;
	/** Receives syntax and formatting errors; without it errors are discarded. */
	onError?: I18nErrorHandler;
}

/** A translator together with the language it produces copy in. */
export interface Translation {
	/**
	 * The language the translator is bound to, always a supported one. Report or record this
	 * rather than the requested language: they differ whenever an unsupported one resolved to
	 * the fallback.
	 */
	locale: string;
	t: Translate;
	/** The translator {@link t} belongs to, for anything that expects one, like `IntlProvider`. */
	intl: I18n;
}

/**
 * Resolves the translation for one language, caching per resolved language. It returns a
 * `Promise` so call sites keep their shape; the work inside is synchronous.
 *
 * @param language - The language to translate into; defaults to the fallback.
 * @returns The translator and the language it is actually bound to.
 */
export interface Translator {
	(language?: string): Promise<Translation>;
}

/**
 * Creates a translator over a fixed set of bundles, for use outside a request. Translations
 * are cached by resolved language, so an unsupported language shares the fallback's, and each
 * translator keeps its cache private.
 *
 * @param options - Bundles, supported languages, and fallback; see {@link TranslatorOptions}.
 * @returns A translator that resolves one {@link Translation} per language.
 * @example let { locale, t } = await createTranslator({ resources, supportedLanguages, fallbackLanguage: "en" })("es");
 */
export function createTranslator(options: TranslatorOptions): Translator {
	let translations = new Map<string, Promise<Translation>>();

	return function translate(language = options.fallbackLanguage) {
		let locale = options.supportedLanguages.includes(language)
			? language
			: options.fallbackLanguage;

		let pending = translations.get(locale);

		if (!pending) {
			let intl = createI18n({
				locale,
				fallbackLanguage: options.fallbackLanguage,
				resources: options.resources,
				onError: options.onError,
			});
			pending = Promise.resolve({ locale, t: intl.t, intl });
			translations.set(locale, pending);
		}

		return pending;
	};
}
