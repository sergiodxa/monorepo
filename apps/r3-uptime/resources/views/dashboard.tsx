/**
 * Team dashboard view. Shows three stat-card `Frame`s — usage, overview (uptime +
 * slowest endpoint), and per-monitor-type counts — each with a skeleton `fallback` so
 * none of them block the page's initial render, above a named `Frame` that loads the
 * tab bar and its monitor-type table together, so a tab switch keeps the tab bar's
 * active state in sync with the table it swapped in without reloading the stat cards.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { css, Frame } from "remix/ui";

import type { DashboardTab } from "~/resources/views/dashboard-panel";

import EmptyState from "~/resources/components/empty-state";
import StatCardSkeleton from "~/resources/components/stat-card-skeleton";
import routes from "~/routes/web";

export type { DashboardTab } from "~/resources/views/dashboard-panel";

namespace DashboardView {
	export interface Props {
		team: { slug: string; name: string };
		tab: DashboardTab;
	}
}

const row = css({ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 16 });
const countsRow = css({ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 24 });

export default function DashboardView(handle: Handle<DashboardView.Props>) {
	return () => {
		let props = handle.props;

		return (
			<div>
				<div mix={[row]}>
					<Frame
						name="dashboard-card-usage"
						src={routes.app.team.dashboardCardUsage.href({ team: props.team.slug })}
						fallback={<StatCardSkeleton count={1} />}
					/>
					<Frame
						name="dashboard-card-overview"
						src={routes.app.team.dashboardCardOverview.href({ team: props.team.slug })}
						fallback={<StatCardSkeleton count={2} />}
					/>
				</div>

				<div mix={[countsRow]}>
					<Frame
						name="dashboard-card-counts"
						src={routes.app.team.dashboardCardCounts.href({ team: props.team.slug })}
						fallback={<StatCardSkeleton count={5} />}
					/>
				</div>

				<Frame
					name="dashboard-panel"
					src={routes.app.team.dashboardPanel.href({ team: props.team.slug, type: props.tab })}
					fallback={<EmptyState message="Loading…" />}
				/>
			</div>
		);
	};
}
