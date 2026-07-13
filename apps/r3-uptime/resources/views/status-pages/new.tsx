/**
 * New status-page form page. Posts to the `create-status-page` action.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { css } from "remix/ui";

import type {
	SelectCronJobMonitor,
	SelectDnsMonitor,
	SelectMonitor,
	SelectTcpMonitor,
} from "~/database/schema";

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
				<form method="post" action={routes.actions.statusPage.create.href({ team: team.slug })}>
					<StatusPageFormFields
						monitors={monitors}
						dnsMonitors={dnsMonitors}
						tcpMonitors={tcpMonitors}
						cronJobs={cronJobs}
					/>
					<button
						type="submit"
						mix={[
							css({
								display: "inline-flex",
								alignItems: "center",
								justifyContent: "center",
								padding: "8px 16px",
								borderRadius: 6,
								border: "1px solid transparent",
								background: "oklch(0.24 0.005 145)",
								color: "#ffffff",
								fontFamily: "inherit",
								fontSize: "0.875rem",
								fontWeight: 500,
								cursor: "pointer",
								textDecoration: "none",
								"&:hover": { background: "oklch(0.32 0.006 145)" },
							}),
						]}
					>
						Create status page
					</button>
				</form>
			</div>
		);
	};
}
