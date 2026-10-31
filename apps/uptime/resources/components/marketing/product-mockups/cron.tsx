/**
 * Cron job heartbeats as a mockup: each job with its schedule, last ping and state, one
 * of them late, over a run of pings that shows when each arrived against its window.
 * It is how a job that never runs shows up before anyone notices.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Translate } from "@sdxc/i18n";
import type { Handle } from "remix/component";

import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { bs } from "@sdxc/u/size";
import { text } from "@sdxc/u/typography";
import { Badge } from "@sdxc/ui";

import type { BadgeTone } from "~/resources/components/badge";

import { badgeVariant } from "~/resources/components/badge";
import {
	DrawnButton,
	MockupWindow,
	Mono,
	Muted,
	Name,
	PageTitle,
	Panel,
	Rows,
} from "~/resources/components/marketing/product-mockups/parts";

/** Jobs: name, crontab schedule, last ping (UTC) and state key under `page.cronJobs.table.status`. */
const JOBS = [
	["Nightly backup", "0 3 * * *", "03:00", "healthy"],
	["Invoice run", "*/15 * * * *", "14:00", "healthy"],
	["Search reindex", "0 * * * *", "12:00", "late"],
	["Cache warmup", "*/5 * * * *", "14:05", "healthy"],
] as const;

/** The badge tone each state draws in. */
const STATE_TONE: Record<(typeof JOBS)[number][3], BadgeTone> = {
	healthy: "up",
	late: "degraded",
};

/**
 * The backup's last 30 nights: minutes after the 03:00 schedule each ping arrived. Pings
 * past the grace period draw as late.
 */
const PINGS = [
	2, 3, 2, 4, 2, 3, 3, 2, 5, 3, 2, 2, 3, 14, 3, 2, 3, 2, 4, 3, 2, 3, 2, 3, 6, 2, 3, 2, 3, 2,
] as const;

/** Minutes after the schedule a ping still counts as on time. */
const GRACE_MINUTES = 10;

/** Draws the cron jobs list and the backup's recent pings. */
export default function CronMockup(handle: Handle<{ t: Translate }>) {
	return () => {
		let { t } = handle.props;
		return (
			<MockupWindow
				label={t("landing.mockups.cron")}
				title={t("page.cronJobs.header.title")}
				active="cron"
			>
				<PageTitle
					title={t("page.cronJobs.header.title")}
					end={<DrawnButton>{t("page.cronJobs.header.action.create")}</DrawnButton>}
				/>
				<Panel flush>
					<Rows
						columns="minmax(0, 1fr) auto auto auto"
						head={[
							t("page.cronJobs.table.columns.name"),
							t("page.cronJobs.table.columns.schedule"),
							t("page.cronJobs.table.columns.lastPing"),
							t("page.cronJobs.table.columns.status"),
						]}
						rows={JOBS.map(([name, schedule, lastPing, state]) => ({
							key: name,
							cells: [
								<Name>{name}</Name>,
								<Mono muted>{schedule}</Mono>,
								<Muted>{lastPing}</Muted>,
								<Badge {...badgeVariant(STATE_TONE[state])}>
									{t(`page.cronJobs.table.status.${state}`)}
								</Badge>,
							],
						}))}
					/>
				</Panel>
				<Panel
					title={t("page.cronJobDetail.pings.title")}
					end={<Muted>{`${JOBS[0][0]} · ${JOBS[0][1]}`}</Muted>}
				>
					<div mix={[vstack({ gap: 2, align: "stretch" })]}>
						<span mix={[hstack({ gap: 0.5, align: "end" }), bs("3rem")]}>
							{PINGS.map((minutes, index) => (
								<span
									key={index}
									mix={[
										raw({
											flex: "1",
											blockSize: `${Math.min(100, (minutes / 15) * 100)}%`,
											minBlockSize: "15%",
											borderRadius: "1px",
											backgroundColor:
												minutes > GRACE_MINUTES
													? "var(--ui-warning-bg-solid)"
													: "var(--ui-success-bg-solid)",
										}),
									]}
								/>
							))}
						</span>
						<span
							mix={[
								hstack({ gap: 3, align: "center", justify: "between" }),
								text("xs"),
								fg("neutral.muted"),
							]}
						>
							<span mix={[hstack({ gap: 3, align: "center" })]}>
								<Swatch color="var(--ui-success-bg-solid)">
									{t("page.cronJobDetail.pings.status.onTime")}
								</Swatch>
								<Swatch color="var(--ui-warning-bg-solid)">
									{t("page.cronJobDetail.pings.status.late")}
								</Swatch>
							</span>
							<span>{t("page.cronJobDetail.stats.onTimeRate.label")} 96.7%</span>
						</span>
					</div>
				</Panel>
			</MockupWindow>
		);
	};
}

/** One legend key: a swatch in the bars' colour, then what it stands for. */
function Swatch(handle: Handle<{ color: string; children: string }>) {
	return () => (
		<span mix={[hstack({ gap: 1.5, align: "center" })]}>
			<span
				mix={[
					raw({
						inlineSize: "0.625rem",
						blockSize: "0.625rem",
						borderRadius: "0.1875rem",
						backgroundColor: handle.props.color,
					}),
				]}
			/>
			{handle.props.children}
		</span>
	);
}
