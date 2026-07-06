/**
 * Internationalization middleware for the blog app. Configures remix-i18next with
 * the English and Spanish resource bundles, a signed locale cookie, and language
 * detection, then exposes getLocale and getI18nextInstance accessors and
 * augments i18next's types with the app's translation shape. This drives all
 * server-side localization for the site.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { env } from "cloudflare:workers";
import { createCookie } from "react-router";
import { createI18nextMiddleware } from "remix-i18next/middleware";

import en from "~/locales/en";
import es from "~/locales/es";

import { getContext } from "./context-storage";

export const cookie = createCookie("sdx:i18n", {
	path: "/",
	httpOnly: true,
	sameSite: "lax",
	secure: process.env.NODE_ENV === "production",
	secrets: [env.COOKIE_SESSION_SECRET ?? "s3cr3t"],
});

const [i18nextMiddleware, getLocaleFromContext, getInstanceFromContext] = createI18nextMiddleware({
	detection: {
		supportedLanguages: ["es", "en"],
		fallbackLanguage: "en",
		cookie,
	},
	i18next: {
		resources: {
			en: { translation: en },
			es: { translation: es },
		},
	},
});

export function getLocale() {
	return getLocaleFromContext(getContext());
}

export function getI18nextInstance() {
	return getInstanceFromContext(getContext());
}

export { i18nextMiddleware };

declare module "i18next" {
	interface CustomTypeOptions {
		resources: {
			translation: typeof en;
		};
	}
}
