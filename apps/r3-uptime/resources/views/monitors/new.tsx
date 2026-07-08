/**
 * New HTTP monitor form page. Posts to the `create-monitor` action. It exists as the
 * page a team uses to start monitoring a new URL.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import * as s from "~/resources/styles";
import MonitorFormFields from "~/resources/views/monitors/form";
import routes from "~/routes/web";

namespace NewMonitorView {
	export interface Props {
		team: { slug: string };
	}
}

export default function NewMonitorView(handle: Handle<NewMonitorView.Props>) {
	return () => (
		<div>
			<h1>New monitor</h1>
			<form
				method="post"
				action={routes.actions.createMonitor.href({ team: handle.props.team.slug })}
			>
				<MonitorFormFields />
				<button type="submit" mix={[s.buttonPrimary]}>
					Create monitor
				</button>
			</form>
		</div>
	);
}
