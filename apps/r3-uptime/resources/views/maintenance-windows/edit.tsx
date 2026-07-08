/**
 * Edit maintenance-window page: settings form, posting to `update-maintenance-window`,
 * an "end early" action when the window is currently active, and delete.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import type { SelectMaintenanceWindow, SelectMonitor } from "~/database/schema";

import MaintenanceWindow from "~/app/data/maintenance-window";
import * as s from "~/resources/styles";
import MaintenanceWindowFormFields from "~/resources/views/maintenance-windows/form";
import routes from "~/routes/web";

namespace EditMaintenanceWindowView {
	export interface Props {
		team: { slug: string };
		window: SelectMaintenanceWindow;
		monitors: SelectMonitor[];
	}
}

export default function EditMaintenanceWindowView(handle: Handle<EditMaintenanceWindowView.Props>) {
	return () => {
		let { team, window, monitors } = handle.props;
		let isActive =
			window.ended_early_at === null && MaintenanceWindow.isActiveAt(window, Date.now());

		return (
			<div>
				<h1>Edit maintenance window</h1>
				<form
					method="post"
					action={routes.actions.updateMaintenanceWindow.href({ team: team.slug })}
				>
					<input type="hidden" name="window_id" value={window.id} />
					<MaintenanceWindowFormFields window={window} monitors={monitors} />
					<button type="submit" mix={[s.buttonPrimary]}>
						Save changes
					</button>
				</form>

				<a href={routes.app.team.maintenanceWindows.href({ team: team.slug })} mix={[s.link]}>
					Cancel
				</a>

				{isActive && (
					<form
						method="post"
						action={routes.actions.endMaintenanceWindow.href({ team: team.slug })}
					>
						<input type="hidden" name="window_id" value={window.id} />
						<button type="submit" mix={[s.buttonSecondary]}>
							End maintenance now
						</button>
					</form>
				)}

				<h2>Danger zone</h2>
				<button
					type="button"
					commandfor="delete-maintenance-window"
					command="show-modal"
					mix={[s.buttonDanger]}
				>
					Delete maintenance window
				</button>
				<dialog id="delete-maintenance-window" mix={[s.dialog]}>
					<h3>Delete this maintenance window?</h3>
					<p mix={[s.mutedSmall]}>This can't be undone.</p>
					<form
						method="post"
						action={routes.actions.deleteMaintenanceWindow.href({ team: team.slug })}
					>
						<input type="hidden" name="window_id" value={window.id} />
						<button
							type="button"
							commandfor="delete-maintenance-window"
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
