/**
 * Reports as a mockup: a month of daily average response times over the uptime summary
 * the CSV export carries, one row per monitor. Column names are the export's own, so the
 * picture matches the file a team downloads.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Translate } from "@sdxc/i18n";
import type { Handle } from "remix/component";

import { bg, fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { hstack } from "@sdxc/u/layout";
import { p } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";

import {
	DrawnButton,
	MockupWindow,
	Mono,
	Muted,
	PageTitle,
	Panel,
	Rows,
} from "~/resources/components/marketing/product-mockups/parts";
import { SAMPLE_MONITORS } from "~/resources/components/marketing/product-mockups/sample-data";

/** Each monitor's month: uptime percentage and days down. */
const SUMMARY = [
	["99.98", 0],
	["100", 0],
	["99.41", 1],
	["100", 0],
] as const;

/** Thirty days of the team's average response time in milliseconds, oldest first. */
const DAILY = [
	182, 176, 190, 171, 205, 188, 179, 184, 176, 192, 181, 174, 168, 172, 186, 214, 248, 231, 196,
	184, 179, 175, 170, 168, 173, 177, 181, 169, 166, 164,
] as const;

/** The quick ranges, the selected one first. */
const PRESETS = ["last30Days", "lastMonth", "lastQuarter", "yearToDate"] as const;

/** Draws a month's report: the daily chart and the summary rows. */
export default function ReportsMockup(handle: Handle<{ t: Translate }>) {
	return () => {
		let { t } = handle.props;
		let max = Math.max(...DAILY);
		return (
			<MockupWindow
				label={t("landing.mockups.reports")}
				title={t("page.reports.header.title")}
				active="reports"
			>
				<PageTitle
					title={t("page.reports.header.title")}
					end={<DrawnButton>{t("page.reports.form.submit.summary")}</DrawnButton>}
				/>
				<span mix={[hstack({ gap: 1, align: "center" }), text("xs"), raw({ flexWrap: "wrap" })]}>
					{PRESETS.map((preset, index) => (
						<span
							key={preset}
							mix={[
								p(1, 2.5),
								raw({ borderRadius: "0.375rem" }),
								index === 0
									? [bg("neutral.bg-tint-hover"), fg("neutral.emphasis"), weight("medium")]
									: fg("neutral"),
							]}
						>
							{t(`page.reports.form.presets.${preset}`)}
						</span>
					))}
				</span>
				<Panel
					title={t("page.reports.columns.avg_response_time_ms")}
					end={<Muted>{t("page.reports.columns.date")}</Muted>}
				>
					<span mix={[hstack({ gap: 0.5, align: "end" }), raw({ blockSize: "4.5rem" })]}>
						{DAILY.map((value, index) => (
							<span
								key={index}
								mix={[
									raw({
										flex: "1",
										blockSize: `${(value / max) * 100}%`,
										borderRadius: "2px 2px 0 0",
										backgroundColor:
											value > 210 ? "var(--ui-color-brand-600)" : "var(--ui-color-brand-300)",
									}),
								]}
							/>
						))}
					</span>
				</Panel>
				<Panel flush>
					<Rows
						columns="minmax(0, 1fr) auto auto auto"
						head={[
							t("page.reports.columns.monitor"),
							t("page.reports.columns.uptime_percent"),
							t("page.reports.columns.avg_response_time_ms"),
							t("page.reports.columns.days_down"),
						]}
						rows={SAMPLE_MONITORS.map((monitor, index) => ({
							key: monitor.host,
							cells: [
								<Mono>{monitor.host}</Mono>,
								<Muted>{SUMMARY[index]?.[0] ?? "100"}</Muted>,
								<Muted>{String(monitor.averageMs)}</Muted>,
								<Muted>{String(SUMMARY[index]?.[1] ?? 0)}</Muted>,
							],
						}))}
					/>
				</Panel>
			</MockupWindow>
		);
	};
}
