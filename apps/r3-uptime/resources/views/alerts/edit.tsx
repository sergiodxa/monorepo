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

import AlertFormFields from "~/resources/views/alerts/form";
import routes from "~/routes/web";

namespace EditAlertView {
	export interface Props {
		team: { slug: string };
		alert: SelectAlert;
		monitors: SelectMonitor[];
	}
}

const neutral = {
	50: "oklch(0.98 0.005 145)",
	300: "oklch(0.83 0.01 145)",
	400: "oklch(0.73 0.01 145)",
	500: "oklch(0.62 0.01 145)",
	700: "oklch(0.42 0.008 145)",
	800: "oklch(0.32 0.006 145)",
	900: "oklch(0.24 0.005 145)",
} as const;

const primary = {
	400: "oklch(0.78 0.16 142)",
	600: "oklch(0.6 0.16 142)",
} as const;

const danger = {
	600: "oklch(0.58 0.18 25)",
	700: "oklch(0.48 0.16 25)",
} as const;

export default function EditAlertView(handle: Handle<EditAlertView.Props>) {
	return () => {
		let { team, alert, monitors } = handle.props;

		return (
			<div>
				<h1>Edit alert</h1>
				<form method="post" action={routes.actions.updateAlert.href({ team: team.slug })}>
					<input type="hidden" name="alert_id" value={alert.id} />
					<AlertFormFields alert={alert} monitors={monitors} />
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
					href={routes.app.team.alerts.href({ team: team.slug })}
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

				<h2>Danger zone</h2>
				<button
					type="button"
					commandfor="delete-alert"
					command="show-modal"
					mix={[
						css({
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
						}),
					]}
				>
					Delete alert
				</button>
				<dialog
					id="delete-alert"
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
					<h3>Delete this alert?</h3>
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
					<form method="post" action={routes.actions.deleteAlert.href({ team: team.slug })}>
						<input type="hidden" name="alert_id" value={alert.id} />
						<button
							type="button"
							commandfor="delete-alert"
							command="close"
							mix={[
								css({
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
								}),
							]}
						>
							Cancel
						</button>
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
									background: danger[600],
									color: "#ffffff",
									fontFamily: "inherit",
									fontSize: "0.875rem",
									fontWeight: 500,
									cursor: "pointer",
									textDecoration: "none",
									"&:hover": { background: danger[700] },
								}),
							]}
						>
							Delete
						</button>
					</form>
				</dialog>
			</div>
		);
	};
}
