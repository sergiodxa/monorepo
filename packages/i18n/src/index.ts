/**
 * Server-side internationalization toolkit: a configurable language detector
 * (search params, cookie, session, Accept-Language header, or custom logic),
 * client-locale helpers, and a cached translator factory for code with no
 * request behind it. The Remix router middleware that pairs detection with a
 * per-request i18next instance lives in `@pkg/i18n/middleware`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

// Re-exported so consumers type a translator or an instance without depending on
// i18next themselves; translation is this package's contract, not theirs.
export type { i18n, TFunction } from "i18next";

export type { DetectionMethod, LanguageDetectorOptions } from "./lib/language-detector";
export type { Translation, Translator, TranslatorOptions } from "./lib/translator";

export { getClientLocales } from "./lib/get-client-locales";
export { LanguageDetector } from "./lib/language-detector";
export { createTranslator } from "./lib/translator";
