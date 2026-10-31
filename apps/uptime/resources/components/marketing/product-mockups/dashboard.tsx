/**
 * The monitors dashboard as a mockup: the team's uptime and monitor count over the HTTP
 * monitors table, each row with its latency trend and status. Labels come from the
 * dashboard's own translations, so the picture reads like the page it shows.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Translate } from "@sdxc/i18n";
import type { Handle } from "remix/component";

import { raw } from "@sdxc/u/general";
import { hstack } from "@sdxc/u/layout";
import { when } from "@sdxc/u/state";
import { Badge } from "@sdxc/ui";

import type { BadgeTone } from "~/resources/components/badge";

import { badgeVariant } from "~/resources/components/badge";
import {
	DrawnButton,
	MockupWindow,
	Mono,
	Muted,
	PageTitle,
	Panel,
	Rows,
} from "~/resources/components/marketing/product-mockups/parts";
import {
	SAMPLE_MONITORS,
	sparklinePoints,
} from "~/resources/components/marketing/product-mockups/sample-data";
import StatCard from "~/resources/components/stat-card";
import Sparkline from "~/resources/views/monitors/sparkline";

/** The dashboard table's status label for each badge tone. */
const STATUS_KEY: Record<Exclude<BadgeTone, "neutral">, string> = {
	up: "page.dashboard.table.status.up",
	degraded: "page.dashboard.table.status.degraded",
	down: "page.dashboard.table.status.down",
};

/** Draws the dashboard with the example monitors. */
export default function DashboardMockup(handle: Handle<{ t: Translate }>) {
	return () => {
		let { t } = handle.props;
		return (
			<MockupWindow
				label={t("landing.mockups.dashboard")}
				title={t("page.dashboard.header.title")}
				active="dashboard"
			>
				<PageTitle
					title={t("page.dashboard.header.title")}
					end={<DrawnButton>{t("page.dashboard.empty.cta")}</DrawnButton>}
				/>
				<div mix={[hstack({ gap: 3, align: "stretch" })]}>
					<StatCard label={t("page.dashboard.stats.uptime.label")} value="99.97%" />
					<StatCard label={t("page.dashboard.stats.httpMonitors.label")} value="12" />
				</div>
				<Panel title={t("page.dashboard.tabs.http")} flush>
					<Rows
						columns="minmax(0, 1.3fr) minmax(0, 1fr) auto"
						head={[
							t("page.dashboard.table.columns.name"),
							t("page.dashboard.table.columns.latencyChart"),
							t("page.dashboard.table.columns.status"),
						]}
						rows={SAMPLE_MONITORS.map((monitor) => ({
							key: monitor.host,
							cells: [
								<span mix={[raw({ display: "grid", minInlineSize: "0" })]}>
									<Mono>{monitor.host}</Mono>
									<Muted>
										{t("page.dashboard.table.responseTime", { value: `${monitor.averageMs} ms` })}
									</Muted>
								</span>,
								<span
									mix={[
										raw({ display: "block", inlineSize: "100%", overflow: "hidden" }),
										when("& svg", raw({ inlineSize: "100%", blockSize: "auto" })),
									]}
								>
									<Sparkline points={sparklinePoints(monitor.times)} />
								</span>,
								<Badge {...badgeVariant(monitor.tone)}>{t(STATUS_KEY[monitor.tone])}</Badge>,
							],
						}))}
					/>
				</Panel>
			</MockupWindow>
		);
	};
}
