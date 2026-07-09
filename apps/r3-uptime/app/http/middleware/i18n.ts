/**
 * Language-resolution middleware. Thin app-specific configuration over
 * `@pkg/i18n/middleware`: detects the request language — signed-in user's
 * `user_preferences.preferred_language` via `findLocale`, then the `language`
 * cookie, then the `Accept-Language` header, falling back to English — and
 * initializes a per-request i18next instance over the app's locale files. Exposes
 * `ctx.locale` and `ctx.i18next` (see `@pkg/i18n`). Must run after `auth`, which
 * resolves `getViewer()` for the `findLocale` lookup.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import i18next from "@pkg/i18n/middleware";
import { getServiceContainer } from "@pkg/service-container";
import { Database } from "remix/data-table";

import { language as languageCookie } from "~/app/http/cookies";
import { getViewer } from "~/app/http/middleware/auth";
import de from "~/app/locales/de";
import en from "~/app/locales/en";
import es from "~/app/locales/es";
import fr from "~/app/locales/fr";
import it from "~/app/locales/it";
import ja from "~/app/locales/ja";
import { supportedLanguages, userPreferences } from "~/database/schema";

const DEFAULT_LANGUAGE = "en";

/** Resolves the request language and initializes a per-request i18next instance. */
export const i18n = i18next({
	detection: {
		supportedLanguages: [...supportedLanguages],
		fallbackLanguage: DEFAULT_LANGUAGE,
		cookie: languageCookie,
		order: ["custom", "cookie", "header"],
		async findLocale() {
			let viewer = getViewer();
			if (!viewer) return null;

			let db = getServiceContainer().get(Database);
			let preferences = await db.findOne(userPreferences, { where: { subject_id: viewer.id } });
			return preferences?.preferred_language ?? null;
		},
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
	},
});

export default i18n;
