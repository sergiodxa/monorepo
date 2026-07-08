/**
 * Edit HTTP monitor page: general settings form (posts to `update-monitor`), the
 * content-checks section, and the SSL monitoring settings form. It exists so a team
 * can adjust an existing monitor's configuration and checks.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import type { SelectMonitor, SelectMonitorContentCheck } from "~/database/schema";

import * as s from "~/resources/styles";
import ContentChecksSection from "~/resources/views/monitors/content-checks";
import MonitorFormFields from "~/resources/views/monitors/form";
import SslForm from "~/resources/views/monitors/ssl-form";
import routes from "~/routes/web";

namespace EditMonitorView {
	export interface Props {
		team: { slug: string };
		monitor: SelectMonitor;
		contentChecks: SelectMonitorContentCheck[];
	}
}

export default function EditMonitorView(handle: Handle<EditMonitorView.Props>) {
	return () => {
		let { team, monitor, contentChecks } = handle.props;

		return (
			<div>
				<h1>Edit monitor</h1>
				<form method="post" action={routes.actions.updateMonitor.href({ team: team.slug })}>
					<input type="hidden" name="monitor_id" value={monitor.id} />
					<MonitorFormFields monitor={monitor} />
					<button type="submit" mix={[s.buttonPrimary]}>
						Save changes
					</button>
				</form>

				<ContentChecksSection team={team} monitorId={monitor.id} contentChecks={contentChecks} />

				<SslForm team={team} monitor={monitor} />
			</div>
		);
	};
}
