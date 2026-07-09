/**
 * Cron-job monitors list page. Renders every cron-job monitor for the team with its
 * status and human-readable schedule, or an empty state when there are none yet.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import type { SelectCronJobMonitor } from "~/database/schema";
import type { BadgeTone } from "~/resources/components/badge";

import CronJobMonitor from "~/app/data/cron-job";
import Badge from "~/resources/components/badge";
import EmptyState from "~/resources/components/empty-state";
import * as s from "~/resources/styles";
import routes from "~/routes/web";

namespace CronJobsView {
	export interface Props {
		team: { slug: string };
		monitors: SelectCronJobMonitor[];
	}
}

const STATUS_BADGE_TONE: Record<string, BadgeTone> = {
	healthy: "up",
	late: "degraded",
	missed: "down",
	new: "neutral",
};

export default function CronJobsView(handle: Handle<CronJobsView.Props>) {
	return () => {
		let { team, monitors } = handle.props;

		return (
			<div>
				<div mix={[s.row]}>
					<h1>Cron job monitors</h1>
					<a href={routes.app.team.cronJobNew.href({ team: team.slug })} mix={[s.buttonPrimary]}>
						New cron job monitor
					</a>
				</div>

				{monitors.length === 0 ? (
					<EmptyState
						message="No cron job monitors yet."
						action={{
							href: routes.app.team.cronJobNew.href({ team: team.slug }),
							label: "Create your first cron job monitor",
						}}
					/>
				) : (
					<table mix={[s.table]}>
						<thead>
							<tr>
								<th>Name</th>
								<th>Schedule</th>
								<th>Status</th>
							</tr>
						</thead>
						<tbody>
							{monitors.map((monitor) => (
								<tr key={monitor.id}>
									<td>
										<a
											href={routes.app.team.cronJobShow.href({
												team: team.slug,
												monitorId: monitor.id,
											})}
											mix={[s.link]}
										>
											{monitor.name}
										</a>
										{monitor.enabled_at === null && <Badge tone="neutral">Disabled</Badge>}
									</td>
									<td>{CronJobMonitor.describeCronExpression(monitor.cron_expression)}</td>
									<td>
										<Badge tone={STATUS_BADGE_TONE[monitor.status] ?? "neutral"}>
											{monitor.status}
										</Badge>
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
