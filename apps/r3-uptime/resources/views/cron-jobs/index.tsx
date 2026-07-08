/**
 * Cron-job monitors list page. Renders every cron-job monitor for the team with its
 * status and human-readable schedule, or an empty state when there are none yet.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import type { SelectCronJobMonitor } from "~/database/schema";

import CronJobMonitor from "~/app/data/cron-job";
import * as s from "~/resources/styles";
import routes from "~/routes/web";

namespace CronJobsView {
	export interface Props {
		team: { slug: string };
		monitors: SelectCronJobMonitor[];
	}
}

const STATUS_BADGE_MIX: Record<string, typeof s.badgeUp> = {
	healthy: s.badgeUp,
	late: s.badgeDegraded,
	missed: s.badgeDown,
	new: s.badgeNeutral,
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
					<div mix={[s.emptyState]}>
						<p>No cron job monitors yet.</p>
						<a href={routes.app.team.cronJobNew.href({ team: team.slug })} mix={[s.buttonPrimary]}>
							Create your first cron job monitor
						</a>
					</div>
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
										{monitor.enabled_at === null && (
											<span mix={[s.badge, s.badgeNeutral]}>Disabled</span>
										)}
									</td>
									<td>{CronJobMonitor.describeCronExpression(monitor.cron_expression)}</td>
									<td>
										<span mix={[s.badge, STATUS_BADGE_MIX[monitor.status] ?? s.badgeNeutral]}>
											{monitor.status}
										</span>
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
