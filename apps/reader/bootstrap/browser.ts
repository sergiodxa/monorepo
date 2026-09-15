/**
 * Browser entry point. It registers a module-scoped i18next instance so any independently
 * hydrated island can translate without an `IntlProvider` above it, then runs remix/ui's
 * client runtime against the globbed resource and route modules and reports whatever fails
 * to come up.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTranslator } from "@sdxc/i18n";
import { setIntl } from "@sdxc/i18n/ui";
import { run } from "remix/ui";

const SUPPORTED_LANGUAGES = ["en", "es"] as const;

/** A language the client ships translations for, so every loader lookup below is defined. */
type Language = (typeof SUPPORTED_LANGUAGES)[number];

const DEFAULT_LANGUAGE: Language = "en";

/**
 * Dynamic imports keyed by language, one per {@link SUPPORTED_LANGUAGES} entry, so the
 * client bundle ships only the locales a page actually renders in.
 */
const LOCALE_LOADERS: Record<Language, () => Promise<{ default: Record<string, unknown> }>> = {
	en: () => import("~/app/locales/en"),
	es: () => import("~/app/locales/es"),
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
			let { default: translation } = await LOCALE_LOADERS[language]();
			return [language, { translation }] as const;
		}),
	),
);

/**
 * Interpolation escaping is off because JSX already escapes text nodes when rendering, so
 * a translated value passes through a single encoding pass.
 */
let { i18n } = await createTranslator({
	resources,
	supportedLanguages: SUPPORTED_LANGUAGES,
	fallbackLanguage: DEFAULT_LANGUAGE,
	i18next: { interpolation: { escapeValue: false } },
})(locale);

setIntl(i18n);

const CLIENT_MODULES = import.meta.glob([
	"!../**/*.server.*",
	"../resources/**/*.{ts,tsx}",
	"../routes/**/*.{ts,tsx}",
]);

let runtime = run({
	/** Resolves a hydrated island's module and named export from the URL the server wrote. */
	async loadModule(moduleUrl, exportName) {
		let pathname = new URL(moduleUrl, location.origin).pathname;

		let load = CLIENT_MODULES[`..${pathname}`];
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
	 * Fetches a frame's HTML, sending a URL-encoded body when the form declares that
	 * encoding so the server reads it under the requested type with file entries reduced to
	 * their name; the response's URL reflects any redirect for the frame to adopt.
	 *
	 * A response that is not content is refused rather than rendered: an error page written
	 * for a whole document has a head and a body of its own, and writing one into a region
	 * of a page that is otherwise fine puts a second document inside the first.
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

		let response = await fetch(src, { credentials: "same-origin", headers, signal, method, body });

		let isHtml = response.headers.get("content-type")?.toLowerCase().includes("text/html");
		if (response.status >= 500 || (response.status >= 300 && !isHtml)) {
			throw new Error(`A frame answered ${response.status}`);
		}

		return response;
	},
});

/**
 * An island that throws on its way up leaves the server's own markup standing, which is
 * the same thing a reader sees when there is no script to run at all. Saying so is what
 * tells a page that chose the plain links apart from one whose enhancement fell over.
 */
runtime.addEventListener("error", (event) => {
	console.error("A client entry failed to hydrate", event.error);
});
