/**
 * New TCP monitor form page. Posts to the `create-tcp-monitor` action.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import * as s from "~/resources/styles";
import TcpMonitorFormFields from "~/resources/views/tcp-monitors/form";
import routes from "~/routes/web";

namespace NewTcpMonitorView {
	export interface Props {
		team: { slug: string };
	}
}

export default function NewTcpMonitorView(handle: Handle<NewTcpMonitorView.Props>) {
	return () => (
		<div>
			<h1>New TCP monitor</h1>
			<form
				method="post"
				action={routes.actions.createTcpMonitor.href({ team: handle.props.team.slug })}
			>
				<TcpMonitorFormFields />
				<button type="submit" mix={[s.buttonPrimary]}>
					Create TCP monitor
				</button>
			</form>
		</div>
	);
}
