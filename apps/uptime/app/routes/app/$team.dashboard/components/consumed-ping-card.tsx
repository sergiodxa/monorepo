import { Trans, useTranslation } from "react-i18next";

import { StatCard } from "~/components/stat-card";

export function ConsumedPingsCard(props: { consumedPings: number; estimatedPings: number }) {
	let { t, i18n } = useTranslation("translation", { keyPrefix: "page.dashboard" });

	return (
		<StatCard
			label={t("stats.monitors.label")}
			value={
				<Trans
					t={t}
					i18nKey="stats.monitors.value"
					values={{
						consumed: props.consumedPings.toLocaleString(i18n.language, {
							minimumFractionDigits: 0,
							maximumFractionDigits: 0,
						}),
					}}
					components={{
						small: <small className="text-md" />,
					}}
				/>
			}
			description={t("stats.monitors.description", {
				estimated: props.estimatedPings.toLocaleString(i18n.language, {
					minimumFractionDigits: 0,
					maximumFractionDigits: 0,
				}),
			})}
		/>
	);
}
