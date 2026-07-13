/**
 * Dashboard "Uptime percentage" + "Slowest Endpoint" stat-card fragment: rendered with
 * no document shell so the dashboard's overview `Frame` can swap it in over its
 * skeleton fallback once the Analytics Engine query resolves.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import EmptyState from "~/resources/components/empty-state";
import StatCard from "~/resources/components/stat-card";
import Subtitle from "~/resources/components/subtitle";

namespace DashboardCardOverviewView {
	export interface Props {
		uptimePercent: number | null;
		slowestResponseMs: number | null;
		slowestMonitorName: string | null;
		analyticsUnavailable: boolean;
	}
}

export default function DashboardCardOverviewView(handle: Handle<DashboardCardOverviewView.Props>) {
	return () => {
		let props = handle.props;

		if (props.analyticsUnavailable) {
			return <EmptyState message="Analytics data temporarily unavailable. Please retry later." />;
		}

		return (
			<>
				<StatCard
					label="Uptime percentage"
					value={
						<>
							{props.uptimePercent === null ? "—" : `${props.uptimePercent}%`}
							<Subtitle>Overall system uptime</Subtitle>
						</>
					}
				/>

				<StatCard
					label={
						props.slowestMonitorName ? (
							<>
								Slowest Endpoint "<em>{props.slowestMonitorName}</em>"
							</>
						) : (
							"Slowest Endpoint"
						)
					}
					value={
						<>
							{props.slowestResponseMs === null ? "N/A" : `${props.slowestResponseMs}ms`}
							<Subtitle>In the last 24 hours</Subtitle>
						</>
					}
				/>
			</>
		);
	};
}
