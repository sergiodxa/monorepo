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
	i18next: { resources: { en: { translation: en } }, showSupportNotice: false },
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
