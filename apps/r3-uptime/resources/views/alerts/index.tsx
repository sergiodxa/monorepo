/**
 * Alerts list page. Renders every alert for the team, or an empty state when there
 * are none yet, gated by the team's alert limit.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { BellIcon, PlusIcon } from "@pkg/lucide-remix";
import { css } from "remix/ui";

import type { SelectAlert, SelectMonitor } from "~/database/schema";

import { MAX_ALERTS_PER_TEAM } from "~/app/data/alert";
import {
	Empty,
	EmptyAction,
	EmptyDescription,
	EmptyIcon,
	EmptyTitle,
} from "~/resources/components/empty";
import LinkButton from "~/resources/components/link-button";
import { neutral, primary } from "~/resources/theme";
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

/** Renders the alert table with an at-limit warning banner once the team hits `MAX_ALERTS_PER_TEAM`, or an empty state with a create-alert CTA. */
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
					<Empty>
						<EmptyIcon>
							<BellIcon size={48} strokeWidth={1.5} />
						</EmptyIcon>
						<EmptyTitle>No alerts configured</EmptyTitle>
						<EmptyDescription>
							Create an alert to get notified when your monitors go down.
						</EmptyDescription>
						<EmptyAction>
							<LinkButton href={routes.app.team.alerts.new.href({ team: team.slug })}>
								<PlusIcon size={20} strokeWidth={1.5} />
								Create Alert
							</LinkButton>
						</EmptyAction>
					</Empty>
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
												href={routes.app.team.alerts.edit.href({
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
