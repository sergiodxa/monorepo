import { cn } from "@pkg/cn";
import { Badge, Button, confirm, Empty, LinkButton, Menu, Popover, Table } from "@pkg/ui";
import {
	EllipsisVerticalIcon,
	EyeIcon,
	LoaderIcon,
	MonitorIcon,
	PencilIcon,
	PlusIcon,
	TrashIcon,
} from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { href, Link, useFetcher } from "react-router";
import { useSpinDelay } from "spin-delay";

import { AppHeader } from "~/components/app-header";
import { useTeam } from "~/hooks/use-team";
import { db } from "~/middleware/drizzle";
import { locale } from "~/middleware/i18next";
import { logger } from "~/middleware/logger";
import { measure } from "~/middleware/server-timing";
import { team } from "~/middleware/team";
import { getHints } from "~/utils/client-hints";

import type { Route } from "./+types/route";

type MonitorStatus = "up" | "degraded" | "down" | "unknown";

export async function loader({ request }: Route.LoaderArgs) {
	logger().info("http.loader.start", {
		route: "http",
		teamId: team().id,
	});

	let clientLocale = locale();
	let timeZone = getHints(request).timeZone;

	let monitors = await measure("findHttpMonitors", () => {
		return db().query.monitors.findMany({
			columns: {
				id: true,
				name: true,
				url: true,
				expectedStatus: true,
				degradedAfterMs: true,
				enabledAt: true,
			},
			where(fields, operators) {
				return operators.eq(fields.teamId, team().id);
			},
			orderBy(fields, operators) {
				return operators.desc(fields.createdAt);
			},
			with: {
				results: {
					columns: {
						responseStatus: true,
						responseTimeMs: true,
						completedAt: true,
					},
					where(fields, operators) {
						return operators.isNotNull(fields.completedAt);
					},
					orderBy(fields, operators) {
						return operators.desc(fields.completedAt);
					},
					limit: 1,
				},
			},
		});
	});

	function formatDate(date: Date | null) {
		if (!date) return null;
		return date.toLocaleString(clientLocale, {
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
			timeZone,
		});
	}

	function calculateStatus(
		lastResult: { responseStatus: number | null; responseTimeMs: number | null } | null,
		expectedStatus: number,
		degradedAfterMs: number,
	): MonitorStatus {
		if (!lastResult || lastResult.responseStatus === null) {
			return "unknown";
		}

		if (lastResult.responseStatus !== expectedStatus) {
			return "down";
		}

		if (lastResult.responseTimeMs !== null && lastResult.responseTimeMs >= degradedAfterMs) {
			return "degraded";
		}

		return "up";
	}

	logger().info("http.loader.complete", {
		route: "http",
		teamId: team().id,
		monitorCount: monitors.length,
	});

	return {
		monitors: monitors.map((m) => {
			let lastResult = m.results[0] ?? null;
			return {
				id: m.id,
				name: m.name,
				url: m.url,
				isEnabled: m.enabledAt !== null,
				status: calculateStatus(lastResult, m.expectedStatus, m.degradedAfterMs),
				responseTimeMs: lastResult?.responseTimeMs ?? null,
				lastCheckedAtFormatted: formatDate(lastResult?.completedAt ?? null),
			};
		}),
	};
}

export default function Component({ loaderData, params }: Route.ComponentProps) {
	let { t } = useTranslation("translation", { keyPrefix: "page.httpMonitors" });
	let { t: tSidebar } = useTranslation("translation", {
		keyPrefix: "app.layout.sidebar.navigation.items",
	});
	let id = useId();

	return (
		<>
			<AppHeader
				heading={t("header.title")}
				breadcrumbs={[
					{ label: tSidebar("dashboard"), href: href("/app/:team/dashboard", params) },
					{ label: t("header.title") },
				]}
			>
				<LinkButton
					color="neutral"
					href={href("/app/:team/monitors/new", params)}
					className="flex-shrink-0 px-2"
				>
					<PlusIcon className="size-5" aria-hidden />
					<span className="max-sm:sr-only">{t("header.action.create")}</span>
				</LinkButton>
			</AppHeader>

			<div className="flex flex-col gap-6 p-5 md:gap-12 md:p-12">
				{loaderData.monitors.length === 0 ? (
					<Empty className="mx-auto max-w-md py-16">
						<Empty.Icon>
							<MonitorIcon className="size-12" />
						</Empty.Icon>
						<Empty.Title>{t("empty.title")}</Empty.Title>
						<Empty.Description>{t("empty.description")}</Empty.Description>
						<Empty.Action>
							<LinkButton href={href("/app/:team/monitors/new", params)}>
								<PlusIcon className="size-5" aria-hidden />
								{t("empty.cta")}
							</LinkButton>
						</Empty.Action>
					</Empty>
				) : (
					<HttpMonitorsTable monitors={loaderData.monitors} labelId={`${id}-table`} />
				)}
			</div>
		</>
	);
}

