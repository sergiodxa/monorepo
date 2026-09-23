/**
 * Internationalization toolkit on MessageFormat 2: `createI18n` translators, a configurable
 * language detector, client-locale helpers, and a cached translator factory for code with no
 * request behind it. The router middleware lives in `@sdxc/i18n/middleware`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Messages, Translate } from "./lib/i18n.js";

export type {
	I18n,
	I18nErrorHandler,
	I18nOptions,
	MessageKey,
	Messages,
	Translate,
	TranslateParts,
} from "./lib/i18n.js";
export type { DetectionMethod, LanguageDetectorOptions } from "./lib/language-detector.js";
export type { Translation, Translator, TranslatorOptions } from "./lib/translator.js";

/**
 * A translator over untyped bundles, where any string is a key.
 *
 * @deprecated Use `Translate`, typed by a bundle (`Translate<typeof en>`) or untyped (`Translate`).
 */
export type TFunction = Translate<Messages>;

export { getClientLocales } from "./lib/get-client-locales.js";
export { createI18n } from "./lib/i18n.js";
export { LanguageDetector } from "./lib/language-detector.js";
export { createTranslator } from "./lib/translator.js";
