/**
 * The services table as an island: typed cells, a sparkline and a 30-day strip per row, hover
 * actions and selection, walked from the keyboard with j/k, x and Enter, and Space opening the
 * focused row's peek sheet. Every string and address arrives precomputed from the server.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RowNavigation, StatusStrip as StatusStripTypes } from "@sdxc/ui/app";
import type { Handle } from "remix/component";

import { PauseIcon, PencilIcon, PlayIcon, TrashIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { minIs } from "@sdxc/u/size";
import { font, nowrap } from "@sdxc/u/typography";
import { Button, LinkButton } from "@sdxc/ui";
import { rowNavigation } from "@sdxc/ui/app";
import { Sparkline } from "@sdxc/ui/app/sparkline";
import { StatusStrip } from "@sdxc/ui/app/status-strip";
import { Table } from "@sdxc/ui/app/table";
import { clientEntry, on } from "remix/component";

import { sparklineDomain } from "./metrics";

/** One service as the table draws it, every string already written. */
export interface ServiceRow {
	id: string;
	name: string;
	href: string;
	peekHref: string;
	editHref: string;
	/** Where Pause or Resume posts, whichever the row offers. */
	toggleAction: string;
	deleteAction: string;
	paused: boolean;
	status: { label: string; color: "success" | "warning" | "danger" | "neutral" };
	latencyMs: number | null;
	latency: (number | null)[];
	trend: {
		label: string;
		tone: "brand" | "neutral" | "success" | "warning" | "danger";
		aria: string;
	};
	periods: StatusStripTypes.Period[];
	stripLabel: string;
	stripSummary: string;
	checkedAt: string;
	selectLabel: string;
	/** Marks the row whose peek sheet is open. */
	peeked: boolean;
	/** The list page, with its query, that the row's forms return to. */
	next: string;
}

/** A sortable column header: the link that sorts by it, and its direction while it does. */
export interface SortLink {
	href: string;
	direction?: "ascending" | "descending";
}

/** The table's own strings. */
export interface ServicesTableLabels {
	table: string;
	selectAll: string;
	columns: Record<
		"name" | "status" | "latency" | "trend" | "uptime" | "checked" | "actions",
		string
	>;
	pause: string;
	resume: string;
	edit: string;
	delete: string;
	keys: RowNavigation.Labels;
}

namespace ServicesTable {
	export interface Props {
		rows: ServiceRow[];
		density: "compact" | "comfortable";
		/** The bulk form every selection checkbox submits with. */
		form: string;
		sort: Record<"name" | "status" | "latency" | "checked", SortLink>;
		now: string;
		locale: string;
		labels: ServicesTableLabels;
	}
}

/**
 * Renders the services table and opens a row's peek sheet when Space asks for it, by going to
 * the address that row's sheet lives at, so the open sheet is always a link.
 */
export const ServicesTable = clientEntry(
	import.meta.url,
	function ServicesTable(handle: Handle<ServicesTable.Props>) {
		return () => {
			let { rows, density, form, sort, now, locale, labels } = handle.props;
			return (
				<Table.Container>
					<Table
						aria-label={labels.table}
						density={density}
						pinFirstColumn
						mix={[
							rowNavigation({ peek: true, labels: labels.keys }),
							on("ui:row-peek", (event) => {
								let target = event.row.dataset.peekHref;
								if (target !== undefined) window.location.assign(target);
							}),
						]}
					>
						<Table.Header>
							<Table.Row>
								<Table.SelectAll label={labels.selectAll} />
								<Table.Column href={sort.name.href} sortDirection={sort.name.direction}>
									{labels.columns.name}
								</Table.Column>
								<Table.Column href={sort.status.href} sortDirection={sort.status.direction}>
									{labels.columns.status}
								</Table.Column>
								<Table.Column
									numeric
									href={sort.latency.href}
									sortDirection={sort.latency.direction}
								>
									{labels.columns.latency}
								</Table.Column>
								<Table.Column>{labels.columns.trend}</Table.Column>
								<Table.Column>{labels.columns.uptime}</Table.Column>
								<Table.Column href={sort.checked.href} sortDirection={sort.checked.direction}>
									{labels.columns.checked}
								</Table.Column>
								<Table.ActionsColumn label={labels.columns.actions} />
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{rows.map((row) => (
								<Table.Row
									key={row.id}
									data-peek-href={row.peekHref}
									aria-current={row.peeked ? "true" : undefined}
								>
									<Table.Select name="service" value={row.id} form={form} label={row.selectLabel} />
									<Table.Cell>
										<Table.RowLink
											data-rmx-prefetch="intent"
											href={row.href}
											mix={[font("mono"), nowrap()]}
										>
											{row.name}
										</Table.RowLink>
									</Table.Cell>
									<Table.StatusCell color={row.status.color} pulse={row.status.color === "danger"}>
										{row.status.label}
									</Table.StatusCell>
									<Table.NumberCell
										value={row.latencyMs}
										locale={locale}
										format={{ style: "unit", unit: "millisecond" }}
										mix={[font("mono"), nowrap()]}
									/>
									<Table.Cell mix={[raw({ minInlineSize: "10rem" })]}>
										<Sparkline
											values={row.latency}
											domain={sparklineDomain(row.latency)}
											label={row.trend.aria}
											tone={row.trend.tone}
											state={row.trend.label}
										/>
									</Table.Cell>
									<Table.Cell mix={[minIs("14rem")]}>
										<StatusStrip
											label={`${row.stripLabel}, ${row.stripSummary}`}
											periods={row.periods}
										/>
									</Table.Cell>
									<Table.DateCell date={row.checkedAt} now={now} locale={locale} />
									<Table.Actions>
										<form method="post" action={row.toggleAction}>
											<input type="hidden" name="next" value={row.next} />
											<Button type="submit" size="sm" variant="ghost" color="neutral">
												{row.paused ? <PlayIcon size={14} /> : <PauseIcon size={14} />}
												{row.paused ? labels.resume : labels.pause}
											</Button>
										</form>
										<LinkButton href={row.editHref} size="sm" variant="ghost" color="neutral">
											<PencilIcon size={14} />
											{labels.edit}
										</LinkButton>
										<form method="post" action={row.deleteAction}>
											<input type="hidden" name="next" value={row.next} />
											<Button type="submit" size="sm" variant="ghost" color="danger">
												<TrashIcon size={14} />
												{labels.delete}
											</Button>
										</form>
									</Table.Actions>
								</Table.Row>
							))}
						</Table.Body>
					</Table>
				</Table.Container>
			);
		};
	},
);
