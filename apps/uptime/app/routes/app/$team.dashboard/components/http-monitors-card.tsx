import type { ResolvedType } from "@pkg/types";

import { useTranslation } from "react-i18next";

import { StatCard } from "~/components/stat-card";

import type { getHttpMonitorsData } from "../query.server";

export function HttpMonitorsCard(props: { httpData: ResolvedType<typeof getHttpMonitorsData> }) {
	let { t } = useTranslation("translation", { keyPrefix: "page.dashboard" });

	return (
		<StatCard
			label={t("stats.httpMonitors.label")}
			value={props.httpData.httpMonitorsCount}
			description={t("stats.httpMonitors.description", {
				up: props.httpData.httpMonitorsUp,
				down: props.httpData.httpMonitorsDown,
			})}
		/>
	);
}
