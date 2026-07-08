/**
 * Edit DNS monitor page: settings form, posting to `update-dns-monitor`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import type { SelectDnsMonitor } from "~/database/schema";

import * as s from "~/resources/styles";
import DnsMonitorFormFields from "~/resources/views/dns-monitors/form";
import routes from "~/routes/web";

namespace EditDnsMonitorView {
	export interface Props {
		team: { slug: string };
		monitor: SelectDnsMonitor;
	}
}

export default function EditDnsMonitorView(handle: Handle<EditDnsMonitorView.Props>) {
	return () => {
		let { team, monitor } = handle.props;

		return (
			<div>
				<h1>Edit DNS monitor</h1>
				<form method="post" action={routes.actions.updateDnsMonitor.href({ team: team.slug })}>
					<input type="hidden" name="monitor_id" value={monitor.id} />
					<DnsMonitorFormFields monitor={monitor} />
					<button type="submit" mix={[s.buttonPrimary]}>
						Save changes
					</button>
				</form>

				<a
					href={routes.app.team.dnsMonitorShow.href({ team: team.slug, monitorId: monitor.id })}
					mix={[s.link]}
				>
					Cancel
				</a>

				<h2>Danger zone</h2>
				<button
					type="button"
					commandfor="delete-dns-monitor"
					command="show-modal"
					mix={[s.buttonDanger]}
				>
					Delete monitor
				</button>
				<dialog id="delete-dns-monitor" mix={[s.dialog]}>
					<h3>Delete this DNS monitor?</h3>
					<p mix={[s.mutedSmall]}>
						This also deletes its check-result history. This can't be undone.
					</p>
					<form method="post" action={routes.actions.deleteDnsMonitor.href({ team: team.slug })}>
						<input type="hidden" name="monitor_id" value={monitor.id} />
						<button
							type="button"
							commandfor="delete-dns-monitor"
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
