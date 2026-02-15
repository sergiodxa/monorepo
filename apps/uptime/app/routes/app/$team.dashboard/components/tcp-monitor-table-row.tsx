import type { ResolvedType } from "@pkg/types";

import { Badge, Button, confirm, Menu, Popover, Table } from "@pkg/ui";
import { EllipsisVerticalIcon, LoaderIcon, NetworkIcon, PencilIcon, TrashIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { href, Link, useFetcher } from "react-router";
import { useSpinDelay } from "spin-delay";

import { useTeam } from "~/hooks/use-team";

import type { getTcpMonitorsData } from "../query.server";

export function TcpMonitorTableRow(props: {
	team: string;
	monitor: ResolvedType<typeof getTcpMonitorsData>["tcpMonitors"][number];
}) {
	let { t } = useTranslation("translation", { keyPrefix: "page.tcpMonitors.table" });
	let team = useTeam();

	let deleteFetcher = useFetcher();
	let isDeleting = useSpinDelay(deleteFetcher.state !== "idle", {
		minDuration: 100,
		delay: 50,
	});

	let statusColor: "primary" | "danger" | "neutral" =
		props.monitor.lastStatus === "up"
			? "primary"
			: props.monitor.lastStatus === "down" || props.monitor.lastStatus === "timeout"
				? "danger"
				: "neutral";

	let statusText =
		props.monitor.lastStatus === "up"
			? t("status.up")
			: props.monitor.lastStatus === "down"
				? t("status.down")
				: props.monitor.lastStatus === "timeout"
					? t("status.timeout")
					: t("status.pending");

	return (
		<Table.Row>
			<Table.Cell>
				<Link
					to={href("/app/:team/tcp/:tcpMonitorId", {
						team: props.team,
						tcpMonitorId: props.monitor.id,
					})}
					className="font-semibold hover:underline"
				>
					{props.monitor.name}
				</Link>
			</Table.Cell>
			<Table.Cell className="w-48">
				<code className="rounded bg-neutral-100 px-2 py-1 text-sm dark:bg-neutral-800">
					{props.monitor.host}:{props.monitor.port}
				</code>
			</Table.Cell>
			<Table.Cell className="w-28 text-center">
				<Badge color={statusColor} variant="outline">
					{statusText}
				</Badge>
			</Table.Cell>
			<Table.Cell className="w-32 text-right">
				{props.monitor.lastResponseTimeMs ? `${props.monitor.lastResponseTimeMs}ms` : "-"}
			</Table.Cell>
			<Table.Cell className="w-40">
				{props.monitor.lastCheckedAt ?? <span className="text-neutral-500">Never</span>}
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
								href={href("/app/:team/tcp/:tcpMonitorId", {
									team: props.team,
									tcpMonitorId: props.monitor.id,
								})}
							>
								<NetworkIcon aria-hidden className="size-5" />
								<span>View</span>
							</Menu.Item>

							<Menu.Item
								href={href("/app/:team/tcp/:tcpMonitorId/edit", {
									team: props.team,
									tcpMonitorId: props.monitor.id,
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
										t("actions.confirmation.delete", { name: props.monitor.name }),
										{
											confirmLabel: t("actions.delete"),
											color: "danger",
										},
									);
									if (confirmed) {
										deleteFetcher.submit(
											{ tcpMonitorId: props.monitor.id },
											{
												method: "POST",
												action: href("/actions/:team/delete-tcp-monitor", { team: team.slug }),
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
