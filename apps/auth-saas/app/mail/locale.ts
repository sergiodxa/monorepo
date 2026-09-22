/**
 * Translator configuration for the one send path with no request behind it — the
 * daily attack-signal alert — where `ctx.i18next` does not exist. It names the
 * app's own locale bundle and the language mail falls back to; building, caching
 * and resolving the translator itself is `@sdxc/i18n`'s job.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTranslator } from "@sdxc/i18n";

import en from "~/app/locales/en";

/** Language an alert is written in; the only bundle this app ships today. */
export const DEFAULT_MAIL_LOCALE = "en";

/**
 * One instance is kept for the language, so a sweep fanning out to every tenant's
 * owners does not rebuild i18next per message.
 *
 * @example let { t } = await mailTranslator();
 */
export const mailTranslator = createTranslator({
	resources: { en: { translation: en } },
	supportedLanguages: [DEFAULT_MAIL_LOCALE],
	fallbackLanguage: DEFAULT_MAIL_LOCALE,
});
