/**
 * Browser entry point that hydrates the uptime client. It registers a
 * module-scoped i18next instance so every independently hydrated island
 * (`Avatar`, `Logo`, `CopyButton`, `RunMonitorButton`, `DocsNav`) can call
 * `intl`/`Trans` without an `IntlProvider` of its own, then runs remix/ui's
 * client runtime against the globbed resource and route modules.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTranslator } from "@pkg/i18n";
import { setIntl } from "@pkg/i18n/ui";
import { run } from "remix/ui";

const SUPPORTED_LANGUAGES = ["en", "es", "de", "ja", "fr", "it"] as const;

/** A language the client ships translations for, so every loader lookup below is defined. */
type Language = (typeof SUPPORTED_LANGUAGES)[number];

const DEFAULT_LANGUAGE: Language = "en";

/**
 * Dynamic imports keyed by language, one per {@link SUPPORTED_LANGUAGES}
 * entry, so the client bundle ships only the locale(s) a page actually
 * renders in instead of every language's translation bundle.
 */
const localeLoaders: Record<Language, () => Promise<{ default: Record<string, unknown> }>> = {
	en: () => import("~/app/locales/en"),
	es: () => import("~/app/locales/es"),
	de: () => import("~/app/locales/de"),
	ja: () => import("~/app/locales/ja"),
	fr: () => import("~/app/locales/fr"),
	it: () => import("~/app/locales/it"),
};

/** Narrows the document's `lang` to a language with a loader, falling back otherwise. */
function isSupportedLanguage(language: string): language is Language {
	return (SUPPORTED_LANGUAGES as readonly string[]).includes(language);
}

let requestedLanguage = document.documentElement.lang;
let locale = isSupportedLanguage(requestedLanguage) ? requestedLanguage : DEFAULT_LANGUAGE;

let localesToLoad = new Set([locale, DEFAULT_LANGUAGE]);

let resources = Object.fromEntries(
	await Promise.all(
		Array.from(localesToLoad, async (language) => {
			let { default: translation } = await localeLoaders[language]();
			return [language, { translation }] as const;
		}),
	),
);

/**
 * Disables i18next's interpolation escaping because JSX already escapes
 * text nodes when rendering, so values pass through a single encoding pass.
 */
let { i18n } = await createTranslator({
	resources,
	supportedLanguages: SUPPORTED_LANGUAGES,
	fallbackLanguage: DEFAULT_LANGUAGE,
	i18next: { interpolation: { escapeValue: false } },
})(locale);

setIntl(i18n);

const clientModules = import.meta.glob([
	"!../**/*.server.*",
	"../resources/**/*.{ts,tsx}",
	"../routes/**/*.{ts,tsx}",
]);

run({
	async loadModule(moduleUrl, exportName) {
		let pathname = new URL(moduleUrl, location.origin).pathname;

		let load = clientModules[`..${pathname}`];
		if (!load) throw new Error(`Unknown client entry module: ${moduleUrl}`);

		let mod = await load();

		if (!mod || typeof mod !== "object") {
			throw new Error(`Invalid client entry module: ${moduleUrl}`);
		}

		let entry = Reflect.get(mod, exportName);

		if (typeof entry !== "function") {
			throw new Error(`Missing client entry export ${exportName} in ${moduleUrl}`);
		}

		return entry;
	},
	/**
	 * Sends a URL-encoded body when the form declares that encoding, so the
	 * server reads it under the requested type with file entries reduced to
	 * their name; the response's URL reflects any redirect for the frame to adopt.
	 */
	async resolveFrame(src, options) {
		let { target, signal, method, formData, encType } = options ?? {};

		let headers = new Headers({ accept: "text/html" });
		if (target) headers.set("x-remix-target", target);

		let body =
			formData && encType === "application/x-www-form-urlencoded"
				? new URLSearchParams(
						Array.from(formData, ([key, value]) => [
							key,
							typeof value === "string" ? value : value.name,
						]),
					)
				: formData;

		return await fetch(src, { credentials: "same-origin", headers, signal, method, body });
	},
});