type HttpMonitor = Route.ComponentProps["loaderData"]["monitors"][number];

function HttpMonitorsTable(props: { monitors: HttpMonitor[]; labelId: string }) {
	let { t } = useTranslation("translation", { keyPrefix: "page.httpMonitors.table" });

	let columns = [
		{ id: "name" as const, name: t("columns.name"), align: "left" as const },
		{ id: "url" as const, name: t("columns.url"), align: "left" as const },
		{ id: "status" as const, name: t("columns.status"), align: "center" as const },
		{ id: "responseTime" as const, name: t("columns.responseTime"), align: "center" as const },
		{ id: "lastChecked" as const, name: t("columns.lastChecked"), align: "left" as const },
		{ id: "actions" as const, name: t("columns.actions"), align: "center" as const },
	];

	return (
		<div className="-mx-5 w-[calc(100%+2.5rem)] overflow-x-auto px-5 md:mx-0 md:w-full md:px-0">
			<Table aria-labelledby={props.labelId}>
				<Table.Header columns={columns}>
					{(column) => (
						<Table.Column align={column.align} isRowHeader={column.id === "name"}>
							<span className={cn({ "sr-only": column.id === "actions" })}>{column.name}</span>
						</Table.Column>
					)}
				</Table.Header>

				<Table.Body items={props.monitors}>
					{(monitor) => <HttpMonitorRow key={monitor.id} monitor={monitor} />}
				</Table.Body>
			</Table>
		</div>
	);
}

function getStatusBadgeColor(status: MonitorStatus): "success" | "warning" | "danger" | "neutral" {
	switch (status) {
		case "up":
			return "success";
		case "degraded":
			return "warning";
		case "down":
			return "danger";
		case "unknown":
			return "neutral";
	}
}

function HttpMonitorRow(props: { monitor: HttpMonitor }) {
	let { t } = useTranslation("translation", { keyPrefix: "page.httpMonitors.table" });
	let team = useTeam();

	let deleteFetcher = useFetcher();
	let isDeleting = useSpinDelay(deleteFetcher.state !== "idle", {
		minDuration: 100,
		delay: 50,
	});

	let badgeColor = getStatusBadgeColor(props.monitor.status);

	return (
		<Table.Row>
			<Table.Cell>
				<Link
					to={href("/app/:team/monitors/:monitorId", {
						team: team.slug,
						monitorId: props.monitor.id,
					})}
					className="font-semibold hover:underline"
				>
					{props.monitor.name}
				</Link>
				{!props.monitor.isEnabled && (
					<Badge color="neutral" variant="outline" className="ml-2">
						{t("disabled")}
					</Badge>
				)}
			</Table.Cell>
			<Table.Cell className="w-48">
				<code className="text-sm">{props.monitor.url}</code>
			</Table.Cell>
			<Table.Cell className="w-28 text-center">
				<Badge color={badgeColor} variant="outline">
					{t(`status.${props.monitor.status}`)}
				</Badge>
			</Table.Cell>
			<Table.Cell className="w-28 text-center">
				{props.monitor.responseTimeMs !== null ? (
					<span className="text-sm">{props.monitor.responseTimeMs}ms</span>
				) : (
					<span className="text-neutral-500">-</span>
				)}
			</Table.Cell>
			<Table.Cell className="w-40">
				{props.monitor.lastCheckedAtFormatted ?? (
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
								href={href("/app/:team/monitors/:monitorId", {
									team: team.slug,
									monitorId: props.monitor.id,
								})}
							>
								<EyeIcon aria-hidden className="size-5" />
								<span>{t("actions.view")}</span>
							</Menu.Item>

							<Menu.Item
								href={href("/app/:team/monitors/:monitorId/edit", {
									team: team.slug,
									monitorId: props.monitor.id,
								})}
							>
								<PencilIcon aria-hidden className="size-5" />
								<span>{t("actions.edit")}</span>
							</Menu.Item>

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
											{ monitorId: props.monitor.id },
											{
												method: "POST",
												action: href("/actions/:team/delete-monitor", {
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
