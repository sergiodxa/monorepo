import type { ResolvedType } from "@pkg/types";

import { Badge, Button, confirm, Menu, Popover, Table } from "@pkg/ui";
import { EllipsisVerticalIcon, LoaderIcon, PencilIcon, PlayIcon, TrashIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { href, Link, useFetcher } from "react-router";
import { Line, LineChart } from "recharts";
import { ClientOnly } from "remix-utils/client-only";
import { useSpinDelay } from "spin-delay";

import type { getHttpMonitorsData } from "../query.server";

export function HttpMonitorTableRow(props: {
	monitor: ResolvedType<typeof getHttpMonitorsData>["httpMonitors"][number];
	team: string;
	showLastIncident?: boolean;
}) {
	let { t } = useTranslation("translation", {
		keyPrefix: "page.dashboard.table",
	});

	let playMonitorFetcher = useFetcher();
	let isPlaying = useSpinDelay(playMonitorFetcher.state !== "idle", {
		minDuration: 100,
		delay: 10,
	});

	let deleteMonitorFetcher = useFetcher();
	let isDeleting = useSpinDelay(deleteMonitorFetcher.state !== "idle", {
		minDuration: 100,
		delay: 10,
	});

	return (
		<Table.Row>
			<Table.Cell className="text-left">
				<Link
					to={href("/app/:team/monitors/:monitorId", {
						team: props.team,
						monitorId: props.monitor.id,
					})}
					className="line-clamp-1 inline hover:underline"
				>
					{props.monitor.name}
				</Link>
			</Table.Cell>

			<Table.Cell className="w-50 text-left max-lg:hidden">
				<ClientOnly fallback={<div className="h-6 w-50" />}>
					{() => (
						<LineChart
							width={200}
							height={24}
							data={props.monitor.latency}
							margin={{ top: 0, bottom: 0, left: 0, right: 0 }}
						>
							<Line type="monotone" dataKey="latency" stroke="currentColor" dot={false} />
						</LineChart>
					)}
				</ClientOnly>
			</Table.Cell>

			<Table.Cell className="text-left sm:w-44">
				{props.monitor.status === "unknown" && (
					<Badge color="neutral" variant="outline">
						{t("status.unknown")}
					</Badge>
				)}
				{props.monitor.status === "up" && (
					<Badge color="primary" variant="outline">
						{t("status.up")}
					</Badge>
				)}
				{props.monitor.status === "degraded" && (
					<Badge color="warning" variant="outline">
						{t("status.degraded")}
					</Badge>
				)}
				{props.monitor.status === "down" && (
					<Badge color="danger" variant="outline">
						{t("status.down")}
					</Badge>
				)}
			</Table.Cell>

			{props.showLastIncident && (
				<Table.Cell className="w-52 text-right max-md:hidden">
					{props.monitor.lastIncident}
				</Table.Cell>
			)}

			<Table.Cell className="w-36 text-right max-sm:hidden">
				{props.monitor.responseTime}
			</Table.Cell>

			<Table.Cell className="w-17 text-right">
				<Menu.Trigger>
					<Button color="neutral" type="button" className="ml-auto p-2">
						<EllipsisVerticalIcon className="size-5" />
						<span className="sr-only">{t("actions.menu")}</span>
					</Button>

					<Popover placement="left top">
						<Menu>
							<Menu.Item
								isDisabled={isPlaying}
								onAction={() => {
									playMonitorFetcher.submit(
										{ monitorId: props.monitor.id },
										{
											method: "POST",
											action: href("/actions/:team/play-monitor", {
												team: props.team,
											}),
										},
									);
								}}
							>
								<PlayIcon className="size-5" />
								<span>{t("actions.play")}</span>
								{isPlaying && <LoaderIcon aria-hidden className="ml-auto size-5 animate-spin" />}
							</Menu.Item>

							<Menu.Item
								href={href("/app/:team/monitors/:monitorId/edit", {
									team: props.team,
									monitorId: props.monitor.id,
								})}
							>
								<PencilIcon className="size-5" />
								<span>{t("actions.edit")}</span>
							</Menu.Item>

							<Menu.Separator />

							<Menu.Item
								danger
								isDisabled={isDeleting}
								onAction={async () => {
									let confirmed = await confirm(
										t("confirmation.deleteMonitor", {
											name: props.monitor.name,
										}),
										{
											confirmLabel: t("actions.delete"),
											color: "danger",
										},
									);
									if (confirmed) {
										deleteMonitorFetcher.submit(
											{ monitorId: props.monitor.id },
											{
												method: "POST",
												action: href("/actions/:team/delete-monitor", {
													team: props.team,
												}),
											},
										);
									}
								}}
							>
								<TrashIcon className="size-5" />
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
