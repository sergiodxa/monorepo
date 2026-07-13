/**
 * Edit HTTP monitor page: general settings form (posts to `update-monitor`), the
 * content-checks section, and the SSL monitoring settings form. It exists so a team
 * can adjust an existing monitor's configuration and checks.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { css } from "remix/ui";

import type { SelectMonitor, SelectMonitorContentCheck } from "~/database/schema";

import { danger, neutral, primary } from "~/resources/theme";
import ContentChecksSection from "~/resources/views/monitors/content-checks";
import MonitorFormFields from "~/resources/views/monitors/form";
import SslForm from "~/resources/views/monitors/ssl-form";
import routes from "~/routes/web";

namespace EditMonitorView {
	export interface Props {
		team: { slug: string };
		monitor: SelectMonitor;
		contentChecks: SelectMonitorContentCheck[];
	}
}

/** Renders the general-settings form pre-filled with the current values, followed by the content-checks section, the SSL monitoring form, and a delete-confirmation dialog. */
export default function EditMonitorView(handle: Handle<EditMonitorView.Props>) {
	return () => {
		let { team, monitor, contentChecks } = handle.props;

		return (
			<div>
				<form method="post" action={routes.actions.monitor.http.update.href({ team: team.slug })}>
					<input type="hidden" name="monitor_id" value={monitor.id} />
					<MonitorFormFields monitor={monitor} />
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
						Save changes
					</button>
				</form>

				<a
					href={routes.app.team.monitors.show.href({ team: team.slug, monitorId: monitor.id })}
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

				<ContentChecksSection team={team} monitorId={monitor.id} contentChecks={contentChecks} />

				<SslForm team={team} monitor={monitor} />

				<h2>Danger zone</h2>
				<button
					type="button"
					commandfor="delete-monitor"
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
					Delete monitor
				</button>
				<dialog
					id="delete-monitor"
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
					<h3>Delete this monitor?</h3>
					<p
						mix={[
							css({
								fontSize: "0.8125rem",
								color: neutral[500],
								"@media (prefers-color-scheme: dark)": { color: neutral[400] },
							}),
						]}
					>
						This also deletes its content checks and check-result history. This can't be undone.
					</p>
					<form method="post" action={routes.actions.monitor.http.delete.href({ team: team.slug })}>
						<input type="hidden" name="_method" value="DELETE" />
						<input type="hidden" name="monitor_id" value={monitor.id} />
						<button
							type="button"
							commandfor="delete-monitor"
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
