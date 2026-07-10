/**
 * Edit status-page page: settings + attached-service form posting to
 * `update-status-page`, and delete.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { css } from "remix/ui";

import type { StatusPageAttachedIds } from "~/app/data/status-page";
import type {
	SelectCronJobMonitor,
	SelectDnsMonitor,
	SelectMonitor,
	SelectStatusPage,
	SelectTcpMonitor,
} from "~/database/schema";

import StatusPageFormFields from "~/resources/views/status-pages/form";
import routes from "~/routes/web";

namespace EditStatusPageView {
	export interface Props {
		team: { slug: string };
		page: SelectStatusPage;
		monitors: SelectMonitor[];
		dnsMonitors: SelectDnsMonitor[];
		tcpMonitors: SelectTcpMonitor[];
		cronJobs: SelectCronJobMonitor[];
		attachedIds: StatusPageAttachedIds;
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

/** Destructive action button, matching the OLD APP's "Delete Team" button. Reused twice below. */
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

export default function EditStatusPageView(handle: Handle<EditStatusPageView.Props>) {
	return () => {
		let { team, page, monitors, dnsMonitors, tcpMonitors, cronJobs, attachedIds } = handle.props;

		return (
			<div>
				<h1>Edit status page</h1>
				<form method="post" action={routes.actions.updateStatusPage.href({ team: team.slug })}>
					<input type="hidden" name="status_page_id" value={page.id} />
					<StatusPageFormFields
						page={page}
						monitors={monitors}
						dnsMonitors={dnsMonitors}
						tcpMonitors={tcpMonitors}
						cronJobs={cronJobs}
						attachedMonitorIds={attachedIds.monitorIds}
						attachedDnsMonitorIds={attachedIds.dnsMonitorIds}
						attachedTcpMonitorIds={attachedIds.tcpMonitorIds}
						attachedCronJobIds={attachedIds.cronJobIds}
					/>
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
					href={routes.app.team.statusPages.href({ team: team.slug })}
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
					commandfor="delete-status-page"
					command="show-modal"
					mix={[buttonDanger]}
				>
					Delete status page
				</button>
				<dialog
					id="delete-status-page"
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
					<h3>Delete this status page?</h3>
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
					<form method="post" action={routes.actions.deleteStatusPage.href({ team: team.slug })}>
						<input type="hidden" name="_method" value="DELETE" />
						<input type="hidden" name="status_page_id" value={page.id} />
						<button
							type="button"
							commandfor="delete-status-page"
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
						<button type="submit" mix={[buttonDanger]}>
							Delete
						</button>
					</form>
				</dialog>
			</div>
		);
	};
}
