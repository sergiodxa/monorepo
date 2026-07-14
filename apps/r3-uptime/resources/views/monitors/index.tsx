/**
 * HTTP monitors list page. Renders every monitor for the team with its derived
 * up/degraded/down/unknown status (from its single most recent result), response
 * time, last-checked time, and a per-row actions menu (view/edit/delete) — or an
 * empty state when there are none yet. It exists as the overview of a team's HTTP
 * uptime checks.
 *
 * The actions menu is `~/resources/components/monitor-row-actions.tsx`, a client
 * island built on `remix/ui/menu`'s `Menu`/`MenuItem` rather than a hand-rolled
 * `commandfor`/`[popover]` pair: a plain `position: absolute` popover panel can't
 * anchor to its own row once promoted to the top layer (confirmed empirically
 * against a real page here — its containing block becomes the viewport, not any
 * DOM ancestor, so every row's panel resolves to the same spot), but `Menu`'s
 * trigger positions its panel via `remix/ui/anchor`'s `anchor()`, which computes
 * pixel coordinates from the trigger's own `getBoundingClientRect()` in JS and
 * writes them onto the panel directly, sidestepping that problem entirely. See
 * that file's docblock for the full rationale and its JS/hydration requirements.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { MonitorIcon, PlusIcon } from "@pkg/lucide-remix";
import { css } from "remix/ui";

import type { MonitorStatus } from "~/app/services/analytics";
import type { SelectMonitor } from "~/database/schema";
import type { BadgeTone } from "~/resources/components/badge";

import Badge from "~/resources/components/badge";
import Button from "~/resources/components/button";
import {
	Empty,
	EmptyAction,
	EmptyDescription,
	EmptyIcon,
	EmptyTitle,
} from "~/resources/components/empty";
import LinkButton from "~/resources/components/link-button";
import MonitorRowActions from "~/resources/components/monitor-row-actions";
import { neutral, primary } from "~/resources/theme";
import routes from "~/routes/web";

namespace HttpMonitorsView {
	export interface Row {
		monitor: SelectMonitor;
		status: MonitorStatus;
		responseTimeMs: number | null;
		lastCheckedAt: string | null;
	}

	export interface Props {
		team: { slug: string };
		rows: Row[];
	}
}

const STATUS_BADGE_TONE: Record<MonitorStatus, BadgeTone> = {
	up: "up",
	degraded: "degraded",
	down: "down",
	unknown: "neutral",
};

const mutedText = css({
	color: neutral[500],
	"@media (prefers-color-scheme: dark)": { color: neutral[400] },
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

const dialogActions = css({ display: "flex", gap: 8, justifyContent: "flex-end" });

/** Renders the HTTP monitor table with each row's status, response time, last-checked time, and actions, or an empty state with a create CTA. */
export default function HttpMonitorsView(handle: Handle<HttpMonitorsView.Props>) {
	return () => {
		let { team, rows } = handle.props;

		return (
			<div>
				{rows.length === 0 ? (
					<Empty>
						<EmptyIcon>
							<MonitorIcon size={48} strokeWidth={1.5} />
						</EmptyIcon>
						<EmptyTitle>No HTTP monitors yet</EmptyTitle>
						<EmptyDescription>
							Create an HTTP monitor to start tracking your endpoints.
						</EmptyDescription>
						<EmptyAction>
							<LinkButton href={routes.app.team.monitors.new.href({ team: team.slug })}>
								<PlusIcon size={20} strokeWidth={1.5} />
								Create Monitor
							</LinkButton>
						</EmptyAction>
					</Empty>
				) : (
					<div mix={[css({ overflowX: "auto" })]}>
						<table
							mix={[
								css({
									width: "100%",
									borderCollapse: "collapse",
									fontSize: "0.875rem",
									"& th, & td": {
										textAlign: "left",
										padding: "12px 16px",
										borderBottom: `1px solid ${neutral[200]}`,
									},
									"@media (prefers-color-scheme: dark)": {
										"& th, & td": { borderColor: neutral[800] },
									},
								}),
							]}
						>
							<thead>
								<tr>
									<th>Name</th>
									<th>URL</th>
									<th>Status</th>
									<th>Response time</th>
									<th>Last checked</th>
									<th mix={[css({ textAlign: "right" })]}>
										<span
											mix={[
												css({
													position: "absolute",
													width: 1,
													height: 1,
													padding: 0,
													margin: -1,
													overflow: "hidden",
													clip: "rect(0, 0, 0, 0)",
													whiteSpace: "nowrap",
													border: 0,
												}),
											]}
										>
											Actions
										</span>
									</th>
								</tr>
							</thead>
							<tbody>
								{rows.map(({ monitor, status, responseTimeMs, lastCheckedAt }) => {
									let deleteDialogId = `delete-monitor-${monitor.id}`;

									return (
										<tr key={monitor.id}>
											<td>
												<a
													href={routes.app.team.monitors.show.href({
														team: team.slug,
														monitorId: monitor.id,
													})}
													mix={[
														css({
															fontWeight: 600,
															color: primary[600],
															textDecoration: "none",
															"&:hover": { textDecoration: "underline" },
															"@media (prefers-color-scheme: dark)": { color: primary[400] },
														}),
													]}
												>
													{monitor.name}
												</a>
												{monitor.enabled_at === null && <Badge tone="neutral">Disabled</Badge>}
											</td>
											<td>
												<code>{monitor.url}</code>
											</td>
											<td>
												<Badge tone={STATUS_BADGE_TONE[status]}>{status}</Badge>
											</td>
											<td>
												{responseTimeMs !== null ? (
													<span>{responseTimeMs}ms</span>
												) : (
													<span mix={[mutedText]}>-</span>
												)}
											</td>
											<td>
												{lastCheckedAt !== null ? (
													new Date(lastCheckedAt).toLocaleString()
												) : (
													<span mix={[mutedText]}>Never checked</span>
												)}
											</td>
											<td>
												<MonitorRowActions
													monitorName={monitor.name}
													viewHref={routes.app.team.monitors.show.href({
														team: team.slug,
														monitorId: monitor.id,
													})}
													editHref={routes.app.team.monitors.edit.href({
														team: team.slug,
														monitorId: monitor.id,
													})}
													deleteDialogId={deleteDialogId}
												/>

												<dialog id={deleteDialogId} mix={[dialog]}>
													<h3>Delete this monitor?</h3>
													<p mix={[dialogText]}>
														This also deletes its content checks and check-result history. This
														can't be undone.
													</p>
													<form
														method="post"
														action={routes.actions.monitor.http.delete.href({ team: team.slug })}
													>
														<input type="hidden" name="_method" value="DELETE" />
														<input type="hidden" name="monitor_id" value={monitor.id} />
														<div mix={[dialogActions]}>
															<Button
																type="button"
																variant="outline"
																commandfor={deleteDialogId}
																command="close"
															>
																Cancel
															</Button>
															<Button type="submit" color="danger">
																Delete
															</Button>
														</div>
													</form>
												</dialog>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>
				)}
			</div>
		);
	};
}
