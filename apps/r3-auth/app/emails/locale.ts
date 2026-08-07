/**
 * Translator configuration for the send paths with no request behind them — a queue
 * message or a scheduled sweep — where `ctx.i18next` does not exist. It names the app's
 * locale bundle, the languages it ships and the language mail falls back to; building,
 * caching and resolving the translator itself is `@pkg/i18n`'s job.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTranslator } from "@pkg/i18n";

import en from "~/app/locales/en";

/**
 * Language mail is written in when nothing better is known about its reader.
 *
 * It is also the only language this server ships, and subjects carry no stored language
 * preference — the frozen `subjects` table has no column for one — so every message is
 * produced in it today. The seam exists so adding a second bundle is a registration
 * here rather than a change at each send site.
 */
export const DEFAULT_EMAIL_LOCALE = "en";

/**
 * Resolves the translator an email class is constructed with, outside a request.
 *
 * A language this app does not ship falls back to {@link DEFAULT_EMAIL_LOCALE} rather
 * than being passed through, so the returned `locale` is always the language the copy
 * was actually produced in and can be written to the document as such.
 *
 * @example let { locale, t } = await emailTranslator();
 */
export const emailTranslator = createTranslator({
	resources: { en: { translation: en } },
	supportedLanguages: [DEFAULT_EMAIL_LOCALE],
	fallbackLanguage: DEFAULT_EMAIL_LOCALE,
	// Subjects are header values and bodies render through JSX, which escapes text nodes
	// itself, so i18next's own escaping would only double-encode.
	i18next: { interpolation: { escapeValue: false } },
});
