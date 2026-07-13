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
import { danger, neutral, primary } from "~/resources/theme";
import MaintenanceWindowFormFields from "~/resources/views/maintenance-windows/form";
import routes from "~/routes/web";

namespace EditMaintenanceWindowView {
	export interface Props {
		team: { slug: string };
		window: SelectMaintenanceWindow;
		monitors: SelectMonitor[];
	}
}

/** Secondary (outline) button/link. Reused twice below. */
const buttonSecondary = css({
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	padding: "8px 16px",
	borderRadius: 6,
	border: `2px solid ${neutral[300]}`,
	background: "#ffffff",
	color: neutral[500],
	fontFamily: "inherit",
	fontSize: "0.875rem",
	fontWeight: 500,
	cursor: "pointer",
	textDecoration: "none",
	"&:hover": { background: neutral[50] },
	"@media (prefers-color-scheme: dark)": {
		background: neutral[900],
		color: neutral[400],
		borderColor: neutral[700],
		"&:hover": { background: neutral[800] },
	},
});

/** Destructive action button. Reused twice below. */
const buttonDanger = css({
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	padding: "8px 16px",
	borderRadius: 6,
	border: "1px solid transparent",
	background: danger[600],
	color: "#ffffff",
	fontFamily: "inherit",
	fontSize: "0.875rem",
	fontWeight: 500,
	cursor: "pointer",
	textDecoration: "none",
	"&:hover": { background: danger[700] },
});

export default function EditMaintenanceWindowView(handle: Handle<EditMaintenanceWindowView.Props>) {
	return () => {
		let { team, window, monitors } = handle.props;
		let isActive =
			window.ended_early_at === null && MaintenanceWindow.isActiveAt(window, Date.now());

		return (
			<div>
				<form
					method="post"
					action={routes.actions.updateMaintenanceWindow.href({ team: team.slug })}
				>
					<input type="hidden" name="window_id" value={window.id} />
					<MaintenanceWindowFormFields window={window} monitors={monitors} />
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
								background: neutral[900],
								color: "#ffffff",
								fontFamily: "inherit",
								fontSize: "0.875rem",
								fontWeight: 500,
								cursor: "pointer",
								textDecoration: "none",
								"&:hover": { background: neutral[800] },
							}),
						]}
					>
						Save changes
					</button>
				</form>

				<a
					href={routes.app.team.maintenanceWindows.href({ team: team.slug })}
					mix={[
						css({
							color: primary[600],
							textDecoration: "none",
							"&:hover": { textDecoration: "underline" },
							"@media (prefers-color-scheme: dark)": { color: primary[400] },
						}),
					]}
				>
					Cancel
				</a>

				{isActive && (
					<form
						method="post"
						action={routes.actions.endMaintenanceWindow.href({ team: team.slug })}
					>
						<input type="hidden" name="window_id" value={window.id} />
						<button type="submit" mix={[buttonSecondary]}>
							End maintenance now
						</button>
					</form>
				)}

				<h2>Danger zone</h2>
				<button
					type="button"
					commandfor="delete-maintenance-window"
					command="show-modal"
					mix={[buttonDanger]}
				>
					Delete maintenance window
				</button>
				<dialog
					id="delete-maintenance-window"
					mix={[
						css({
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
						}),
					]}
				>
					<h3>Delete this maintenance window?</h3>
					<p
						mix={[
							css({
								fontSize: "0.8125rem",
								color: neutral[500],
								"@media (prefers-color-scheme: dark)": { color: neutral[400] },
							}),
						]}
					>
						This can't be undone.
					</p>
					<form
						method="post"
						action={routes.actions.deleteMaintenanceWindow.href({ team: team.slug })}
					>
						<input type="hidden" name="_method" value="DELETE" />
						<input type="hidden" name="window_id" value={window.id} />
						<button
							type="button"
							commandfor="delete-maintenance-window"
							command="close"
							mix={[buttonSecondary]}
						>
							Cancel
						</button>
						<button type="submit" mix={[buttonDanger]}>
							Delete
						</button>
					</form>
				</dialog>
			</div>
		);
	};
}
