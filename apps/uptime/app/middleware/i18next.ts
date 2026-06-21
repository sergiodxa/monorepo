import type { RouterContextProvider } from "react-router";

import { createI18nextMiddleware } from "remix-i18next/middleware";

import { i18n as cookie } from "~/cookies";
import de from "~/locales/de";
import en from "~/locales/en";
import es from "~/locales/es";
import fr from "~/locales/fr";
import it from "~/locales/it";
import ja from "~/locales/ja";
import { getContext } from "~/middleware/context-storage";

export const supportedLanguages = ["en", "es", "de", "ja", "fr", "it"] as const;
export type SupportedLanguage = (typeof supportedLanguages)[number];

export const languageNames: Record<SupportedLanguage, string> = {
	en: "English",
	es: "Español",
	de: "Deutsch",
	ja: "日本語",
	fr: "Français",
	it: "Italiano",
};

const [i18nextMiddleware, getLocaleFromContext, getInstanceFromContext] = createI18nextMiddleware({
	detection: {
		supportedLanguages: [...supportedLanguages],
		fallbackLanguage: "en",
		cookie,
		// Order of detection: cookie first (set from user preference), then Accept-Language header
		order: ["cookie", "header"],
	},
	i18next: {
		resources: {
			en: { translation: en },
			es: { translation: es },
			de: { translation: de },
			ja: { translation: ja },
			fr: { translation: fr },
			it: { translation: it },
		},
		interpolation: { escapeValue: false },
	},
});

export function locale() {
	return getLocaleFromContext(getContext());
}

export function i18next(context: Readonly<RouterContextProvider>) {
	return getInstanceFromContext(context);
}

export { i18nextMiddleware };

declare module "i18next" {
	interface CustomTypeOptions {
		resources: {
			translation: typeof en;
		};
	}
}
