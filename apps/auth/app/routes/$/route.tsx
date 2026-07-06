/**
 * Splat catch-all route that renders the localized 404 Not Found page for any URL
 * that matches no other route. Sets the "Not Found | Auth" title and shows a heading
 * and description pulled from the "splat" i18n namespace. Exists as the app's
 * fallback UI for unknown paths.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { useTranslation } from "react-i18next";

import type { Route } from "./+types/route";

export function meta(): Route.MetaDescriptors {
	return [{ title: "Not Found | Auth" }];
}

export default function Component() {
	let { t } = useTranslation("translation", { keyPrefix: "splat" });

	return (
		<main>
			<h1>{t("notFound.title")}</h1>
			<p>{t("notFound.description")}</p>
		</main>
	);
}
