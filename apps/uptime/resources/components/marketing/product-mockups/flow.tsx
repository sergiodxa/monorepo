/**
 * A browser flow monitor as a mockup: its pass rate and schedule, the latest run's steps
 * laid on a timeline the way its Performance trace records them, and the runs before it
 * at the shortest interval a flow can run, read from the pricing module.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Translate } from "@sdxc/i18n";
import type { Handle } from "remix/component";

import { CheckIcon, DownloadIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { vstack } from "@sdxc/u/layout";
import { bs, is } from "@sdxc/u/size";
import { text, truncate, weight } from "@sdxc/u/typography";
import { Badge } from "@sdxc/ui";

import { FLOW_INTERVALS_SECONDS } from "~/config/pricing";
import { badgeVariant } from "~/resources/components/badge";
import {
	MockupWindow,
	Muted,
	PageTitle,
	Panel,
	Rows,
} from "~/resources/components/marketing/product-mockups/parts";

/** The run's steps in order: its translation key and when it started and ended, in ms. */
const STEPS = [
	["landing.flows.diagram.signIn", 0, 1420],
	["landing.flows.diagram.token", 1420, 1610],
	["landing.flows.diagram.call", 1610, 2980],
	["landing.flows.diagram.check", 2980, 3240],
] as const;

/** The run's length, the timeline's full width. */
const RUN_MS = 3400;

/** The latest runs, newest first: minutes before the latest, duration and requests. */
const RUNS = [
	[0, "3.4 s", 9],
	[1, "3.6 s", 9],
	[2, "3.3 s", 9],
] as const;

/** Draws the flow monitor with its latest run's timeline. */
export default function FlowMockup(handle: Handle<{ t: Translate }>) {
	return () => {
		let { t } = handle.props;
		let minutes = FLOW_INTERVALS_SECONDS[0] / 60;
		return (
			<MockupWindow
				label={t("landing.mockups.flow")}
				title={t("page.flowMonitorDetail.header.breadcrumb.flowMonitors")}
				active="flows"
			>
				<PageTitle
					title="Sign in and load the dashboard"
					detail={`${t("page.flowMonitorDetail.info.interval")} ${minutes} min`}
					end={<Badge {...badgeVariant("up")}>{t("page.flowMonitors.table.status.up")}</Badge>}
				/>
				<div
					mix={[
						raw({
							display: "grid",
							gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
							gap: "0.75rem",
						}),
					]}
				>
					<Figure label={t("page.flowMonitorDetail.stats.passRate.label")} value="99.6%" />
					<Figure label={t("page.flowMonitorDetail.stats.avgDuration.label")} value="3.5 s" />
					<Figure label={t("page.flowMonitorDetail.stats.totalRuns.label")} value="2,880" />
				</div>
				<Panel title={t("page.flowMonitorDetail.source.title")} end={<Muted>3.4 s</Muted>}>
					<div mix={[vstack({ gap: 2, align: "stretch" })]}>
						{STEPS.map(([key, start, end]) => (
							<span
								key={key}
								mix={[
									raw({
										display: "grid",
										gridTemplateColumns: "1rem minmax(0, 11rem) minmax(0, 1fr)",
										alignItems: "center",
										gap: "0.5rem",
									}),
								]}
							>
								<CheckIcon size={14} strokeWidth={2} mix={[fg("success")]} />
								<span mix={[text("xs"), fg("neutral.emphasis"), truncate()]}>{t(key)}</span>
								<span mix={[raw({ position: "relative" }), bs("0.5rem")]}>
									<span
										mix={[
											raw({
												position: "absolute",
												insetBlock: "0",
												insetInlineStart: `${(start / RUN_MS) * 100}%`,
												inlineSize: `${((end - start) / RUN_MS) * 100}%`,
												borderRadius: "9999px",
												backgroundColor: "var(--ui-color-brand-500)",
											}),
										]}
									/>
								</span>
							</span>
						))}
					</div>
				</Panel>
				<Panel title={t("page.flowMonitorDetail.results.title")} flush>
					<Rows
						columns="auto auto minmax(0, 1fr) auto auto"
						head={[
							t("page.flowMonitorDetail.results.columns.time"),
							t("page.flowMonitorDetail.results.columns.status"),
							t("page.flowMonitorDetail.results.columns.requests"),
							t("page.flowMonitorDetail.results.columns.duration"),
							t("page.flowMonitorDetail.results.columns.trace"),
						]}
						rows={RUNS.map(([index, duration, requests]) => ({
							key: String(index),
							cells: [
								<Muted>{`14:${String(45 - index * minutes).padStart(2, "0")}`}</Muted>,
								<Badge {...badgeVariant("up")}>{t("page.flowMonitors.table.status.up")}</Badge>,
								<Muted>{String(requests)}</Muted>,
								<Muted>{duration}</Muted>,
								<DownloadIcon size={14} strokeWidth={1.75} mix={[fg("brand")]} />,
							],
						}))}
					/>
				</Panel>
			</MockupWindow>
		);
	};
}

/** One of the run statistics: a quiet label over its figure. */
function Figure(handle: Handle<{ label: string; value: string }>) {
	return () => (
		<span
			mix={[
				vstack({ gap: 0.5, align: "start" }),
				raw({
					minInlineSize: "0",
					padding: "0.625rem 0.75rem",
					borderRadius: "0.5rem",
					border: "1px solid var(--ui-marketing-hairline, var(--ui-neutral-border))",
				}),
			]}
		>
			<span mix={[text("xs"), fg("neutral.muted"), truncate(), is("100%")]}>
				{handle.props.label}
			</span>
			<span mix={[text("lg"), weight("semibold"), fg("neutral.emphasis")]}>
				{handle.props.value}
			</span>
		</span>
	);
}
