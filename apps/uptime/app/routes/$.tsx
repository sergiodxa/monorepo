import { useTranslation } from "react-i18next";

export default function Component() {
	let { t } = useTranslation("translation", { keyPrefix: "page.splat" });

	return (
		<main>
			<h1>{t("notFound.title")}</h1>
			<p>{t("notFound.description")}</p>
		</main>
	);
}
