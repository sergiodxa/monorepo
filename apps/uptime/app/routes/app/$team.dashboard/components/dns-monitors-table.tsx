import type { ResolvedType } from "@pkg/types";

import { cn } from "@pkg/cn";
import { Empty, LinkButton, Table } from "@pkg/ui";
import { GlobeIcon, PlusIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { href } from "react-router";

import type { getDnsMonitorsData } from "../query.server";

import { DnsMonitorTableRow } from "./dns-monitor-table-row";

export function DnsMonitorsTable(props: {
	team: string;
	monitors: ResolvedType<typeof getDnsMonitorsData>["dnsMonitors"];
}) {
	let { t } = useTranslation("translation", { keyPrefix: "page.dnsMonitors.table" });
	let { t: tPage } = useTranslation("translation", { keyPrefix: "page.dnsMonitors" });

	if (props.monitors.length === 0) {
		return (
			<Empty className="mx-auto max-w-md py-16">
				<Empty.Icon>
					<GlobeIcon className="size-12" />
				</Empty.Icon>
				<Empty.Title>{tPage("empty.title")}</Empty.Title>
				<Empty.Description>{tPage("empty.description")}</Empty.Description>
				<Empty.Action>
					<LinkButton href={href("/app/:team/dns/new", { team: props.team })}>
						<PlusIcon className="size-5" aria-hidden />
						{tPage("empty.cta")}
					</LinkButton>
				</Empty.Action>
			</Empty>
		);
	}

	let columns = [
		{ id: "name" as const, name: t("columns.name"), align: "left" as const },
		{ id: "domain" as const, name: t("columns.domain"), align: "left" as const },
		{ id: "recordType" as const, name: t("columns.recordType"), align: "center" as const },
		{ id: "status" as const, name: t("columns.status"), align: "center" as const },
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
					{(monitor) => <DnsMonitorTableRow key={monitor.id} team={props.team} monitor={monitor} />}
				</Table.Body>
			</Table>
		</div>
	);
}
