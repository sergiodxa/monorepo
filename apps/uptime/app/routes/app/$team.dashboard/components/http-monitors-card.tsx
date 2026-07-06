/**
 * Dashboard stat card summarizing the team's HTTP monitors. It reads the
 * resolved HTTP monitors data and renders a translated `StatCard` showing the
 * total monitor count plus how many are currently up versus down, giving an
 * at-a-glance health figure for the team's endpoints.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

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
