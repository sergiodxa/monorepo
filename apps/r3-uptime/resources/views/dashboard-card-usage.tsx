/**
 * Dashboard "Monthly Pings Usage" stat-card fragment: rendered with no document shell
 * so the dashboard's usage `Frame` can swap it in over its skeleton fallback once the
 * Polar ping-usage lookup resolves — the slowest of the dashboard's data fetches, and
 * the reason it gets its own `Frame` instead of sharing one with the other cards.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import StatCard from "~/resources/components/stat-card";
import Subtitle from "~/resources/components/subtitle";

/** The team's Polar ping usage for the current month, `null` when unavailable (see
 * the usage controller's `getPingUsage`). */
export interface PingUsage {
	consumed: number;
	estimated: number;
}

namespace DashboardCardUsageView {
	export interface Props {
		pingUsage: PingUsage | null;
	}
}

export default function DashboardCardUsageView(handle: Handle<DashboardCardUsageView.Props>) {
	return () => {
		let { pingUsage } = handle.props;

		return pingUsage ? (
			<StatCard
				label="Monthly Pings Usage"
				value={
					<>
						{pingUsage.consumed.toLocaleString()}
						<Subtitle>Out of {pingUsage.estimated.toLocaleString()} estimated</Subtitle>
					</>
				}
			/>
		) : (
			<StatCard
				label="Error"
				value={
					<>
						-<Subtitle>Failed to load data</Subtitle>
					</>
				}
			/>
		);
	};
}
