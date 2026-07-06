/**
 * Server-side internationalization toolkit: a configurable language detector
 * (search params, cookie, session, Accept-Language header, or custom logic)
 * and client-locale helpers. The Remix router middleware that pairs this with
 * a per-request i18next instance lives in `@pkg/i18n/middleware`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export type { DetectionMethod, LanguageDetectorOptions } from "./lib/language-detector";

export { getClientLocales } from "./lib/get-client-locales";
export { LanguageDetector } from "./lib/language-detector";
