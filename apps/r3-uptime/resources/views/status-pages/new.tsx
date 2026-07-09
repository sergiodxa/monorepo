/**
 * New status-page form page. Posts to the `create-status-page` action.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import type {
	SelectCronJobMonitor,
	SelectDnsMonitor,
	SelectMonitor,
	SelectTcpMonitor,
} from "~/database/schema";

import * as s from "~/resources/styles";
import StatusPageFormFields from "~/resources/views/status-pages/form";
import routes from "~/routes/web";

namespace NewStatusPageView {
	export interface Props {
		team: { slug: string };
		monitors: SelectMonitor[];
		dnsMonitors: SelectDnsMonitor[];
		tcpMonitors: SelectTcpMonitor[];
		cronJobs: SelectCronJobMonitor[];
	}
}

export default function NewStatusPageView(handle: Handle<NewStatusPageView.Props>) {
	return () => {
		let { team, monitors, dnsMonitors, tcpMonitors, cronJobs } = handle.props;

		return (
			<div>
				<h1>New status page</h1>
				<form method="post" action={routes.actions.createStatusPage.href({ team: team.slug })}>
					<StatusPageFormFields
						monitors={monitors}
						dnsMonitors={dnsMonitors}
						tcpMonitors={tcpMonitors}
						cronJobs={cronJobs}
					/>
					<button type="submit" mix={[s.buttonPrimary]}>
						Create status page
					</button>
				</form>
			</div>
		);
	};
}
