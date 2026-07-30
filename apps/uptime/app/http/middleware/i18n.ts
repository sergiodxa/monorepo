/**
 * Language-resolution middleware. Thin app-specific configuration over
 * `@pkg/i18n/middleware`: detects the request language from the `language` cookie,
 * then the `Accept-Language` header, falling back to English — and initializes a
 * per-request i18next instance over the app's locale files. Exposes `ctx.locale`
 * and `ctx.i18next` (see `@pkg/i18n`). A signed-in viewer's stored
 * `user_preferences.preferred_language` is never queried here: `updateLanguage`
 * (`~/app/http/controllers/actions/account.ts`) keeps the `language` cookie in
 * sync with that preference whenever it changes, so the cookie alone is enough —
 * avoiding a database round trip on every single request.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import i18next from "@pkg/i18n/middleware";

import { language as languageCookie } from "~/app/http/cookies";
import de from "~/app/locales/de";
import en from "~/app/locales/en";
import es from "~/app/locales/es";
import fr from "~/app/locales/fr";
import it from "~/app/locales/it";
import ja from "~/app/locales/ja";
import { supportedLanguages } from "~/database/schema";

const DEFAULT_LANGUAGE = "en";

/**
 * Resolves the request language and initializes a per-request i18next instance.
 *
 * Interpolation escaping is disabled: `ctx.i18next.t(...)` is always rendered
 * through JSX, which already HTML-escapes text nodes, so leaving i18next's own
 * escaping on would double-encode interpolated values.
 */
export const i18n = i18next({
	detection: {
		supportedLanguages: [...supportedLanguages],
		fallbackLanguage: DEFAULT_LANGUAGE,
		cookie: languageCookie,
		order: ["cookie", "header"],
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

export default i18n;
