/**
 * i18next middleware for the auth app. Configures server-side language detection
 * via a signed cookie, loads the English translation resources, and exposes an
 * accessor for the per-request i18next instance while augmenting i18next's types
 * so translation keys are checked against the app's locale definitions.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { env } from "cloudflare:workers";
import { createCookie } from "react-router";
import { createI18nextMiddleware } from "remix-i18next/middleware";

import en from "~/locales/en";

import { getContext } from "./context-storage";

const cookie = createCookie("sdx:i18n", {
	path: "/",
	httpOnly: true,
	sameSite: "lax",
	secure: process.env.NODE_ENV === "production",
	secrets: [env.COOKIE_SESSION_SECRET ?? "s3cr3t"],
});

const [i18nextMiddleware, _, getInstanceFromContext] = createI18nextMiddleware({
	detection: { supportedLanguages: ["en"], fallbackLanguage: "en", cookie },
	i18next: { resources: { en: { translation: en } } },
});

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
