/**
 * Translator configuration for the send paths that have no request behind them — the
 * check jobs and the queue consumer — where `ctx.i18next` does not exist. It names the
 * app's own locale bundles, the languages it ships, and the language email falls back
 * to; building, caching and resolving the translator itself is `@pkg/i18n`'s job.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTranslator } from "@pkg/i18n";

import de from "~/app/locales/de";
import en from "~/app/locales/en";
import es from "~/app/locales/es";
import fr from "~/app/locales/fr";
import it from "~/app/locales/it";
import ja from "~/app/locales/ja";
import { supportedLanguages } from "~/database/schema";

/**
 * Language an email is written in when nothing better is known about its reader.
 * Alerts are addressed to a mailbox rather than to an account, and an invite is read
 * by someone who has no stored preference yet, so this is what both fall back to.
 */
export const DEFAULT_EMAIL_LOCALE = "en";

/**
 * A language the app does not ship falls back to {@link DEFAULT_EMAIL_LOCALE}, and one
 * instance is kept per language so an alert fanning out to a team does not rebuild
 * i18next per email; escaping stays off since JSX already escapes the text it renders.
 *
 * @example let { locale, t } = await emailTranslator();
 */
export const emailTranslator = createTranslator({
	resources: {
		en: { translation: en },
		es: { translation: es },
		de: { translation: de },
		ja: { translation: ja },
		fr: { translation: fr },
		it: { translation: it },
	},
	supportedLanguages,
	fallbackLanguage: DEFAULT_EMAIL_LOCALE,
	i18next: { interpolation: { escapeValue: false } },
});
