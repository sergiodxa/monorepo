import { useTranslation } from "react-i18next";

import type { ResolvedType } from "~/types";

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
