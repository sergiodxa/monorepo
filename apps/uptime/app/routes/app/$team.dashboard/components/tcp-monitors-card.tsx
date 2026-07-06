/**
 * Dashboard stat card summarizing the team's TCP monitors. It reads the resolved
 * TCP monitors data and renders a translated `StatCard` with the total count plus
 * how many are currently up versus down, giving an at-a-glance health figure for
 * the team's TCP endpoints alongside the other dashboard metrics.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

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
