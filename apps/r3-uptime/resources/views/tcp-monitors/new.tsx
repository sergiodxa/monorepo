/**
 * New TCP monitor form page. Posts to the `create-tcp-monitor` action.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import Button from "~/resources/components/button";
import TcpMonitorFormFields from "~/resources/views/tcp-monitors/form";
import routes from "~/routes/web";

namespace NewTcpMonitorView {
	export interface Props {
		team: { slug: string };
	}
}

/** Renders the empty TCP monitor form for creating a new monitor. */
export default function NewTcpMonitorView(handle: Handle<NewTcpMonitorView.Props>) {
	return () => (
		<div>
			<form
				method="post"
				action={routes.actions.monitor.tcp.create.href({ team: handle.props.team.slug })}
			>
				<TcpMonitorFormFields />
				<Button type="submit">Create TCP monitor</Button>
			</form>
		</div>
	);
}
