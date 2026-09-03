/**
 * Language-resolution middleware layered over `@sdxc/i18n/middleware`:
 * resolves the `language` cookie, then a signed-in viewer's stored
 * preference, then `Accept-Language`, falling back to English, and
 * initializes a per-request i18next instance over the app's locale files.
 * Exposes `ctx.locale` and `ctx.i18next`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import i18next from "@sdxc/i18n/middleware";
import { getServiceContainer } from "@sdxc/service-container";
import { Database } from "remix/data-table";
import { getContext } from "remix/middleware/async-context";
import { Auth } from "remix/middleware/auth";

import UserPreferences from "~/app/data/user-preferences";
import { language as languageCookie } from "~/app/http/cookies";
import { getViewer } from "~/app/http/middleware/auth";
import de from "~/app/locales/de";
import en from "~/app/locales/en";
import es from "~/app/locales/es";
import fr from "~/app/locales/fr";
import it from "~/app/locales/it";
import ja from "~/app/locales/ja";
import { supportedLanguages } from "~/database/schema";

const DEFAULT_LANGUAGE = "en";

/**
 * The language the database supplied for a request, keyed by that request:
 * carries the answer across `next()` since the cookie can only be written
 * once the response exists, with entries dying with their request.
 */
const resolvedFromDatabase = new WeakMap<Request, string>();

/**
 * The signed-in viewer's stored language preference, or `null` when there is
 * no session to read (anonymous, or `auth` hasn't run yet). Validated against
 * {@link supportedLanguages} since the detector discards a bad value silently.
 */
async function findLocale(request: Request): Promise<string | null> {
	if (!getContext().has(Auth)) return null;

	let viewer = getViewer();
	if (!viewer) return null;

	let db = getServiceContainer().get(Database);
	let preferences = await UserPreferences.findBySubjectId(db, viewer.id);

	let stored = preferences?.preferred_language;
	if (!stored) return null;
	if (!(supportedLanguages as readonly string[]).includes(stored)) return null;

	resolvedFromDatabase.set(request, stored);

	return stored;
}

/**
 * Resolves the request language and initializes a per-request i18next
 * instance. Interpolation escaping is disabled since `ctx.i18next.t(...)` is
 * always rendered through JSX, which already HTML-escapes text nodes.
 */
const detect = i18next({
	detection: {
		supportedLanguages: [...supportedLanguages],
		fallbackLanguage: DEFAULT_LANGUAGE,
		cookie: languageCookie,
		findLocale,
		order: ["cookie", "custom", "header"],
	},
	i18next: {
		resources: {
			en: { translation: en },
			es: { translation: es },
			de: { translation: de },
			ja: { translation: ja },
			fr: { translation: fr },
			it: { translation: it },
		},
		interpolation: { escapeValue: false },
	},
});

/**
 * Detects the language, then re-seeds the `language` cookie only when the
 * database is what answered, avoiding `Set-Cookie` churn otherwise. Requires
 * `asyncContext()` and `auth` earlier in the chain for `findLocale` to work.
 */
export const i18n: Middleware = async (context, next) => {
	let response = await detect(context, next);

	let locale = resolvedFromDatabase.get(context.request);
	if (!locale) return response;

	resolvedFromDatabase.delete(context.request);
	response.headers.append("Set-Cookie", await languageCookie.serialize(locale));

	return response;
};

export default i18n;
