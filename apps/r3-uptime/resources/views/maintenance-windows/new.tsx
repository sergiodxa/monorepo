/**
 * New maintenance-window form page. Posts to the `create-maintenance-window` action.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import type { SelectMonitor } from "~/database/schema";

import Button from "~/resources/components/button";
import MaintenanceWindowFormFields from "~/resources/views/maintenance-windows/form";
import routes from "~/routes/web";

namespace NewMaintenanceWindowView {
	export interface Props {
		team: { slug: string };
		monitors: SelectMonitor[];
	}
}

/** Renders the empty maintenance-window form for scheduling a new window. */
export default function NewMaintenanceWindowView(handle: Handle<NewMaintenanceWindowView.Props>) {
	return () => {
		let { team, monitors } = handle.props;

		return (
			<div>
				<form
					method="post"
					action={routes.actions.maintenanceWindow.create.href({ team: team.slug })}
				>
					<MaintenanceWindowFormFields monitors={monitors} />
					<Button type="submit">Create maintenance window</Button>
				</form>
			</div>
		);
	};
}
