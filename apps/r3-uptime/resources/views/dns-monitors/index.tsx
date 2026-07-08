/**
 * DNS monitors list page. Renders every DNS monitor for the team with its last-known
 * status, or an empty state when there are none yet.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import type { SelectDnsMonitor } from "~/database/schema";

import * as s from "~/resources/styles";
import routes from "~/routes/web";

namespace DnsMonitorsView {
	export interface Props {
		team: { slug: string };
		monitors: SelectDnsMonitor[];
	}
}

const STATUS_BADGE_MIX: Record<string, typeof s.badgeUp> = {
	ok: s.badgeUp,
	changed: s.badgeDegraded,
	error: s.badgeDown,
};

export default function DnsMonitorsView(handle: Handle<DnsMonitorsView.Props>) {
	return () => {
		let { team, monitors } = handle.props;

		return (
			<div>
				<div mix={[s.row]}>
					<h1>DNS monitors</h1>
					<a href={routes.app.team.dnsMonitorNew.href({ team: team.slug })} mix={[s.buttonPrimary]}>
						New DNS monitor
					</a>
				</div>

				{monitors.length === 0 ? (
					<div mix={[s.emptyState]}>
						<p>No DNS monitors yet.</p>
						<a
							href={routes.app.team.dnsMonitorNew.href({ team: team.slug })}
							mix={[s.buttonPrimary]}
						>
							Create your first DNS monitor
						</a>
					</div>
				) : (
					<table mix={[s.table]}>
						<thead>
							<tr>
								<th>Name</th>
								<th>Domain</th>
								<th>Record type</th>
								<th>Status</th>
							</tr>
						</thead>
						<tbody>
							{monitors.map((monitor) => (
								<tr key={monitor.id}>
									<td>
										<a
											href={routes.app.team.dnsMonitorShow.href({
												team: team.slug,
												monitorId: monitor.id,
											})}
											mix={[s.link]}
										>
											{monitor.name}
										</a>
										{!monitor.is_enabled && <span mix={[s.badge, s.badgeNeutral]}>Disabled</span>}
									</td>
									<td>
										<code>{monitor.domain}</code>
									</td>
									<td>{monitor.record_type}</td>
									<td>
										<span
											mix={[s.badge, STATUS_BADGE_MIX[monitor.last_status ?? ""] ?? s.badgeNeutral]}
										>
											{monitor.last_status ?? "not checked"}
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
