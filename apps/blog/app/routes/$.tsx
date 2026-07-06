/**
 * Catch-all (splat) route for the blog. Renders a minimal 404 page whose heading
 * comes from the `notFound.title` translation key, matching any URL not handled by
 * a more specific route. It exists to give unmatched paths a localized not-found
 * response instead of an unstyled framework default.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { useTranslation } from "react-i18next";

export default function Component() {
	let { t } = useTranslation();

	return (
		<main>
			<h1>{t("notFound.title")}</h1>
		</main>
	);
}
