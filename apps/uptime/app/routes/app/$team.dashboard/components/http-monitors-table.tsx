import { cn } from "@pkg/cn";
import { Empty, LinkButton, Table } from "@pkg/ui";
import { ActivityIcon, PlusIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { href } from "react-router";

import type { ResolvedType } from "~/types";

import type { getHttpMonitorsData } from "../query.server";

import { HttpMonitorTableRow } from "./http-monitor-table-row";

export function HttpMonitorsTable(props: {
	team: string;
	monitors: ResolvedType<typeof getHttpMonitorsData>["httpMonitors"];
}) {
	let { t } = useTranslation("translation", {
		keyPrefix: "page.dashboard.table",
	});
	let { t: tPage } = useTranslation("translation", {
		keyPrefix: "page.dashboard",
	});

	if (props.monitors.length === 0) {
		return (
			<Empty className="mx-auto max-w-md py-16">
				<Empty.Icon>
					<ActivityIcon className="size-12" />
				</Empty.Icon>
				<Empty.Title>{tPage("empty.title")}</Empty.Title>
				<Empty.Description>{tPage("empty.description")}</Empty.Description>
				<Empty.Action>
					<LinkButton href={href("/app/:team/monitors/new", { team: props.team })}>
						<PlusIcon className="size-5" aria-hidden />
						{tPage("empty.cta")}
					</LinkButton>
				</Empty.Action>
			</Empty>
		);
	}

	let showLastIncident = props.monitors.some((m) => m.lastIncident);

	let columns = [
		{
			id: "name" as const,
			name: t("columns.name"),
			align: "left" as const,
		},
		{
			id: "latencyChart" as const,
			name: t("columns.latencyChart"),
			align: "left" as const,
		},
		{
			id: "status" as const,
			name: t("columns.status"),
			align: "left" as const,
		},
		showLastIncident
			? {
					id: "lastIncident" as const,
					name: t("columns.lastIncident"),
					align: "right" as const,
				}
			: null,
		{
			id: "responseTime" as const,
			name: t("columns.responseTime"),
			align: "right" as const,
		},
		{
			id: "actions" as const,
			name: t("columns.actions"),
			align: "right" as const,
		},
	].filter(Boolean);

	return (
		<div className="-mx-5 w-[calc(100%+2.5rem)] overflow-x-auto px-5 md:mx-0 md:w-full md:px-0">
			<Table aria-label={t("label")} className="min-w-full">
				<Table.Header columns={columns}>
					{(column) => {
						return (
							<Table.Column align={column.align} isRowHeader={column.id === "name"}>
								<span
									className={cn({
										"sr-only": column.id === "actions",
										"max-lg:hidden": column.id === "latencyChart",
										"max-md:hidden": column.id === "lastIncident",
										"max-sm:hidden": column.id === "responseTime",
									})}
								>
									{column.name}
								</span>
							</Table.Column>
						);
					}}
				</Table.Header>

				<Table.Body items={props.monitors}>
					{(monitor) => (
						<HttpMonitorTableRow
							team={props.team}
							monitor={monitor}
							showLastIncident={showLastIncident}
						/>
					)}
				</Table.Body>
			</Table>
		</div>
	);
}
