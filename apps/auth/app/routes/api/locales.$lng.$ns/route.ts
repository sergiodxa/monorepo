/**
 * The i18n locale-resource API route (GET /api/locales/:lng/:ns). Its loader
 * validates the requested language and namespace against the bundled translation
 * resources, returns the matching namespace JSON, and in production attaches
 * browser/CDN cache-control headers with stale-while-revalidate and stale-if-error.
 * Exists to serve translation catalogs to the client-side i18next runtime.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { policy } from "@pkg/http/cache";
import { data } from "react-router";
import { z } from "zod";

import enTranslation from "~/locales/en";

import type { Route } from "./+types/route";

const resources = {
	en: { translation: enTranslation },
};

/**
 * Cache policy for a locale catalog: five minutes in the browser, a day in the
 * CDN, and a week of stale reuse both while revalidating and after an origin
 * error, so a translation file never fails to load because the origin is down.
 *
 * No visibility directive is emitted, because the value is already live in CDN
 * caches and adding one would change the bytes clients have stored.
 */
const LOCALE_CACHE_CONTROL = policy({
	maxAge: "5 minutes",
	sMaxAge: "1 day",
	staleWhileRevalidate: "7 days",
	staleIfError: "7 days",
}).toString();

/**
 * Serves one namespace of one language, validating both against the bundled
 * resources so an unknown language or namespace is a `400` rather than a `404`
 * the i18next client would retry. Cache headers are attached in production only,
 * keeping development reloads immediate.
 */
export async function loader({ params }: Route.LoaderArgs) {
	const lng = z
		.string()
		.refine((lng): lng is keyof typeof resources => Object.keys(resources).includes(lng))
		.safeParse(params.lng);

	if (!lng.success) return data({ error: lng.error }, { status: 400 });

	const namespaces = resources[lng.data];

	const ns = z
		.string()
		.refine((ns): ns is keyof typeof namespaces => {
			return Object.keys(resources[lng.data]).includes(ns);
		})
		.safeParse(params.ns);

	if (!ns.success) return data({ error: ns.error }, { status: 400 });

	const headers = new Headers();

	// On production, we want to add cache headers to the response
	if (process.env.NODE_ENV === "production") {
		headers.set("Cache-Control", LOCALE_CACHE_CONTROL);
	}

	return data(namespaces[ns.data], { headers });
}
