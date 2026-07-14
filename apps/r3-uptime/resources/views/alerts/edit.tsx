/**
 * Edit alert page: settings form, posting to `update-alert`, plus a delete-confirmation
 * dialog.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { css } from "remix/ui";

import type { SelectAlert, SelectMonitor } from "~/database/schema";

import Button from "~/resources/components/button";
import { neutral, primary } from "~/resources/theme";
import AlertFormFields from "~/resources/views/alerts/form";
import routes from "~/routes/web";

const cancelLink = css({
	color: primary[600],
	textDecoration: "none",
	"&:hover": { textDecoration: "underline" },
	"@media (prefers-color-scheme: dark)": { color: primary[400] },
});

const dialog = css({
	padding: 24,
	borderRadius: 8,
	border: `1px solid ${neutral[300]}`,
	maxWidth: 400,
	"&::backdrop": { background: "rgba(0, 0, 0, 0.4)" },
	"@media (prefers-color-scheme: dark)": {
		borderColor: neutral[700],
		background: neutral[900],
		color: neutral[50],
	},
});

const dialogText = css({
	fontSize: "0.8125rem",
	color: neutral[500],
	"@media (prefers-color-scheme: dark)": { color: neutral[400] },
});

namespace EditAlertView {
	export interface Props {
		team: { slug: string };
		alert: SelectAlert;
		monitors: SelectMonitor[];
	}
}

/** Renders the alert form pre-filled with the current values, plus a delete-confirmation dialog gated behind a native `<dialog>`. */
export default function EditAlertView(handle: Handle<EditAlertView.Props>) {
	return () => {
		let { team, alert, monitors } = handle.props;

		return (
			<div>
				<form method="post" action={routes.actions.alert.update.href({ team: team.slug })}>
					<input type="hidden" name="alert_id" value={alert.id} />
					<AlertFormFields alert={alert} monitors={monitors} />
					<Button type="submit">Save changes</Button>
				</form>

				<a href={routes.app.team.alerts.index.href({ team: team.slug })} mix={[cancelLink]}>
					Cancel
				</a>

				<h2>Danger zone</h2>
				<Button type="button" color="danger" commandfor="delete-alert" command="show-modal">
					Delete alert
				</Button>
				<dialog id="delete-alert" mix={[dialog]}>
					<h3>Delete this alert?</h3>
					<p mix={[dialogText]}>This can't be undone.</p>
					<form method="post" action={routes.actions.alert.delete.href({ team: team.slug })}>
						<input type="hidden" name="_method" value="DELETE" />
						<input type="hidden" name="alert_id" value={alert.id} />
						<Button type="button" variant="outline" commandfor="delete-alert" command="close">
							Cancel
						</Button>
						<Button type="submit" color="danger">
							Delete
						</Button>
					</form>
				</dialog>
			</div>
		);
	};
}
