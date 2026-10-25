/**
 * Language-resolution middleware layered over `@sdxc/i18n/middleware`: resolves
 * the `language` cookie, then a signed-in viewer's stored preference, then
 * `Accept-Language`, falling back to English, and binds a per-request translator
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import i18nMiddleware from "@sdxc/i18n/middleware";
import { getContext } from "remix/middleware/async-context";
import { Auth } from "remix/middleware/auth";

import { getViewer } from "~/app/http/middleware/auth";
import { language as languageCookie } from "~/app/initializers/cookies";
import { FALLBACK_LANGUAGE, RESOURCES, SUPPORTED_LANGUAGES } from "~/app/initializers/i18n";

/**
 * The language the database supplied for a request, keyed by that request:
 * carries the answer across `next()` since the cookie can only be written
 * once the response exists, with entries dying with their request.
 */
const RESOLVED_FROM_DATABASE = new WeakMap<Request, string>();

/**
 * The signed-in viewer's stored language preference, or `null` when there is
 * no session to read (anonymous, or `auth` hasn't run yet). Validated against
 * {@link SUPPORTED_LANGUAGES} since the detector discards a bad value silently.
 */
async function findLocale(request: Request): Promise<string | null> {
	let ctx = getContext();
	if (!ctx.has(Auth)) return null;

	let viewer = getViewer();
	if (!viewer) return null;

	let preferences = await ctx.models.userPreferences.findBy({ subject_id: viewer.id });

	let stored = preferences?.preferred_language;
	if (!stored) return null;
	if (!SUPPORTED_LANGUAGES.includes(stored)) return null;

	RESOLVED_FROM_DATABASE.set(request, stored);

	return stored;
}

/**
 * Resolves the request language and binds a per-request translator; values
 * interpolate raw since `ctx.intl.t(...)` is always rendered through JSX,
 * which HTML-escapes text nodes.
 */
const detect = i18nMiddleware({
	detection: {
		supportedLanguages: SUPPORTED_LANGUAGES,
		fallbackLanguage: FALLBACK_LANGUAGE,
		cookie: languageCookie,
		findLocale,
		order: ["cookie", "custom", "header"],
	},
	resources: RESOURCES,
});

/**
 * Detects the language, then re-seeds the `language` cookie only when the
 * database is what answered, avoiding `Set-Cookie` churn otherwise. Requires
 * `asyncContext()` and `auth` earlier in the chain for `findLocale` to work.
 */
export const i18n: Middleware = async (context, next) => {
	let response = await detect(context, next);

	let locale = RESOLVED_FROM_DATABASE.get(context.request);
	if (!locale) return response;

	RESOLVED_FROM_DATABASE.delete(context.request);
	response.headers.append("Set-Cookie", await languageCookie.serialize(locale));

	return response;
};

export default i18n;
