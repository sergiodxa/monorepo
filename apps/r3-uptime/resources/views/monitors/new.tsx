/**
 * New HTTP monitor form page. Posts to the `create-monitor` action. It exists as the
 * page a team uses to start monitoring a new URL.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { css } from "remix/ui";

import Button from "~/resources/components/button";
import MonitorFormFields from "~/resources/views/monitors/form";
import routes from "~/routes/web";

namespace NewMonitorView {
	export interface Props {
		team: { slug: string };
	}
}

/** Renders the empty HTTP monitor form for creating a new monitor. */
export default function NewMonitorView(handle: Handle<NewMonitorView.Props>) {
	return () => (
		<div mix={[css({ maxWidth: 640 })]}>
			<form
				method="post"
				action={routes.actions.monitor.http.create.href({ team: handle.props.team.slug })}
			>
				<MonitorFormFields />
				<Button type="submit">Create monitor</Button>
			</form>
		</div>
	);
}
