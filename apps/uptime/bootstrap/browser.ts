/**
 * Browser entry point that hydrates the uptime client. It registers one
 * module-scoped i18next instance via `@pkg/i18n/ui`'s `setIntl` — built with
 * `@pkg/i18n`'s `createTranslator` over the same locale dictionaries
 * `app/http/middleware/i18n.ts` initializes server-side, and bound to whatever
 * language `DocumentLayout` rendered `<html lang>` as (anything else the
 * document could carry resolves to English rather than leaving the client
 * untranslated) — so every independently hydrated island (`Avatar`, `Logo`, `CopyButton`,
 * `RunMonitorButton`, `DocsNav`) can call `intl(handle)`/`Trans` with no
 * `IntlProvider` of its own (see that package's docs for why one instance per
 * page load is safe client-side). It then globs the resources and routes
 * modules and runs the remix/ui client with a loader that dynamically imports
 * the requested client-entry module by URL and a resolver that fetches SSR
 * frame HTML. It exists as the single script the SSR document loads to bring
 * the server-rendered UI to life on the client.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTranslator } from "@pkg/i18n";
import { setIntl } from "@pkg/i18n/ui";
import { run } from "remix/ui";

import de from "~/app/locales/de";
import en from "~/app/locales/en";
import es from "~/app/locales/es";
import fr from "~/app/locales/fr";
import it from "~/app/locales/it";
import ja from "~/app/locales/ja";

const SUPPORTED_LANGUAGES = ["en", "es", "de", "ja", "fr", "it"];
const DEFAULT_LANGUAGE = "en";

let { i18n } = await createTranslator({
	resources: {
		en: { translation: en },
		es: { translation: es },
		de: { translation: de },
		ja: { translation: ja },
		fr: { translation: fr },
		it: { translation: it },
	},
	supportedLanguages: SUPPORTED_LANGUAGES,
	fallbackLanguage: DEFAULT_LANGUAGE,
	// Matches `app/http/middleware/i18n.ts`: JSX already HTML-escapes text nodes
	// when it renders, so i18next's own interpolation escaping is redundant and
	// double-encodes values.
	i18next: { interpolation: { escapeValue: false } },
})(document.documentElement.lang);

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
	async resolveFrame(src, signal, target) {
		let headers = new Headers({ accept: "text/html" });
		if (target) headers.set("x-remix-target", target);

		let response = await fetch(src, { credentials: "same-origin", headers, signal });
		return response.body ?? response.text();
	},
});
