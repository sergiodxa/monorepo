/**
 * Catch-all splat route that handles any unmatched URL. Its loader returns a 404
 * response and the component renders a localized "not found" page, giving the app
 * a consistent fallback for pages that do not exist.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { notFound } from "@pkg/response";
import { useTranslation } from "react-i18next";

export function loader() {
	return notFound(null);
}

export default function Component() {
	let { t } = useTranslation("translation", { keyPrefix: "page.splat" });

	return (
		<main>
			<h1>{t("notFound.title")}</h1>
			<p>{t("notFound.description")}</p>
		</main>
	);
}
