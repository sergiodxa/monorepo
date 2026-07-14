/**
 * Edit maintenance-window page: settings form, posting to `update-maintenance-window`,
 * an "end early" action when the window is currently active, and delete.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { css } from "remix/ui";

import type { SelectMaintenanceWindow, SelectMonitor } from "~/database/schema";

import MaintenanceWindow from "~/app/data/maintenance-window";
import Button from "~/resources/components/button";
import { neutral, primary } from "~/resources/theme";
import MaintenanceWindowFormFields from "~/resources/views/maintenance-windows/form";
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

namespace EditMaintenanceWindowView {
	export interface Props {
		team: { slug: string };
		window: SelectMaintenanceWindow;
		monitors: SelectMonitor[];
	}
}

/** Renders the maintenance-window form pre-filled with the current values, an "end maintenance now" action shown only while the window is currently active, and a delete-confirmation dialog. */
export default function EditMaintenanceWindowView(handle: Handle<EditMaintenanceWindowView.Props>) {
	return () => {
		let { team, window, monitors } = handle.props;
		let isActive =
			window.ended_early_at === null && MaintenanceWindow.isActiveAt(window, Date.now());

		return (
			<div>
				<form
					method="post"
					action={routes.actions.maintenanceWindow.update.href({ team: team.slug })}
				>
					<input type="hidden" name="window_id" value={window.id} />
					<MaintenanceWindowFormFields window={window} monitors={monitors} />
					<Button type="submit">Save changes</Button>
				</form>

				<a
					href={routes.app.team.maintenanceWindows.index.href({ team: team.slug })}
					mix={[cancelLink]}
				>
					Cancel
				</a>

				{isActive && (
					<form
						method="post"
						action={routes.actions.maintenanceWindow.end.href({ team: team.slug })}
					>
						<input type="hidden" name="window_id" value={window.id} />
						<Button type="submit" variant="outline">
							End maintenance now
						</Button>
					</form>
				)}

				<h2>Danger zone</h2>
				<Button
					type="button"
					color="danger"
					commandfor="delete-maintenance-window"
					command="show-modal"
				>
					Delete maintenance window
				</Button>
				<dialog id="delete-maintenance-window" mix={[dialog]}>
					<h3>Delete this maintenance window?</h3>
					<p mix={[dialogText]}>This can't be undone.</p>
					<form
						method="post"
						action={routes.actions.maintenanceWindow.delete.href({ team: team.slug })}
					>
						<input type="hidden" name="_method" value="DELETE" />
						<input type="hidden" name="window_id" value={window.id} />
						<Button
							type="button"
							variant="outline"
							commandfor="delete-maintenance-window"
							command="close"
						>
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
