/**
 * Resource route that serves i18next translation bundles: its loader validates the
 * requested language and namespace params against the bundled locales (en, es, de, ja,
 * fr, it), returns the matching translations, and applies browser/CDN cache headers in
 * production. It exists to lazily deliver localized strings to the client.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { cacheHeader } from "pretty-cache-header";
import { data } from "react-router";
import { z } from "zod";

import deTranslation from "~/locales/de";
import enTranslation from "~/locales/en";
import esTranslation from "~/locales/es";
import frTranslation from "~/locales/fr";
import itTranslation from "~/locales/it";
import jaTranslation from "~/locales/ja";

import type { Route } from "./+types/locales.$lng.$ns";

const resources = {
	en: { translation: enTranslation },
	es: { translation: esTranslation },
	de: { translation: deTranslation },
	ja: { translation: jaTranslation },
	fr: { translation: frTranslation },
	it: { translation: itTranslation },
};

export async function loader({ params }: Route.LoaderArgs) {
	let lng = z
		.string()
		.refine((lng): lng is keyof typeof resources => Object.keys(resources).includes(lng))
		.safeParse(params.lng);

	if (lng.error) return data({ error: lng.error }, { status: 400 });

	let namespaces = resources[lng.data];

	let ns = z
		.string()
		.refine((ns): ns is keyof typeof namespaces => {
			return Object.keys(resources[lng.data]).includes(ns);
		})
		.safeParse(params.ns);

	if (ns.error) return data({ error: ns.error }, { status: 400 });

	let headers = new Headers();

	// On production, we want to add cache headers to the response
	if (process.env.NODE_ENV === "production") {
		headers.set(
			"Cache-Control",
			cacheHeader({
				maxAge: "5m", // Cache in the browser for 5 minutes
				sMaxage: "1d", // Cache in the CDN for 1 day
				// Serve stale content while revalidating for 7 days
				staleWhileRevalidate: "7d",
				// Serve stale content if there's an error for 7 days
				staleIfError: "7d",
			}),
		);
	}

	return data(namespaces[ns.data], { headers });
}
