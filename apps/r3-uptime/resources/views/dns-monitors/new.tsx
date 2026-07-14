/**
 * New DNS monitor form page. Posts to the `create-dns-monitor` action.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import Button from "~/resources/components/button";
import DnsMonitorFormFields from "~/resources/views/dns-monitors/form";
import routes from "~/routes/web";

namespace NewDnsMonitorView {
	export interface Props {
		team: { slug: string };
	}
}

/** Renders the empty DNS monitor form for creating a new monitor. */
export default function NewDnsMonitorView(handle: Handle<NewDnsMonitorView.Props>) {
	return () => (
		<div>
			<form
				method="post"
				action={routes.actions.monitor.dns.create.href({ team: handle.props.team.slug })}
			>
				<DnsMonitorFormFields />
				<Button type="submit">Create DNS monitor</Button>
			</form>
		</div>
	);
}
