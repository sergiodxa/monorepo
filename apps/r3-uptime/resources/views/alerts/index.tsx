/**
 * Alerts list page. Renders every alert for the team, or an empty state when there
 * are none yet, gated by the team's alert limit.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { css } from "remix/ui";

import type { SelectAlert, SelectMonitor } from "~/database/schema";

import { MAX_ALERTS_PER_TEAM } from "~/app/data/alert";
import EmptyState from "~/resources/components/empty-state";
import routes from "~/routes/web";

namespace AlertsView {
	export interface Props {
		team: { slug: string };
		alerts: SelectAlert[];
		monitorsById: Map<string, SelectMonitor>;
	}
}

const neutral = {
	200: "oklch(0.91 0.008 145)",
	400: "oklch(0.73 0.01 145)",
	500: "oklch(0.62 0.01 145)",
	800: "oklch(0.32 0.006 145)",
	900: "oklch(0.24 0.005 145)",
} as const;

const primary = {
	400: "oklch(0.78 0.16 142)",
	600: "oklch(0.6 0.16 142)",
} as const;

const STRATEGY_LABELS: Record<string, string> = {
	email: "Email",
	webhook: "Webhook",
	slack: "Slack",
	discord: "Discord",
};

export default function AlertsView(handle: Handle<AlertsView.Props>) {
	return () => {
		let { team, alerts, monitorsById } = handle.props;
		let atLimit = alerts.length >= MAX_ALERTS_PER_TEAM;

		return (
			<div>
				{atLimit && (
					<p
						mix={[
							css({
								fontSize: "0.8125rem",
								color: neutral[500],
								"@media (prefers-color-scheme: dark)": { color: neutral[400] },
							}),
						]}
					>
						This team has reached the limit of {MAX_ALERTS_PER_TEAM} alerts.
					</p>
				)}

				{alerts.length === 0 ? (
					<EmptyState
						message="No alerts yet."
						action={{
							href: routes.app.team.alertNew.href({ team: team.slug }),
							label: "Create your first alert",
						}}
					/>
				) : (
					<div mix={[css({ overflowX: "auto" })]}>
						<table
							mix={[
								css({
									width: "100%",
									borderCollapse: "collapse",
									fontSize: "0.875rem",
									"& th, & td": {
										textAlign: "left",
										padding: "12px 16px",
										borderBottom: `1px solid ${neutral[200]}`,
									},
									"@media (prefers-color-scheme: dark)": {
										"& th, & td": { borderColor: neutral[800] },
									},
								}),
							]}
						>
							<thead>
								<tr>
									<th>Name</th>
									<th>Scope</th>
									<th>Channel</th>
									<th>Recovery</th>
									<th>Cooldown</th>
									<th></th>
								</tr>
							</thead>
							<tbody>
								{alerts.map((alert) => (
									<tr key={alert.id}>
										<td>{alert.name}</td>
										<td>
											{alert.monitor_id
												? (monitorsById.get(alert.monitor_id)?.name ?? "Unknown monitor")
												: "Team-wide"}
										</td>
										<td>{STRATEGY_LABELS[alert.config.strategy] ?? alert.config.strategy}</td>
										<td>{alert.notify_on_recovery ? "Yes" : "No"}</td>
										<td>{alert.cooldown_minutes === 0 ? "None" : `${alert.cooldown_minutes}m`}</td>
										<td>
											<a
												href={routes.app.team.alertEdit.href({
													team: team.slug,
													alertId: alert.id,
												})}
												mix={[
													css({
														color: primary[600],
														textDecoration: "none",
														"&:hover": { textDecoration: "underline" },
														"@media (prefers-color-scheme: dark)": { color: primary[400] },
													}),
												]}
											>
												Edit
											</a>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>
		);
	};
}
