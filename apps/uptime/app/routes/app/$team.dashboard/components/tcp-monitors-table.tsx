import { cn } from "@pkg/cn";
import { Empty, LinkButton, Table } from "@pkg/ui";
import { NetworkIcon, PlusIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { href } from "react-router";

import type { ResolvedType } from "~/types";

import type { getTcpMonitorsData } from "../query.server";

import { TcpMonitorTableRow } from "./tcp-monitor-table-row";

export function TcpMonitorsTable(props: {
	team: string;
	monitors: ResolvedType<typeof getTcpMonitorsData>["tcpMonitors"];
}) {
	let { t } = useTranslation("translation", { keyPrefix: "page.tcpMonitors.table" });
	let { t: tPage } = useTranslation("translation", { keyPrefix: "page.tcpMonitors" });

	if (props.monitors.length === 0) {
		return (
			<Empty className="mx-auto max-w-md py-16">
				<Empty.Icon>
					<NetworkIcon className="size-12" />
				</Empty.Icon>
				<Empty.Title>{tPage("empty.title")}</Empty.Title>
				<Empty.Description>{tPage("empty.description")}</Empty.Description>
				<Empty.Action>
					<LinkButton href={href("/app/:team/tcp/new", { team: props.team })}>
						<PlusIcon className="size-5" aria-hidden />
						{tPage("empty.cta")}
					</LinkButton>
				</Empty.Action>
			</Empty>
		);
	}

	let columns = [
		{ id: "name" as const, name: t("columns.name"), align: "left" as const },
		{ id: "endpoint" as const, name: t("columns.endpoint"), align: "left" as const },
		{ id: "status" as const, name: t("columns.status"), align: "center" as const },
		{ id: "responseTime" as const, name: t("columns.responseTime"), align: "right" as const },
		{ id: "lastChecked" as const, name: t("columns.lastChecked"), align: "left" as const },
		{ id: "actions" as const, name: t("columns.actions"), align: "center" as const },
	];

	return (
		<div className="-mx-5 w-[calc(100%+2.5rem)] overflow-x-auto px-5 md:mx-0 md:w-full md:px-0">
			<Table aria-label={t("label")}>
				<Table.Header columns={columns}>
					{(column) => (
						<Table.Column align={column.align} isRowHeader={column.id === "name"}>
							<span className={cn({ "sr-only": column.id === "actions" })}>{column.name}</span>
						</Table.Column>
					)}
				</Table.Header>

				<Table.Body items={props.monitors}>
					{(monitor) => <TcpMonitorTableRow key={monitor.id} team={props.team} monitor={monitor} />}
				</Table.Body>
			</Table>
		</div>
	);
}
