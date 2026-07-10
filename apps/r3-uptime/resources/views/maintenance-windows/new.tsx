/**
 * New maintenance-window form page. Posts to the `create-maintenance-window` action.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { css } from "remix/ui";

import type { SelectMonitor } from "~/database/schema";

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
				<h1 mix={[css({ margin: "0 0 24px" })]}>New maintenance window</h1>
				<form
					method="post"
					action={routes.actions.createMaintenanceWindow.href({ team: team.slug })}
				>
					<MaintenanceWindowFormFields monitors={monitors} />
					<button
						type="submit"
						mix={[
							css({
								display: "inline-flex",
								alignItems: "center",
								justifyContent: "center",
								padding: "8px 16px",
								borderRadius: 6,
								border: "1px solid transparent",
								background: "oklch(0.24 0.005 145)",
								color: "#ffffff",
								fontFamily: "inherit",
								fontSize: "0.875rem",
								fontWeight: 500,
								cursor: "pointer",
								textDecoration: "none",
								"&:hover": { background: "oklch(0.32 0.006 145)" },
							}),
						]}
					>
						Create maintenance window
					</button>
				</form>
			</div>
		);
	};
}
