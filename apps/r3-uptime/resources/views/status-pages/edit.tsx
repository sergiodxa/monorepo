/**
 * Edit status-page page: settings + attached-service form posting to
 * `update-status-page`, and delete.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { css } from "remix/ui";

import type { StatusPageAttachedIds } from "~/app/data/status-page";
import type {
	SelectCronJobMonitor,
	SelectDnsMonitor,
	SelectMonitor,
	SelectStatusPage,
	SelectTcpMonitor,
} from "~/database/schema";

import Button from "~/resources/components/button";
import { neutral, primary } from "~/resources/theme";
import StatusPageFormFields from "~/resources/views/status-pages/form";
import routes from "~/routes/web";

const cancelLink = css({
	color: primary[600],
	textDecoration: "none",
	"&:hover": { textDecoration: "underline" },
	"@media (prefers-color-scheme: dark)": { color: primary[400] },
});

const dialog = css({
	padding: 24,
	borderRadius: 8,
	border: `1px solid ${neutral[300]}`,
	maxWidth: 400,
	"&::backdrop": { background: "rgba(0, 0, 0, 0.4)" },
	"@media (prefers-color-scheme: dark)": {
		borderColor: neutral[700],
		background: neutral[900],
		color: neutral[50],
	},
});

const dialogText = css({
	fontSize: "0.8125rem",
	color: neutral[500],
	"@media (prefers-color-scheme: dark)": { color: neutral[400] },
});

const dialogActions = css({ display: "flex", gap: 8, justifyContent: "flex-end" });

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

/** Renders the status-page form pre-filled with the current values and attached monitors, plus a delete-confirmation dialog. */
export default function EditStatusPageView(handle: Handle<EditStatusPageView.Props>) {
	return () => {
		let { team, page, monitors, dnsMonitors, tcpMonitors, cronJobs, attachedIds } = handle.props;

		return (
			<div>
				<form method="post" action={routes.actions.statusPage.update.href({ team: team.slug })}>
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
					<Button type="submit">Save changes</Button>
				</form>

				<a href={routes.app.team.statusPages.index.href({ team: team.slug })} mix={[cancelLink]}>
					Cancel
				</a>

				<h2>Danger zone</h2>
				<Button type="button" color="danger" commandfor="delete-status-page" command="show-modal">
					Delete status page
				</Button>
				<dialog id="delete-status-page" mix={[dialog]}>
					<h3>Delete this status page?</h3>
					<p mix={[dialogText]}>This can't be undone.</p>
					<form method="post" action={routes.actions.statusPage.delete.href({ team: team.slug })}>
						<input type="hidden" name="_method" value="DELETE" />
						<input type="hidden" name="status_page_id" value={page.id} />
						<div mix={[dialogActions]}>
							<Button
								type="button"
								variant="outline"
								commandfor="delete-status-page"
								command="close"
							>
								Cancel
							</Button>
							<Button type="submit" color="danger">
								Delete
							</Button>
						</div>
					</form>
				</dialog>
			</div>
		);
	};
}
