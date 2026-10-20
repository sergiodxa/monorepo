/**
 * Language resolution for the hosted sign-in, consent and error screens:
 * `ui_locales` from the authorization request, then `Accept-Language`, then
 * English.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import i18nMiddleware from "@sdxc/i18n/middleware";

import en from "~/resources/locales/en";

const DEFAULT_LANGUAGE = "en";

/** Every OIDC `ui_locales` candidate, space-separated and most preferred first. */
function findLocale(request: Request): Promise<string[] | null> {
	let requested = new URL(request.url).searchParams.get("ui_locales");
	if (!requested) return Promise.resolve(null);

	let candidates = requested.split(/\s+/).filter(Boolean);
	return Promise.resolve(candidates.length > 0 ? candidates : null);
}

/**
 * Detects the request's language and publishes a per-request
 * translator over the hosted screens' own bundle.
 */
export default i18nMiddleware({
	detection: {
		supportedLanguages: [DEFAULT_LANGUAGE],
		fallbackLanguage: DEFAULT_LANGUAGE,
		findLocale,
		order: ["custom", "header"],
	},
	resources: { en },
});
