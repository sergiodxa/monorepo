/**
 * Edit status-page page: settings + attached-service form posting to
 * `update-status-page`, and delete.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import type { StatusPageAttachedIds } from "~/app/data/status-page";
import type {
	SelectCronJobMonitor,
	SelectDnsMonitor,
	SelectMonitor,
	SelectStatusPage,
	SelectTcpMonitor,
} from "~/database/schema";

import * as s from "~/resources/styles";
import StatusPageFormFields from "~/resources/views/status-pages/form";
import routes from "~/routes/web";

namespace EditStatusPageView {
	export interface Props {
		team: { slug: string };
		page: SelectStatusPage;
		monitors: SelectMonitor[];
		dnsMonitors: SelectDnsMonitor[];
		tcpMonitors: SelectTcpMonitor[];
		cronJobs: SelectCronJobMonitor[];
		attachedIds: StatusPageAttachedIds;
	}
}

export default function EditStatusPageView(handle: Handle<EditStatusPageView.Props>) {
	return () => {
		let { team, page, monitors, dnsMonitors, tcpMonitors, cronJobs, attachedIds } = handle.props;

		return (
			<div>
				<h1>Edit status page</h1>
				<form method="post" action={routes.actions.updateStatusPage.href({ team: team.slug })}>
					<input type="hidden" name="status_page_id" value={page.id} />
					<StatusPageFormFields
						page={page}
						monitors={monitors}
						dnsMonitors={dnsMonitors}
						tcpMonitors={tcpMonitors}
						cronJobs={cronJobs}
						attachedMonitorIds={attachedIds.monitorIds}
						attachedDnsMonitorIds={attachedIds.dnsMonitorIds}
						attachedTcpMonitorIds={attachedIds.tcpMonitorIds}
						attachedCronJobIds={attachedIds.cronJobIds}
					/>
					<button type="submit" mix={[s.buttonPrimary]}>
						Save changes
					</button>
				</form>

				<a href={routes.app.team.statusPages.href({ team: team.slug })} mix={[s.link]}>
					Cancel
				</a>

				<h2>Danger zone</h2>
				<button
					type="button"
					commandfor="delete-status-page"
					command="show-modal"
					mix={[s.buttonDanger]}
				>
					Delete status page
				</button>
				<dialog id="delete-status-page" mix={[s.dialog]}>
					<h3>Delete this status page?</h3>
					<p mix={[s.mutedSmall]}>This can't be undone.</p>
					<form method="post" action={routes.actions.deleteStatusPage.href({ team: team.slug })}>
						<input type="hidden" name="status_page_id" value={page.id} />
						<button
							type="button"
							commandfor="delete-status-page"
							command="close"
							mix={[s.buttonSecondary]}
						>
							Cancel
						</button>
						<button type="submit" mix={[s.buttonDanger]}>
							Delete
						</button>
					</form>
				</dialog>
			</div>
		);
	};
}
