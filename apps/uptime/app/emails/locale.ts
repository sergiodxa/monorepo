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
 * Resolves the translator an email class is constructed with, outside a request.
 *
 * A language the app does not ship falls back to {@link DEFAULT_EMAIL_LOCALE} rather
 * than being passed through, so the returned `locale` is always the language the copy
 * was actually produced in and can be recorded as such. One instance is kept per
 * language, because an outage fans one transition out to every alert on the team at
 * once.
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
	// Subjects are header values and bodies are rendered through JSX, which escapes
	// text nodes itself, so i18next's own escaping would only double-encode.
	i18next: { interpolation: { escapeValue: false } },
});
