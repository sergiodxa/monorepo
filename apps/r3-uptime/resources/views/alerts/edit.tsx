/**
 * Edit alert page: settings form, posting to `update-alert`, plus a delete-confirmation
 * dialog.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import type { SelectAlert, SelectMonitor } from "~/database/schema";

import * as s from "~/resources/styles";
import AlertFormFields from "~/resources/views/alerts/form";
import routes from "~/routes/web";

namespace EditAlertView {
	export interface Props {
		team: { slug: string };
		alert: SelectAlert;
		monitors: SelectMonitor[];
	}
}

export default function EditAlertView(handle: Handle<EditAlertView.Props>) {
	return () => {
		let { team, alert, monitors } = handle.props;

		return (
			<div>
				<h1>Edit alert</h1>
				<form method="post" action={routes.actions.updateAlert.href({ team: team.slug })}>
					<input type="hidden" name="alert_id" value={alert.id} />
					<AlertFormFields alert={alert} monitors={monitors} />
					<button type="submit" mix={[s.buttonPrimary]}>
						Save changes
					</button>
				</form>

				<a href={routes.app.team.alerts.href({ team: team.slug })} mix={[s.link]}>
					Cancel
				</a>

				<h2>Danger zone</h2>
				<button type="button" commandfor="delete-alert" command="show-modal" mix={[s.buttonDanger]}>
					Delete alert
				</button>
				<dialog id="delete-alert" mix={[s.dialog]}>
					<h3>Delete this alert?</h3>
					<p mix={[s.mutedSmall]}>This can't be undone.</p>
					<form method="post" action={routes.actions.deleteAlert.href({ team: team.slug })}>
						<input type="hidden" name="alert_id" value={alert.id} />
						<button
							type="button"
							commandfor="delete-alert"
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
