/**
 * Language-resolution middleware. Thin app-specific configuration over
 * `@pkg/i18n/middleware`: detects the request language from the `language` cookie,
 * then a signed-in viewer's stored `user_preferences.preferred_language`, then the
 * `Accept-Language` header, falling back to English — and initializes a per-request
 * i18next instance over the app's locale files. Exposes `ctx.locale` and
 * `ctx.i18next` (see `@pkg/i18n`).
 *
 * The rule is cookie first, database only on a miss, and the cookie re-set whenever the
 * database is what answered. `updateLanguage`
 * (`~/app/http/controllers/actions/account.ts`) keeps the cookie in sync with the stored
 * preference whenever it changes, so in the steady state the cookie alone resolves the
 * language and a request costs no query at all — which is the property this design exists
 * for. The database is consulted only for a signed-in viewer arriving without that cookie
 * (a new browser, or one that dropped it), and the `Set-Cookie` appended on the way out
 * puts the next request back on the zero-query path, so the miss is paid once rather than
 * on every request. An anonymous request never reaches the database: there is no subject to
 * look a preference up for.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import i18next from "@pkg/i18n/middleware";
import { getServiceContainer } from "@pkg/service-container";
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
 * The language the database supplied for a request, keyed by that request.
 *
 * The detector answers with a language, not with where it came from, and the cookie can only
 * be written once the response exists — so the one bit the response needs ("the database is
 * why we know this") is carried across `next()` here. Keyed by the `Request` so nothing has to
 * be cleaned up: the entry dies with the request it belongs to, and two concurrent requests
 * can never see each other's.
 */
const resolvedFromDatabase = new WeakMap<Request, string>();

/**
 * The signed-in viewer's stored language preference, or `null` when there is nothing to
 * read — which is every anonymous request, before any query is issued.
 *
 * Validated against {@link supportedLanguages} here rather than left to the detector, because
 * the detector discards an unsupported value silently and this has to know whether the
 * database really answered: a preference for a language the app no longer serves must fall
 * through to the header *and* leave the cookie alone, not re-set it to a retired value.
 */
async function findLocale(request: Request): Promise<string | null> {
	// Absent when this middleware runs without `auth` ahead of it, which is nobody signed in as
	// far as language resolution is concerned — the same answer as an anonymous request, and
	// reached without asking the session anything.
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
 * Resolves the request language and initializes a per-request i18next instance.
 *
 * Interpolation escaping is disabled: `ctx.i18next.t(...)` is always rendered
 * through JSX, which already HTML-escapes text nodes, so leaving i18next's own
 * escaping on would double-encode interpolated values.
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
		// JSX already HTML-escapes text nodes when it renders, so i18next's own
		// interpolation escaping is redundant and double-encodes values (e.g. an
		// apostrophe becomes the literal string "&#39;" instead of being decoded).
		interpolation: { escapeValue: false },
	},
});

/**
 * Detects the language, then re-seeds the `language` cookie when the database is what
 * answered.
 *
 * Only then: a language that came from the cookie is already there, and one that came from
 * `Accept-Language` is a guess about the browser rather than a choice the person made — writing
 * either would add `Set-Cookie` churn to responses that need none. Serialized exactly as
 * `updateLanguage` writes it, so the two paths produce the same cookie.
 *
 * Requires `asyncContext()` and `auth` earlier in the chain, which is what lets `findLocale`
 * read the viewer (see `bootstrap/app.tsx`).
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
