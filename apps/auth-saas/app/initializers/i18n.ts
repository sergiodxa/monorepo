/**
 * The translator for copy written outside a request, such as an email or a job, where
 * `ctx.intl` does not exist. It reads the same bundle the hosted screens do, so an email
 * and the page that sent it speak the same language.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createTranslator } from "@sdxc/i18n";
import { currentLog } from "@sdxc/logger";

import en from "~/resources/locales/en";

/** The language a reader asking for none the app speaks receives; the only bundle shipped today. */
export const FALLBACK_LANGUAGE = "en";

/**
 * Binds a reader's language to its translator: `translate(locale).t("mail.footer", …)`. One
 * instance is kept per language, so a sweep mailing every tenant's owners builds it once; a
 * broken message is logged on the invocation's log and renders as its key.
 */
export const translate = createTranslator({
	resources: { en },
	supportedLanguages: [FALLBACK_LANGUAGE],
	fallbackLanguage: FALLBACK_LANGUAGE,
	onError(error, key) {
		currentLog()?.warn("i18n.error", { key, type: error.name, message: error.message });
	},
});
