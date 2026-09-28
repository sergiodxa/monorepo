/**
 * The board's languages and message bundles, stated once so the request middleware and the
 * background job that writes an email reach the same copy. A job runs outside a request, so
 * it builds its own translator for the language the submission was made in.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { I18n, Messages } from "@sdxc/i18n";

import { createI18n } from "@sdxc/i18n";

import en from "~/app/locales/en.json";
import es from "~/app/locales/es.json";

/** Languages the board answers in. */
export const SUPPORTED_LANGUAGES = ["en", "es"];

/** Language a request falls back to when it asks for none the board speaks. */
export const FALLBACK_LANGUAGE = "en";

/** Message bundles, one per supported language. */
export const resources: Record<string, Messages> = { en, es };

/** Builds a translator fixed to one language, for code running outside a request. */
export function translatorFor(locale: string): I18n {
	return createI18n({ locale, fallbackLanguage: FALLBACK_LANGUAGE, resources });
}
