/**
 * Edit HTTP monitor page: general settings form (posts to `update-monitor`), the
 * content-checks section, and the SSL monitoring settings form. It exists so a team
 * can adjust an existing monitor's configuration and checks.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { css } from "remix/ui";

import type { SelectMonitor, SelectMonitorContentCheck } from "~/database/schema";

import Button from "~/resources/components/button";
import { neutral, primary } from "~/resources/theme";
import ContentChecksSection from "~/resources/views/monitors/content-checks";
import MonitorFormFields from "~/resources/views/monitors/form";
import SslForm from "~/resources/views/monitors/ssl-form";
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

namespace EditMonitorView {
	export interface Props {
		team: { slug: string };
		monitor: SelectMonitor;
		contentChecks: SelectMonitorContentCheck[];
	}
}

/** Renders the general-settings form pre-filled with the current values, followed by the content-checks section, the SSL monitoring form, and a delete-confirmation dialog. */
export default function EditMonitorView(handle: Handle<EditMonitorView.Props>) {
	return () => {
		let { team, monitor, contentChecks } = handle.props;

		return (
			<div>
				<form method="post" action={routes.actions.monitor.http.update.href({ team: team.slug })}>
					<input type="hidden" name="monitor_id" value={monitor.id} />
					<MonitorFormFields monitor={monitor} />
					<Button type="submit">Save changes</Button>
				</form>

				<a
					href={routes.app.team.monitors.show.href({ team: team.slug, monitorId: monitor.id })}
					mix={[cancelLink]}
				>
					Cancel
				</a>

				<ContentChecksSection team={team} monitorId={monitor.id} contentChecks={contentChecks} />

				<SslForm team={team} monitor={monitor} />

				<h2>Danger zone</h2>
				<Button type="button" color="danger" commandfor="delete-monitor" command="show-modal">
					Delete monitor
				</Button>
				<dialog id="delete-monitor" mix={[dialog]}>
					<h3>Delete this monitor?</h3>
					<p mix={[dialogText]}>
						This also deletes its content checks and check-result history. This can't be undone.
					</p>
					<form method="post" action={routes.actions.monitor.http.delete.href({ team: team.slug })}>
						<input type="hidden" name="_method" value="DELETE" />
						<input type="hidden" name="monitor_id" value={monitor.id} />
						<div mix={[dialogActions]}>
							<Button type="button" variant="outline" commandfor="delete-monitor" command="close">
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
