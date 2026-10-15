/**
 * Remix fetch-router middleware that detects the request language and publishes a translator
 * fixed to it on the request context. Handlers translate through `context.intl` and read
 * `context.locale`, with no language state shared between concurrent requests.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Middleware } from "remix/router";

import { Session } from "remix/session";

import type { I18n, Messages } from "./lib/i18n.js";
import type { LanguageDetectorOptions } from "./lib/language-detector.js";

import { CurrentIntl, CurrentLocale, logError } from "./context.js";
import { createI18n } from "./lib/i18n.js";
import { LanguageDetector } from "./lib/language-detector.js";

export { CurrentIntl, CurrentLocale } from "./context.js";

/**
 * Declared in an imported module, not an ambient .d.ts, so the augmentation
 * applies in consuming projects that import the middleware.
 */
declare module "remix/router" {
	interface RequestContext {
		/** Language detected for the current request, always a supported language. */
		locale: string;
		/** Translator fixed to {@link locale} for the current request. */
		intl: I18n;
	}
}

/** Options that configure the i18n middleware. */
export interface I18nMiddlewareOptions {
	/** Language detection configuration; see {@link LanguageDetectorOptions}. */
	detection: LanguageDetectorOptions;
	/**
	 * MessageFormat 2 bundles keyed by language. Keys missing from the detected language resolve
	 * through `detection.fallbackLanguage`.
	 */
	resources: Readonly<Record<string, Messages>>;
}

/**
 * Creates a middleware that detects the request language and publishes `context.locale` and
 * `context.intl`, under the {@link CurrentLocale} and {@link CurrentIntl} keys the command-line
 * entry shares. Message errors become `i18n.error` warnings on the request's log.
 *
 * @param options - Middleware configuration; see {@link I18nMiddlewareOptions}.
 * @returns A middleware that populates `context.locale` and `context.intl`.
 * @example
 * let router = createRouter({ middleware: [i18n({ detection, resources: { en, es } })] });
 */
export default function i18n(options: I18nMiddlewareOptions): Middleware {
	let detector = new LanguageDetector(options.detection);

	return async (context, next) => {
		let session = context.has(Session) ? context.get(Session) : undefined;
		let locale = await detector.detect(context.request, session);

		context.set(CurrentLocale, locale, { property: "locale" });
		context.set(
			CurrentIntl,
			createI18n({
				locale,
				fallbackLanguage: options.detection.fallbackLanguage,
				resources: options.resources,
				onError: logError,
			}),
			{ property: "intl" },
		);

		return next();
	};
}
