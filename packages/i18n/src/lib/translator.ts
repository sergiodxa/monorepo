/**
 * Translator factory for code that runs with no request behind it — background
 * jobs, queue consumers, scheduled work, tests — where the middleware's
 * per-request `context.i18next` does not exist. It initializes one i18next
 * instance per language over static bundles and caches it, because work that
 * fans out (one event producing many messages) would otherwise rebuild i18next
 * for every single one.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { i18n, InitOptions, Resource, TFunction } from "i18next";

import { createInstance } from "i18next";

/** Options that configure a {@link Translator}. */
export interface TranslatorOptions {
	/** Every bundle a language can be translated from, keyed the way i18next expects. */
	resources: Resource;
	/**
	 * The languages the caller ships. A language outside this list resolves to
	 * {@link fallbackLanguage} instead of being passed through, so a translator is
	 * never bound to a language there are no bundles for.
	 */
	supportedLanguages: readonly string[];
	/**
	 * The language used when none is asked for, and when the asked-for one is not
	 * supported. Also i18next's `fallbackLng`, so a key missing from another
	 * language's bundle still resolves through this one.
	 */
	fallbackLanguage: string;
	/**
	 * i18next init options for every instance the translator builds. `lng`,
	 * `supportedLngs`, `fallbackLng`, and `resources` are always taken from the
	 * options above, so the two layers cannot disagree.
	 */
	i18next?: Omit<InitOptions, "fallbackLng" | "lng" | "resources" | "supportedLngs">;
}

/** A translator together with the language it produces copy in. */
export interface Translation {
	/**
	 * The language the translator is bound to, always a supported one. Report or
	 * record this rather than the requested language: they differ whenever an
	 * unsupported language resolved to the fallback.
	 */
	locale: string;
	/** Translator already fixed to {@link locale}; no `lng` option needed per call. */
	t: TFunction;
	/**
	 * The instance {@link t} is fixed from, initialized over every supported
	 * language. Read it to translate into another language or hand a live
	 * instance to something that expects one, like `context.i18next`.
	 */
	i18n: i18n;
}

/**
 * Resolves the translation for one language, caching per resolved language.
 *
 * @param language - The language to translate into; defaults to the fallback.
 * @returns The translator and the language it is actually bound to.
 */
export interface Translator {
	(language?: string): Promise<Translation>;
}

/**
 * Creates a translator over a fixed set of bundles, for use outside a request.
 * Instances are cached by resolved language, so an unsupported language shares
 * the fallback's cached instance, and each translator keeps its cache private.
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
			pending = initTranslation(locale, options);
			translations.set(locale, pending);
		}

		return pending;
	};
}

/**
 * Builds and initializes one instance bound to `locale`. Every supported
 * language's bundle is attached, not just this language's, so the returned
 * instance can still resolve another language on demand.
 *
 * @param locale - The already-resolved language, guaranteed to be supported.
 * @param options - The translator configuration the instance is built from.
 * @returns The initialized translation for that language.
 */
async function initTranslation(locale: string, options: TranslatorOptions): Promise<Translation> {
	let instance = createInstance();

	await instance.init({
		...options.i18next,
		lng: locale,
		supportedLngs: [...options.supportedLanguages],
		fallbackLng: options.fallbackLanguage,
		resources: options.resources,
	});

	return { locale, t: instance.getFixedT(locale), i18n: instance };
}
