/**
 * HTTP monitors list page. Renders every monitor for the team with its 24h health
 * badge, or an empty state when there are none yet. It exists as the overview of a
 * team's HTTP uptime checks.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { css } from "remix/ui";

import type { MonitorHealth } from "~/app/services/analytics";
import type { SelectMonitor } from "~/database/schema";
import type { BadgeTone } from "~/resources/components/badge";

import Badge from "~/resources/components/badge";
import EmptyState from "~/resources/components/empty-state";
import routes from "~/routes/web";

namespace HttpMonitorsView {
	export interface Row {
		monitor: SelectMonitor;
		health: MonitorHealth;
	}

	export interface Props {
		team: { slug: string };
		rows: Row[];
	}
}

const neutral = {
	200: "oklch(0.91 0.008 145)",
	800: "oklch(0.32 0.006 145)",
	900: "oklch(0.24 0.005 145)",
} as const;

const primary = {
	400: "oklch(0.78 0.16 142)",
	600: "oklch(0.6 0.16 142)",
} as const;

const HEALTH_BADGE_TONE: Record<MonitorHealth, BadgeTone> = {
	up: "up",
	degraded: "degraded",
	down: "down",
	pending: "neutral",
};

export default function HttpMonitorsView(handle: Handle<HttpMonitorsView.Props>) {
	return () => {
		let { team, rows } = handle.props;

		return (
			<div>
				<div mix={[css({ display: "flex", alignItems: "center", gap: 12 })]}>
					<h1>HTTP monitors</h1>
					<a
						href={routes.app.team.monitorNew.href({ team: team.slug })}
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
						New monitor
					</a>
				</div>

				{rows.length === 0 ? (
					<EmptyState
						message="No monitors yet."
						action={{
							href: routes.app.team.monitorNew.href({ team: team.slug }),
							label: "Create your first monitor",
						}}
					/>
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
								</tr>
							</thead>
							<tbody>
								{rows.map(({ monitor, health }) => (
									<tr key={monitor.id}>
										<td>
											<a
												href={routes.app.team.monitorShow.href({
													team: team.slug,
													monitorId: monitor.id,
												})}
												mix={[
													css({
														color: primary[600],
														textDecoration: "none",
														"&:hover": { textDecoration: "underline" },
														"@media (prefers-color-scheme: dark)": { color: primary[400] },
													}),
												]}
											>
												{monitor.name}
											</a>
										</td>
										<td>
											<code>{monitor.url}</code>
										</td>
										<td>
											<Badge tone={HEALTH_BADGE_TONE[health]}>{health}</Badge>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</div>
		);
	};
}
