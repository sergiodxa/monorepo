import type { ResolvedType } from "@pkg/types";

import { useTranslation } from "react-i18next";

import { StatCard } from "~/components/stat-card";

import type { getCronJobsData } from "../query.server";

export function CronJobsCard(props: { cronData: ResolvedType<typeof getCronJobsData> }) {
	let { t } = useTranslation("translation", { keyPrefix: "page.dashboard" });

	return (
		<StatCard
			label={t("stats.cronJobs.label")}
			value={props.cronData.cronJobsCount}
			description={t("stats.cronJobs.description", {
				healthy: props.cronData.cronJobsHealthy,
				late: props.cronData.cronJobsLate,
				missed: props.cronData.cronJobsMissed,
			})}
		/>
	);
}
