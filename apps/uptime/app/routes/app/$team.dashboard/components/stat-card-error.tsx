import { useTranslation } from "react-i18next";

import { StatCard } from "~/components/stat-card";

export function StatCardError() {
	let { t } = useTranslation("translation", { keyPrefix: "page.dashboard" });

	return (
		<StatCard
			label={t("error.card.label")}
			value={t("error.card.value")}
			description={t("error.card.description")}
		/>
	);
}
