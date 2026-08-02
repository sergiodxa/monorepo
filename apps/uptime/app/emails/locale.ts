/**
 * Translator factory for the send paths that have no request behind them — the
 * check jobs and the queue consumer — where `ctx.i18next` does not exist. It builds
 * one i18next instance per language over the app's own locale bundles and caches it,
 * because an outage fans one transition out to every alert on the team at once.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TFunction } from "i18next";

import { createInstance } from "i18next";

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

/** Every bundle an email can be produced from, keyed the way i18next expects. */
const RESOURCES = {
	en: { translation: en },
	es: { translation: es },
	de: { translation: de },
	ja: { translation: ja },
	fr: { translation: fr },
	it: { translation: it },
};

/**
 * One in-flight or settled translator per language. Keyed by language rather than
 * per call because the bundles are static, so a second instance would only repeat
 * the same initialization.
 */
const TRANSLATORS = new Map<string, Promise<TFunction>>();

/** A translator together with the language it produces copy in. */
export interface EmailTranslation {
	/** Language the translator is bound to, always one the app ships. */
	locale: string;
	/** Translator to hand to an email class, already fixed to {@link locale}. */
	t: TFunction;
}

/** Builds and initializes an i18next instance restricted to one language. */
async function createTranslator(locale: string): Promise<TFunction> {
	let instance = createInstance();

	await instance.init({
		lng: locale,
		supportedLngs: [...supportedLanguages],
		fallbackLng: DEFAULT_EMAIL_LOCALE,
		resources: RESOURCES,
		// Subjects are header values and bodies are rendered through JSX, which escapes
		// text nodes itself, so i18next's own escaping would only double-encode.
		interpolation: { escapeValue: false },
	});

	return instance.getFixedT(locale);
}

/**
 * Resolves the translator an email class is constructed with, outside a request.
 *
 * A language the app does not ship falls back to {@link DEFAULT_EMAIL_LOCALE} rather
 * than being passed through, so the returned `locale` is always the language the copy
 * was actually produced in and can be recorded as such.
 *
 * @param locale - Language the recipient reads, when one is known.
 * @returns The translator and the language it is bound to.
 * @example let { locale, t } = await emailTranslator();
 */
export async function emailTranslator(
	locale: string = DEFAULT_EMAIL_LOCALE,
): Promise<EmailTranslation> {
	let resolved = supportedLanguages.some((language) => language === locale)
		? locale
		: DEFAULT_EMAIL_LOCALE;

	let pending = TRANSLATORS.get(resolved);
	if (!pending) {
		pending = createTranslator(resolved);
		TRANSLATORS.set(resolved, pending);
	}

	return { locale: resolved, t: await pending };
}
