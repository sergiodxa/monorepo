import type { ResolvedType } from "@pkg/types";

import { cn } from "@pkg/cn";
import { Empty, LinkButton, Table } from "@pkg/ui";
import { ClockIcon, PlusIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { href } from "react-router";

import type { getCronJobsData } from "../query.server";

import { CronJobTableRow } from "./cron-job-table-row";

export function CronJobsTable(props: {
	team: string;
	cronJobs: ResolvedType<typeof getCronJobsData>["cronJobs"];
}) {
	let { t } = useTranslation("translation", { keyPrefix: "page.cronJobs.table" });
	let { t: tPage } = useTranslation("translation", { keyPrefix: "page.cronJobs" });

	if (props.cronJobs.length === 0) {
		return (
			<Empty className="mx-auto max-w-md py-16">
				<Empty.Icon>
					<ClockIcon className="size-12" />
				</Empty.Icon>
				<Empty.Title>{tPage("empty.title")}</Empty.Title>
				<Empty.Description>{tPage("empty.description")}</Empty.Description>
				<Empty.Action>
					<LinkButton href={href("/app/:team/cron-jobs/new", { team: props.team })}>
						<PlusIcon className="size-5" aria-hidden />
						{tPage("empty.cta")}
					</LinkButton>
				</Empty.Action>
			</Empty>
		);
	}

	let columns = [
		{ id: "name" as const, name: t("columns.name"), align: "left" as const },
		{ id: "schedule" as const, name: t("columns.schedule"), align: "left" as const },
		{ id: "status" as const, name: t("columns.status"), align: "center" as const },
		{ id: "lastPing" as const, name: t("columns.lastPing"), align: "left" as const },
		{ id: "nextExpected" as const, name: t("columns.nextExpected"), align: "left" as const },
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

				<Table.Body items={props.cronJobs}>
					{(cronJob) => <CronJobTableRow key={cronJob.id} team={props.team} cronJob={cronJob} />}
				</Table.Body>
			</Table>
		</div>
	);
}
