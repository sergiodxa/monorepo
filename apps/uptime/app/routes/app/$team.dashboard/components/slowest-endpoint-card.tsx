import type { ResolvedType } from "@pkg/types";

import { Trans, useTranslation } from "react-i18next";

import { StatCard } from "~/components/stat-card";

import type { getHttpMonitorsData } from "../query.server";

export function SlowestEndpointCard(props: { httpData: ResolvedType<typeof getHttpMonitorsData> }) {
	let { t, i18n } = useTranslation("translation", { keyPrefix: "page.dashboard" });

	if (props.httpData.slowestEndpoint) {
		return (
			<StatCard
				label={
					<Trans
						t={t}
						i18nKey="stats.slowestEndpoint.label.default"
						values={{ name: props.httpData.slowestEndpoint.monitorName }}
						components={{
							em: <em className="font-medium" />,
						}}
					/>
				}
				value={
					props.httpData.slowestEndpoint.responseTimeMs
						? props.httpData.slowestEndpoint.responseTimeMs.toLocaleString(i18n.language, {
								style: "unit",
								unit: "millisecond",
								minimumFractionDigits: 0,
								maximumFractionDigits: 0,
							})
						: null
				}
				description={t("stats.slowestEndpoint.description")}
			/>
		);
	}

	return (
		<StatCard
			label={t("stats.slowestEndpoint.label.noData")}
			value={t("stats.slowestEndpoint.value.noData")}
			description={t("stats.slowestEndpoint.description")}
		/>
	);
}
