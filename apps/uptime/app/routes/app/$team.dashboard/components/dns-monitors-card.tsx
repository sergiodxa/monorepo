/**
 * Dashboard stat card summarizing the team's DNS monitors. It reads the resolved
 * DNS monitors data and renders a translated `StatCard` with the total count plus
 * a breakdown of ok, changed, and error monitors, surfacing DNS health at a
 * glance alongside the other dashboard metrics.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ResolvedType } from "@pkg/types";

import { useTranslation } from "react-i18next";

import { StatCard } from "~/components/stat-card";

import type { getDnsMonitorsData } from "../query.server";

export function DnsMonitorsCard(props: { dnsData: ResolvedType<typeof getDnsMonitorsData> }) {
	let { t } = useTranslation("translation", { keyPrefix: "page.dashboard" });

	return (
		<StatCard
			label={t("stats.dnsMonitors.label")}
			value={props.dnsData.dnsMonitorsCount}
			description={t("stats.dnsMonitors.description", {
				ok: props.dnsData.dnsMonitorsOk,
				changed: props.dnsData.dnsMonitorsChanged,
				error: props.dnsData.dnsMonitorsError,
			})}
		/>
	);
}
