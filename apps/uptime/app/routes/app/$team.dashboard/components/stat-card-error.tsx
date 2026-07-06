/**
 * Fallback dashboard stat card rendered when a stat query fails. It shows a
 * translated error label, value, and description inside the shared `StatCard`
 * so a failed metric degrades gracefully in place instead of breaking the whole
 * dashboard grid layout.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

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
