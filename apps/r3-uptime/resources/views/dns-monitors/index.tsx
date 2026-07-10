/**
 * DNS monitors list page. Renders every DNS monitor for the team with its last-known
 * status, or an empty state when there are none yet.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { css } from "remix/ui";

import type { SelectDnsMonitor } from "~/database/schema";
import type { BadgeTone } from "~/resources/components/badge";

import Badge from "~/resources/components/badge";
import EmptyState from "~/resources/components/empty-state";
import routes from "~/routes/web";

namespace DnsMonitorsView {
	export interface Props {
		team: { slug: string };
		monitors: SelectDnsMonitor[];
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

const STATUS_BADGE_TONE: Record<string, BadgeTone> = {
	ok: "up",
	changed: "degraded",
	error: "down",
};

export default function DnsMonitorsView(handle: Handle<DnsMonitorsView.Props>) {
	return () => {
		let { team, monitors } = handle.props;

		return (
			<div>
				<div mix={[css({ display: "flex", alignItems: "center", gap: 12 })]}>
					<h1 mix={[css({ margin: "0 0 24px" })]}>DNS monitors</h1>
					<a
						href={routes.app.team.dnsMonitorNew.href({ team: team.slug })}
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
						New DNS monitor
					</a>
				</div>

				{monitors.length === 0 ? (
					<EmptyState
						message="No DNS monitors yet."
						action={{
							href: routes.app.team.dnsMonitorNew.href({ team: team.slug }),
							label: "Create your first DNS monitor",
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
									<th>Domain</th>
									<th>Record type</th>
									<th>Status</th>
								</tr>
							</thead>
							<tbody>
								{monitors.map((monitor) => (
									<tr key={monitor.id}>
										<td>
											<a
												href={routes.app.team.dnsMonitorShow.href({
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
											{!monitor.is_enabled && <Badge tone="neutral">Disabled</Badge>}
										</td>
										<td>
											<code>{monitor.domain}</code>
										</td>
										<td>{monitor.record_type}</td>
										<td>
											<Badge tone={STATUS_BADGE_TONE[monitor.last_status ?? ""] ?? "neutral"}>
												{monitor.last_status ?? "not checked"}
											</Badge>
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
