/**
 * Table row for a single cron job on the dashboard. It renders the job name,
 * schedule, a colored healthy/late/missed/unknown status badge, and last-ping
 * and next-expected times, plus an actions menu offering view, edit, and
 * confirm-then-delete operations driven by a fetcher.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ResolvedType } from "@pkg/types";

import { Badge, Button, confirm, Menu, Popover, Table } from "@pkg/ui";
import { ClockIcon, EllipsisVerticalIcon, LoaderIcon, PencilIcon, TrashIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { href, Link, useFetcher } from "react-router";
import { useSpinDelay } from "spin-delay";

import { useTeam } from "~/hooks/use-team";

import type { getCronJobsData } from "../query.server";

export function CronJobTableRow(props: {
	team: string;
	cronJob: ResolvedType<typeof getCronJobsData>["cronJobs"][number];
}) {
	let { t } = useTranslation("translation", { keyPrefix: "page.cronJobs.table" });
	let team = useTeam();

	let deleteFetcher = useFetcher();
	let isDeleting = useSpinDelay(deleteFetcher.state !== "idle", {
		minDuration: 100,
		delay: 50,
	});

	let statusColor: "primary" | "warning" | "danger" | "neutral" =
		props.cronJob.status === "healthy"
			? "primary"
			: props.cronJob.status === "late"
				? "warning"
				: props.cronJob.status === "missed"
					? "danger"
					: "neutral";

	return (
		<Table.Row>
			<Table.Cell>
				<Link
					to={href("/app/:team/cron-jobs/:cronJobId", {
						team: props.team,
						cronJobId: props.cronJob.id,
					})}
					className="font-semibold hover:underline"
				>
					{props.cronJob.name}
				</Link>
			</Table.Cell>
			<Table.Cell className="w-48">
				<span className="text-sm">{props.cronJob.schedule}</span>
			</Table.Cell>
			<Table.Cell className="w-28 text-center">
				<Badge color={statusColor} variant="outline">
					{t(`status.${props.cronJob.status}`)}
				</Badge>
			</Table.Cell>
			<Table.Cell className="w-40">
				{props.cronJob.lastPingAt ?? <span className="text-neutral-500">Never</span>}
			</Table.Cell>
			<Table.Cell className="w-40">
				{props.cronJob.nextExpectedAt ?? <span className="text-neutral-500">-</span>}
			</Table.Cell>
			<Table.Cell className="w-17 text-center">
				<Menu.Trigger>
					<Button type="button" color="neutral" className="p-2">
						<EllipsisVerticalIcon className="size-5" />
						<span className="sr-only">{t("actions.edit")}</span>
					</Button>

					<Popover placement="left top">
						<Menu>
							<Menu.Item
								href={href("/app/:team/cron-jobs/:cronJobId", {
									team: props.team,
									cronJobId: props.cronJob.id,
								})}
							>
								<ClockIcon aria-hidden className="size-5" />
								<span>View</span>
							</Menu.Item>

							<Menu.Item
								href={href("/app/:team/cron-jobs/:cronJobId/edit", {
									team: props.team,
									cronJobId: props.cronJob.id,
								})}
							>
								<PencilIcon aria-hidden className="size-5" />
								<span>{t("actions.edit")}</span>
							</Menu.Item>

							<Menu.Separator />

							<Menu.Item
								danger
								isDisabled={isDeleting}
								onAction={async () => {
									let confirmed = await confirm(
										t("actions.confirmation.delete", { name: props.cronJob.name }),
										{
											confirmLabel: t("actions.delete"),
											color: "danger",
										},
									);
									if (confirmed) {
										deleteFetcher.submit(
											{ cronJobId: props.cronJob.id },
											{
												method: "POST",
												action: href("/actions/:team/delete-cron-job", { team: team.slug }),
											},
										);
									}
								}}
							>
								<TrashIcon aria-hidden className="size-5" />
								<span>{t("actions.delete")}</span>
								{isDeleting && <LoaderIcon aria-hidden className="ml-auto size-5 animate-spin" />}
							</Menu.Item>
						</Menu>
					</Popover>
				</Menu.Trigger>
			</Table.Cell>
		</Table.Row>
	);
}
