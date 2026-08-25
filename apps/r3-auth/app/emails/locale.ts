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
 * Language mail is written in, and today the only one this server ships: the frozen
 * `subjects` table stores an address alone, so every message is produced in it. Adding a
 * second bundle stays a registration here, leaving every send site as it is.
 */
export const DEFAULT_EMAIL_LOCALE = "en";

/**
 * Resolves the translator an email class is constructed with, outside a request. An
 * unsupported language resolves to {@link DEFAULT_EMAIL_LOCALE}, so `locale` names the
 * language the copy was produced in; JSX escapes text nodes, so interpolation stays raw.
 *
 * @example let { locale, t } = await emailTranslator();
 */
export const emailTranslator = createTranslator({
	resources: { en: { translation: en } },
	supportedLanguages: [DEFAULT_EMAIL_LOCALE],
	fallbackLanguage: DEFAULT_EMAIL_LOCALE,
	i18next: { interpolation: { escapeValue: false } },
});
