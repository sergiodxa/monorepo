/**
 * Language resolution for the hosted sign-in, consent and error screens:
 * `ui_locales` from the authorization request, then `Accept-Language`, then
 * English. There is no tenant-level default and no stored subject preference to
 * read yet, so those steps the ADR's own order names are skipped until something
 * writes either.
 *
 * `ui_locales` only ever arrives as an `/authorize` query parameter, so each hosted
 * screen's own GET carries it forward as a query parameter on the next link or form
 * action rather than a hidden field, keeping it visible to this detector on every
 * request in the flow, GET or POST.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import i18next from "@sdxc/i18n/middleware";

import en from "~/app/locales/en";

const DEFAULT_LANGUAGE = "en";

/** Every OIDC `ui_locales` candidate, space-separated and most preferred first. */
function findLocale(request: Request): Promise<string[] | null> {
	let requested = new URL(request.url).searchParams.get("ui_locales");
	if (!requested) return Promise.resolve(null);

	let candidates = requested.split(/\s+/).filter(Boolean);
	return Promise.resolve(candidates.length > 0 ? candidates : null);
}

/**
 * Detects the request's language and initializes a per-request i18next instance
 * over the hosted screens' own bundle.
 */
export default i18next({
	detection: {
		supportedLanguages: [DEFAULT_LANGUAGE],
		fallbackLanguage: DEFAULT_LANGUAGE,
		findLocale,
		order: ["custom", "header"],
	},
	i18next: {
		resources: { en: { translation: en } },
	},
});
