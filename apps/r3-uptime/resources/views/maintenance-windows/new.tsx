/**
 * New maintenance-window form page. Posts to the `create-maintenance-window` action.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import type { SelectMonitor } from "~/database/schema";

import * as s from "~/resources/styles";
import MaintenanceWindowFormFields from "~/resources/views/maintenance-windows/form";
import routes from "~/routes/web";

namespace NewMaintenanceWindowView {
	export interface Props {
		team: { slug: string };
		monitors: SelectMonitor[];
	}
}

export default function NewMaintenanceWindowView(handle: Handle<NewMaintenanceWindowView.Props>) {
	return () => {
		let { team, monitors } = handle.props;

		return (
			<div>
				<h1>New maintenance window</h1>
				<form
					method="post"
					action={routes.actions.createMaintenanceWindow.href({ team: team.slug })}
				>
					<MaintenanceWindowFormFields monitors={monitors} />
					<button type="submit" mix={[s.buttonPrimary]}>
						Create maintenance window
					</button>
				</form>
			</div>
		);
	};
}
