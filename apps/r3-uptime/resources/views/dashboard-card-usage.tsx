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

namespace DashboardCardUsageView {
	export interface Props {
		/** Actual Polar-reported usage for the current month, `null` when unavailable. */
		consumed: number | null;
		/** Estimated monthly consumption from current monitor settings, `null` when unavailable. */
		usage: number | null;
	}
}

export default function DashboardCardUsageView(handle: Handle<DashboardCardUsageView.Props>) {
	return () => {
		let { usage, consumed } = handle.props;

		if (consumed === null && usage === null) {
			return (
				<StatCard
					label="Error"
					value={
						<>
							-<Subtitle>Failed to load data</Subtitle>
						</>
					}
				/>
			);
		}

		return (
			<StatCard
				label="Monthly Pings Usage"
				value={
					<>
						{consumed === null ? "—" : consumed.toLocaleString()}
						<Subtitle>
							{usage === null
								? "Estimate unavailable"
								: `Out of ${usage.toLocaleString()} estimated`}
						</Subtitle>
					</>
				}
			/>
		);
	};
}
