/**
 * Alerts list page. Renders every alert for the team, or an empty state when there
 * are none yet, gated by the team's alert limit.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import type { SelectAlert, SelectMonitor } from "~/database/schema";

import { MAX_ALERTS_PER_TEAM } from "~/app/data/alert";
import * as s from "~/resources/styles";
import routes from "~/routes/web";

namespace AlertsView {
	export interface Props {
		team: { slug: string };
		alerts: SelectAlert[];
		monitorsById: Map<string, SelectMonitor>;
	}
}

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
				<div mix={[s.row]}>
					<h1>Alerts</h1>
					<a href={routes.app.team.alertHistory.href({ team: team.slug })} mix={[s.link]}>
						View history
					</a>
					{!atLimit && (
						<a href={routes.app.team.alertNew.href({ team: team.slug })} mix={[s.buttonPrimary]}>
							New alert
						</a>
					)}
				</div>

				{atLimit && (
					<p mix={[s.mutedSmall]}>
						This team has reached the limit of {MAX_ALERTS_PER_TEAM} alerts.
					</p>
				)}

				{alerts.length === 0 ? (
					<div mix={[s.emptyState]}>
						<p>No alerts yet.</p>
						<a href={routes.app.team.alertNew.href({ team: team.slug })} mix={[s.buttonPrimary]}>
							Create your first alert
						</a>
					</div>
				) : (
					<table mix={[s.table]}>
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
											href={routes.app.team.alertEdit.href({ team: team.slug, alertId: alert.id })}
											mix={[s.link]}
										>
											Edit
										</a>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				)}
			</div>
		);
	};
}
