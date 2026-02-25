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
