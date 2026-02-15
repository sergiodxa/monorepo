import type { ResolvedType } from "@pkg/types";

import { useTranslation } from "react-i18next";

import { StatCard } from "~/components/stat-card";

import type { getTcpMonitorsData } from "../query.server";

export function TcpMonitorsCard(props: { tcpData: ResolvedType<typeof getTcpMonitorsData> }) {
	let { t } = useTranslation("translation", { keyPrefix: "page.dashboard" });

	return (
		<StatCard
			label={t("stats.tcpMonitors.label")}
			value={props.tcpData.tcpMonitorsCount}
			description={t("stats.tcpMonitors.description", {
				up: props.tcpData.tcpMonitorsUp,
				down: props.tcpData.tcpMonitorsDown,
			})}
		/>
	);
}
