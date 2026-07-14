/**
 * Team dashboard view. Shows eight independent stat-card `Frame`s — usage, uptime,
 * slowest endpoint, and one count per monitor type (HTTP, DNS, TCP, cron jobs, SSL) —
 * each with its own skeleton `fallback` so no single card's fetch (notably usage, a
 * Polar API call) ever blocks another card or the page's initial render, above a named
 * `Frame` that loads the tab bar and its monitor-type table together, so a tab switch
 * keeps the tab bar's active state in sync with the table it swapped in without
 * reloading the stat cards.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { css, Frame } from "remix/ui";

import type { DashboardTab } from "~/resources/views/dashboard-panel";

import Empty from "~/resources/components/empty";
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

/** Renders the dashboard shell's stat-card row and tab panel, each as an independently-loading `Frame`. */
export default function DashboardView(handle: Handle<DashboardView.Props>) {
	return () => {
		let props = handle.props;

		return (
			<div>
				<div mix={[row]}>
					<Frame
						name="dashboard-card-usage"
						src={routes.app.team.dashboard.cards.usage.href({ team: props.team.slug })}
						fallback={<StatCardSkeleton count={1} />}
					/>
					<Frame
						name="dashboard-card-uptime"
						src={routes.app.team.dashboard.cards.uptime.href({ team: props.team.slug })}
						fallback={<StatCardSkeleton count={1} />}
					/>
					<Frame
						name="dashboard-card-slowest-endpoint"
						src={routes.app.team.dashboard.cards.slowestEndpoint.href({ team: props.team.slug })}
						fallback={<StatCardSkeleton count={1} />}
					/>
				</div>

				<div mix={[countsRow]}>
					<Frame
						name="dashboard-card-count-http"
						src={routes.app.team.dashboard.cards.count.href({
							team: props.team.slug,
							resource: "http",
						})}
						fallback={<StatCardSkeleton count={1} />}
					/>
					<Frame
						name="dashboard-card-count-dns"
						src={routes.app.team.dashboard.cards.count.href({
							team: props.team.slug,
							resource: "dns",
						})}
						fallback={<StatCardSkeleton count={1} />}
					/>
					<Frame
						name="dashboard-card-count-tcp"
						src={routes.app.team.dashboard.cards.count.href({
							team: props.team.slug,
							resource: "tcp",
						})}
						fallback={<StatCardSkeleton count={1} />}
					/>
					<Frame
						name="dashboard-card-count-cron-jobs"
						src={routes.app.team.dashboard.cards.count.href({
							team: props.team.slug,
							resource: "cron-jobs",
						})}
						fallback={<StatCardSkeleton count={1} />}
					/>
					<Frame
						name="dashboard-card-count-ssl"
						src={routes.app.team.dashboard.cards.count.href({
							team: props.team.slug,
							resource: "ssl",
						})}
						fallback={<StatCardSkeleton count={1} />}
					/>
				</div>

				<Frame
					name="dashboard-panel"
					src={routes.app.team.dashboard.panel.href({ team: props.team.slug, type: props.tab })}
					fallback={
						<Empty>
							<Empty.Description>Loading…</Empty.Description>
						</Empty>
					}
				/>
			</div>
		);
	};
}
