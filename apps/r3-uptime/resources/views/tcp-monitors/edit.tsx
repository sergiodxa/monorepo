/**
 * Edit TCP monitor page: settings form, posting to `update-tcp-monitor`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import type { SelectTcpMonitor } from "~/database/schema";

import * as s from "~/resources/styles";
import TcpMonitorFormFields from "~/resources/views/tcp-monitors/form";
import routes from "~/routes/web";

namespace EditTcpMonitorView {
	export interface Props {
		team: { slug: string };
		monitor: SelectTcpMonitor;
	}
}

export default function EditTcpMonitorView(handle: Handle<EditTcpMonitorView.Props>) {
	return () => {
		let { team, monitor } = handle.props;

		return (
			<div>
				<h1>Edit TCP monitor</h1>
				<form method="post" action={routes.actions.updateTcpMonitor.href({ team: team.slug })}>
					<input type="hidden" name="monitor_id" value={monitor.id} />
					<TcpMonitorFormFields monitor={monitor} />
					<button type="submit" mix={[s.buttonPrimary]}>
						Save changes
					</button>
				</form>

				<a
					href={routes.app.team.tcpMonitorShow.href({ team: team.slug, monitorId: monitor.id })}
					mix={[s.link]}
				>
					Cancel
				</a>

				<h2>Danger zone</h2>
				<button
					type="button"
					commandfor="delete-tcp-monitor"
					command="show-modal"
					mix={[s.buttonDanger]}
				>
					Delete monitor
				</button>
				<dialog id="delete-tcp-monitor" mix={[s.dialog]}>
					<h3>Delete this TCP monitor?</h3>
					<p mix={[s.mutedSmall]}>
						This also deletes its check-result history. This can't be undone.
					</p>
					<form method="post" action={routes.actions.deleteTcpMonitor.href({ team: team.slug })}>
						<input type="hidden" name="monitor_id" value={monitor.id} />
						<button
							type="button"
							commandfor="delete-tcp-monitor"
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
