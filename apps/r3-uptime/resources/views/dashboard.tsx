/**
 * Team dashboard view. Shows stat cards (monitor count, 24h uptime, slowest response)
 * and a tabbed monitor table, one tab per monitor type. Each tab is a real link, and
 * the panel loads through a named `Frame` so switching tabs doesn't reload the stat
 * cards above it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { css, Frame } from "remix/ui";

import Badge from "~/resources/components/badge";
import EmptyState from "~/resources/components/empty-state";
import StatCard from "~/resources/components/stat-card";
import { Tab, TabList } from "~/resources/components/tabs";
import routes from "~/routes/web";

export type DashboardTab = "http" | "dns" | "tcp" | "cron-jobs";

const TABS: Array<{ id: DashboardTab; label: string }> = [
	{ id: "http", label: "HTTP" },
	{ id: "dns", label: "DNS" },
	{ id: "tcp", label: "TCP" },
	{ id: "cron-jobs", label: "Cron jobs" },
];

namespace DashboardView {
	export interface Props {
		team: { slug: string; name: string };
		tab: DashboardTab;
		monitorCount: number;
		uptimePercent: number | null;
		slowestResponseMs: number | null;
		sslCounts: { valid: number; expiring: number; expired: number };
		analyticsUnavailable: boolean;
	}
}

export default function DashboardView(handle: Handle<DashboardView.Props>) {
	return () => {
		let props = handle.props;

		return (
			<div>
				{props.analyticsUnavailable && (
					<EmptyState message="Analytics data temporarily unavailable. Please retry later." />
				)}

				<div
					mix={[
						css({
							display: "flex",
							flexWrap: "wrap",
							gap: 16,
							marginBottom: 24,
						}),
					]}
				>
					<StatCard label="HTTP monitors" value={props.monitorCount} />
					<StatCard
						label="Uptime (24h)"
						value={props.uptimePercent === null ? "—" : `${props.uptimePercent}%`}
					/>
					<StatCard
						label="Slowest response (24h)"
						value={props.slowestResponseMs === null ? "—" : `${props.slowestResponseMs}ms`}
					/>
					<StatCard
						label="SSL certificates"
						value={
							<div mix={[css({ display: "flex", flexWrap: "wrap", gap: 8 })]}>
								<Badge tone="up">{props.sslCounts.valid} valid</Badge>
								<Badge tone="degraded">{props.sslCounts.expiring} expiring</Badge>
								<Badge tone="down">{props.sslCounts.expired} expired</Badge>
							</div>
						}
					/>
				</div>

				<TabList aria-label="Monitor type">
					{TABS.map((tab) => (
						<Tab
							key={tab.id}
							href={`${routes.app.team.dashboard.href({ team: props.team.slug })}?tab=${tab.id}`}
							frameSrc={routes.app.team.dashboardPanel.href({
								team: props.team.slug,
								type: tab.id,
							})}
							active={tab.id === props.tab}
							controls="dashboard-panel"
							frameTarget="dashboard-panel"
						>
							{tab.label}
						</Tab>
					))}
				</TabList>

				<Frame
					name="dashboard-panel"
					src={routes.app.team.dashboardPanel.href({ team: props.team.slug, type: props.tab })}
				/>
			</div>
		);
	};
}
