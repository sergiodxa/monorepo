import type { RouterContextProvider } from "react-router";

import { createI18nextMiddleware } from "remix-i18next/middleware";

import { i18n as cookie } from "~/cookies";
import en from "~/locales/en";
import { getContext } from "~/middleware/context-storage";

const [i18nextMiddleware, getLocaleFromContext, getInstanceFromContext] = createI18nextMiddleware({
	detection: { supportedLanguages: ["en"], fallbackLanguage: "en", cookie },
	i18next: {
		resources: { en: { translation: en } },
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
