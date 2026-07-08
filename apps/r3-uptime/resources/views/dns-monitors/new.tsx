/**
 * New DNS monitor form page. Posts to the `create-dns-monitor` action.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import * as s from "~/resources/styles";
import DnsMonitorFormFields from "~/resources/views/dns-monitors/form";
import routes from "~/routes/web";

namespace NewDnsMonitorView {
	export interface Props {
		team: { slug: string };
	}
}

export default function NewDnsMonitorView(handle: Handle<NewDnsMonitorView.Props>) {
	return () => (
		<div>
			<h1>New DNS monitor</h1>
			<form
				method="post"
				action={routes.actions.createDnsMonitor.href({ team: handle.props.team.slug })}
			>
				<DnsMonitorFormFields />
				<button type="submit" mix={[s.buttonPrimary]}>
					Create DNS monitor
				</button>
			</form>
		</div>
	);
}
