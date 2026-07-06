/**
 * Client hydration entry point for the auth app. Initializes i18next with the
 * browser language detector and a fetch backend that loads translations from
 * the locales API, then hydrates the server-rendered document with the React
 * Router app inside StrictMode so the page becomes interactive.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import i18next from "i18next";
import I18nextBrowserLanguageDetector from "i18next-browser-languagedetector";
import Fetch from "i18next-fetch-backend";
import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { HydratedRouter } from "react-router/dom";
import { getInitialNamespaces } from "remix-i18next/client";

async function main() {
	await i18next
		.use(initReactI18next)
		.use(Fetch)
		.use(I18nextBrowserLanguageDetector)
		.init({
			fallbackLng: "en",
			ns: getInitialNamespaces(),
			detection: { order: ["htmlTag"], caches: [] },
			backend: { loadPath: "/api/locales/{{lng}}/{{ns}}" },
		});

	startTransition(() => {
		hydrateRoot(
			document,
			<StrictMode>
				<I18nextProvider i18n={i18next}>
					<HydratedRouter />
				</I18nextProvider>
			</StrictMode>,
		);
	});
}

main().catch((error) => void console.error(error));
