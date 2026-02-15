import type { ResolvedType } from "@pkg/types";

import { useTranslation } from "react-i18next";

import { StatCard } from "~/components/stat-card";

import type { getSslMonitorsData } from "../query.server";

export function SslMonitorsCard(props: { sslData: ResolvedType<typeof getSslMonitorsData> }) {
	let { t } = useTranslation("translation", { keyPrefix: "page.dashboard" });

	return (
		<StatCard
			label={t("stats.sslMonitors.label", { defaultValue: "SSL Monitors" })}
			value={props.sslData.sslMonitorsCount}
			description={t("stats.sslMonitors.description", {
				defaultValue: `${props.sslData.sslMonitorsValid} valid, ${props.sslData.sslMonitorsExpiring} expiring, ${props.sslData.sslMonitorsExpired} expired`,
				valid: props.sslData.sslMonitorsValid,
				expiring: props.sslData.sslMonitorsExpiring,
				expired: props.sslData.sslMonitorsExpired,
			})}
		/>
	);
}
