import { useTranslation } from "react-i18next";

import type { ResolvedType } from "~/types";

import { StatCard } from "~/components/stat-card";

import type { getHttpMonitorsData } from "../query.server";

export function UptimeCard(props: { httpData: ResolvedType<typeof getHttpMonitorsData> }) {
	let { t, i18n } = useTranslation("translation", { keyPrefix: "page.dashboard" });

	return (
		<StatCard
			label={t("stats.uptime.label")}
			value={props.httpData.uptime.toLocaleString(i18n.language, {
				style: "percent",
				minimumFractionDigits: 0,
				maximumFractionDigits: 0,
			})}
			description={t("stats.uptime.description")}
		/>
	);
}
