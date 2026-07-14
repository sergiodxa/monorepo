/**
 * New alert form page. Posts to the `create-alert` action.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import type { SelectMonitor } from "~/database/schema";

import Button from "~/resources/components/button";
import AlertFormFields from "~/resources/views/alerts/form";
import routes from "~/routes/web";

namespace NewAlertView {
	export interface Props {
		team: { slug: string };
		monitors: SelectMonitor[];
	}
}

/** Renders the empty alert form for creating a new alert. */
export default function NewAlertView(handle: Handle<NewAlertView.Props>) {
	return () => {
		let { team, monitors } = handle.props;

		return (
			<div>
				<form method="post" action={routes.actions.alert.create.href({ team: team.slug })}>
					<AlertFormFields monitors={monitors} />
					<Button type="submit">Create alert</Button>
				</form>
			</div>
		);
	};
}
