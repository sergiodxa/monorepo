/**
 * Pulse's incidents: count tabs for open and resolved, each row naming its service and how
 * long it ran, and an "All caught up" view for the incidents assigned to the visitor, which
 * holds none, so the cleared state is one click away.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { vstack } from "@sdxc/u/layout";
import { minIs } from "@sdxc/u/size";
import { font } from "@sdxc/u/typography";
import { Badge, HeadingScope } from "@sdxc/ui";
import { Empty } from "@sdxc/ui/app/empty";
import { FilterBar } from "@sdxc/ui/app/filter-bar";
import { PageHeader } from "@sdxc/ui/app/page-header";
import { Table } from "@sdxc/ui/app/table";

import type { DemoAppRequest } from "~/resources/views/demo-apps";

import type { Incident } from "./data";

import { findService, href, INCIDENTS, LOCALE, NOW, withoutToast } from "./data";
import { COPY, FILTER_LABELS, INCIDENT_STATUS } from "./labels";
import { pick } from "./overview";

/** The slices the tabs offer. */
type IncidentView = "open" | "resolved" | "mine";

/** The incidents each tab holds; the visitor commands none of the open ones. */
function incidentsIn(view: IncidentView): Incident[] {
	if (view === "resolved") return INCIDENTS.filter((incident) => incident.status === "resolved");
	if (view === "mine") return [];
	return INCIDENTS.filter((incident) => incident.status !== "resolved");
}

/** How long an incident ran, or "Ongoing" while it is open. */
function duration(incident: Incident): string {
	if (incident.resolvedAt === null) return COPY.incidents.ongoing;
	let minutes = Math.round(
		(Date.parse(incident.resolvedAt) - Date.parse(incident.startedAt)) / 60_000,
	);
	return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

/** The tone each severity's badge draws in. */
const SEVERITY_COLOR = { SEV1: "danger", SEV2: "warning", SEV3: "neutral" } as const;

namespace Incidents {
	export interface Props {
		request: DemoAppRequest;
	}
}

/** The incidents screen's content, under the frame. */
export default function Incidents(handle: Handle<Incidents.Props>) {
	return () => {
		let url = withoutToast(handle.props.request.url);
		let view = pick<IncidentView>(url, "view", ["open", "resolved", "mine"], "open");
		let rows = incidentsIn(view);
		let tabHref = (id: IncidentView) => href(id === "open" ? "incidents" : `incidents?view=${id}`);

		return (
			<div mix={[vstack({ gap: 4, align: "stretch" }), minIs(0)]}>
				<PageHeader title={COPY.incidents.title} description={COPY.incidents.description} />
				<HeadingScope level={2}>
					<FilterBar
						id="pulse-incidents"
						url={url}
						locale={LOCALE}
						tabs={(["open", "resolved", "mine"] as const).map((id) => ({
							label: COPY.incidents[id],
							count: incidentsIn(id).length,
							href: tabHref(id),
							current: id === view,
						}))}
						labels={{ ...FILTER_LABELS, tabs: COPY.incidents.tabs }}
					/>
					{rows.length === 0 ? (
						<Empty kind="cleared" size="compact">
							<Empty.Title>{COPY.incidents.cleared}</Empty.Title>
							<Empty.Description>{COPY.incidents.clearedHint}</Empty.Description>
						</Empty>
					) : (
						<Table.Container>
							<Table aria-label={COPY.incidents.table} density="compact" pinFirstColumn>
								<Table.Header>
									<Table.Row>
										<Table.Column>{COPY.incidents.columns.id}</Table.Column>
										<Table.Column>{COPY.incidents.columns.title}</Table.Column>
										<Table.Column>{COPY.incidents.columns.service}</Table.Column>
										<Table.Column>{COPY.incidents.columns.severity}</Table.Column>
										<Table.Column>{COPY.incidents.columns.status}</Table.Column>
										<Table.Column sortDirection="descending">
											{COPY.incidents.columns.started}
										</Table.Column>
										<Table.Column numeric>{COPY.incidents.columns.duration}</Table.Column>
									</Table.Row>
								</Table.Header>
								<Table.Body>
									{rows.map((incident) => (
										<Table.Row key={incident.id}>
											<Table.Cell mix={[font("mono")]}>{incident.id}</Table.Cell>
											<Table.Cell>
												<Table.RowLink href={href(`services/${incident.service}?tab=incidents`)}>
													{incident.title}
												</Table.RowLink>
											</Table.Cell>
											<Table.Cell mix={[font("mono")]}>
												{findService(incident.service)?.name ?? incident.service}
											</Table.Cell>
											<Table.Cell>
												<Badge color={SEVERITY_COLOR[incident.severity]} variant="secondary">
													{incident.severity}
												</Badge>
											</Table.Cell>
											<Table.StatusCell color={INCIDENT_STATUS[incident.status].color}>
												{INCIDENT_STATUS[incident.status].label}
											</Table.StatusCell>
											<Table.DateCell date={incident.startedAt} now={NOW} locale={LOCALE} />
											<Table.Cell numeric mix={[font("mono")]}>
												{duration(incident)}
											</Table.Cell>
										</Table.Row>
									))}
								</Table.Body>
							</Table>
						</Table.Container>
					)}
				</HeadingScope>
			</div>
		);
	};
}
