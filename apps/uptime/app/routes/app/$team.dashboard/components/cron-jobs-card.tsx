/**
 * Dashboard stat card summarizing the team's cron jobs. It reads the resolved
 * cron jobs data and renders a translated `StatCard` with the total count plus
 * a breakdown of healthy, late, and missed jobs, surfacing scheduled-task health
 * at a glance alongside the other dashboard metrics.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

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
