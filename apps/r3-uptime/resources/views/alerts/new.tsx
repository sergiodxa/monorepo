/**
 * New alert form page. Posts to the `create-alert` action.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import type { SelectMonitor } from "~/database/schema";

import * as s from "~/resources/styles";
import AlertFormFields from "~/resources/views/alerts/form";
import routes from "~/routes/web";

namespace NewAlertView {
	export interface Props {
		team: { slug: string };
		monitors: SelectMonitor[];
	}
}

export default function NewAlertView(handle: Handle<NewAlertView.Props>) {
	return () => {
		let { team, monitors } = handle.props;

		return (
			<div>
				<h1>New alert</h1>
				<form method="post" action={routes.actions.createAlert.href({ team: team.slug })}>
					<AlertFormFields monitors={monitors} />
					<button type="submit" mix={[s.buttonPrimary]}>
						Create alert
					</button>
				</form>
			</div>
		);
	};
}
