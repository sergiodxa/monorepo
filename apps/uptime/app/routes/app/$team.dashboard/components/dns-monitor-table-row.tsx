import type { ResolvedType } from "@pkg/types";

import { Badge, Button, confirm, Menu, Popover, Table } from "@pkg/ui";
import { EllipsisVerticalIcon, GlobeIcon, LoaderIcon, PencilIcon, TrashIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { href, Link, useFetcher } from "react-router";
import { useSpinDelay } from "spin-delay";

import { useTeam } from "~/hooks/use-team";

import type { getDnsMonitorsData } from "../query.server";

export function DnsMonitorTableRow(props: {
	team: string;
	monitor: ResolvedType<typeof getDnsMonitorsData>["dnsMonitors"][number];
}) {
	let { t } = useTranslation("translation", { keyPrefix: "page.dnsMonitors.table" });
	let team = useTeam();

	let deleteFetcher = useFetcher();
	let isDeleting = useSpinDelay(deleteFetcher.state !== "idle", {
		minDuration: 100,
		delay: 50,
	});

	let statusColor: "primary" | "warning" | "danger" | "neutral" =
		props.monitor.lastStatus === "ok"
			? "primary"
			: props.monitor.lastStatus === "changed"
				? "warning"
				: props.monitor.lastStatus === "error"
					? "danger"
					: "neutral";

	let statusText =
		props.monitor.lastStatus === "ok"
			? "OK"
			: props.monitor.lastStatus === "changed"
				? "Changed"
				: props.monitor.lastStatus === "error"
					? "Error"
					: "Unknown";

	return (
		<Table.Row>
			<Table.Cell>
				<Link
					to={href("/app/:team/dns/:dnsMonitorId", {
						team: props.team,
						dnsMonitorId: props.monitor.id,
					})}
					className="font-semibold hover:underline"
				>
					{props.monitor.name}
				</Link>
			</Table.Cell>
			<Table.Cell className="w-48">
				<code className="text-sm">{props.monitor.domain}</code>
			</Table.Cell>
			<Table.Cell className="w-20 text-center">
				<Badge color="neutral" variant="outline">
					{props.monitor.recordType}
				</Badge>
			</Table.Cell>
			<Table.Cell className="w-28 text-center">
				<Badge color={statusColor} variant="outline">
					{statusText}
				</Badge>
			</Table.Cell>
			<Table.Cell className="w-40">
				{props.monitor.lastCheckedAt ?? (
					<span className="text-neutral-500">{t("neverChecked")}</span>
				)}
			</Table.Cell>
			<Table.Cell className="w-17 text-center">
				<Menu.Trigger>
					<Button type="button" color="neutral" className="p-2">
						<EllipsisVerticalIcon className="size-5" />
						<span className="sr-only">{t("actions.menu")}</span>
					</Button>

					<Popover placement="left top">
						<Menu>
							<Menu.Item
								href={href("/app/:team/dns/:dnsMonitorId", {
									team: props.team,
									dnsMonitorId: props.monitor.id,
								})}
							>
								<GlobeIcon aria-hidden className="size-5" />
								<span>View</span>
							</Menu.Item>

							<Menu.Item
								href={href("/app/:team/dns/:dnsMonitorId/edit", {
									team: props.team,
									dnsMonitorId: props.monitor.id,
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
									let confirmed = await confirm(t("confirmation.delete", props.monitor), {
										confirmLabel: t("actions.delete"),
										color: "danger",
									});
									if (confirmed) {
										deleteFetcher.submit(
											{ dnsMonitorId: props.monitor.id },
											{
												method: "POST",
												action: href("/actions/:team/delete-dns-monitor", {
													team: team.slug,
												}),
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
