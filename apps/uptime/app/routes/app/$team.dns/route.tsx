import { cn } from "@pkg/cn";
import { Badge, Button, confirm, Empty, LinkButton, Menu, Popover, Skeleton, Table } from "@pkg/ui";
import {
	EllipsisVerticalIcon,
	GlobeIcon,
	LoaderIcon,
	PencilIcon,
	PlayIcon,
	PlusIcon,
	TrashIcon,
} from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { href, Link, useFetcher, useRevalidator } from "react-router";
import { useSpinDelay } from "spin-delay";

import { AppHeader } from "~/components/app-header";
import { useTeam } from "~/hooks/use-team";
import { db } from "~/middleware/drizzle";
import { locale } from "~/middleware/i18next";
import { measure } from "~/middleware/server-timing";
import { team } from "~/middleware/team";
import { getDnsStatusColor, getDnsStatusText } from "~/services/check-dns";
import { getHints } from "~/utils/client-hints";

import type { Route } from "./+types/route";

export async function clientLoader({ serverLoader }: Route.ClientLoaderArgs) {
	return await serverLoader();
}

clientLoader.hydrate = true as const;

export function HydrateFallback() {
	return (
		<>
			<header className="sticky top-0 z-10 flex h-16 flex-shrink-0 items-center gap-2 border-b border-neutral-200 bg-neutral-50/80 px-4 dark:border-neutral-800 dark:bg-neutral-950/80">
				<Skeleton className="h-6 w-24" />
				<aside className="ml-auto flex items-center gap-2">
					<Skeleton className="h-10 w-10 rounded-lg max-sm:w-10 sm:w-40" />
				</aside>
			</header>

			<div className="flex flex-col gap-6 p-5 md:gap-12 md:p-12">
				<DnsMonitorsTableSkeleton />
			</div>
		</>
	);
}

function DnsMonitorsTableSkeleton() {
	return (
		<Table aria-label="Loading DNS monitors">
			<Table.Header>
				<Table.Column isRowHeader>
					<Skeleton className="h-4 w-16" />
				</Table.Column>
				<Table.Column>
					<Skeleton className="h-4 w-20" />
				</Table.Column>
				<Table.Column>
					<Skeleton className="h-4 w-16" />
				</Table.Column>
				<Table.Column align="center">
					<Skeleton className="h-4 w-16" />
				</Table.Column>
				<Table.Column align="right">
					<span className="sr-only">Actions</span>
				</Table.Column>
			</Table.Header>

			<Table.Body items={[{ id: "1" }, { id: "2" }, { id: "3" }]}>
				{(item) => (
					<Table.Row key={item.id}>
						<Table.Cell>
							<Skeleton className="h-4 w-32" />
						</Table.Cell>
						<Table.Cell className="w-48">
							<Skeleton className="h-4 w-40" />
						</Table.Cell>
						<Table.Cell className="w-20">
							<Skeleton className="h-6 w-12 rounded-full" />
						</Table.Cell>
						<Table.Cell className="w-28 text-center">
							<Skeleton className="mx-auto h-6 w-16 rounded-full" />
						</Table.Cell>
						<Table.Cell className="w-17 text-center">
							<Skeleton className="mx-auto h-10 w-10 rounded-lg" />
						</Table.Cell>
					</Table.Row>
				)}
			</Table.Body>
		</Table>
	);
}

export async function loader({ request }: Route.LoaderArgs) {
	let clientLocale = locale();
	let timeZone = getHints(request).timeZone;

	let dnsMonitors = await measure("findDnsMonitors", () => {
		return db().query.dnsMonitors.findMany({
			where(fields, operators) {
				return operators.eq(fields.teamId, team().id);
			},
			orderBy(fields, operators) {
				return operators.desc(fields.createdAt);
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

	return {
		dnsMonitors: dnsMonitors.map((m) => ({
			...m,
			lastCheckedAtFormatted: formatDate(m.lastCheckedAt),
		})),
	};
}

export default function Component({ loaderData, params }: Route.ComponentProps) {
	let { t } = useTranslation("translation", { keyPrefix: "page.dnsMonitors" });
	let id = useId();

	return (
		<>
			<AppHeader heading={t("header.title")}>
				<LinkButton
					color="neutral"
					href={href("/app/:team/dns/new", params)}
					className="flex-shrink-0 px-2"
				>
					<PlusIcon className="size-5" aria-hidden />
					<span className="max-sm:sr-only">{t("header.action.create")}</span>
				</LinkButton>
			</AppHeader>

			<div className="flex flex-col gap-6 p-5 md:gap-12 md:p-12">
				{loaderData.dnsMonitors.length === 0 ? (
					<Empty className="mx-auto max-w-md py-16">
						<Empty.Icon>
							<GlobeIcon className="size-12" />
						</Empty.Icon>
						<Empty.Title>{t("empty.title")}</Empty.Title>
						<Empty.Description>{t("empty.description")}</Empty.Description>
						<Empty.Action>
							<LinkButton href={href("/app/:team/dns/new", params)}>
								<PlusIcon className="size-5" aria-hidden />
								{t("empty.cta")}
							</LinkButton>
						</Empty.Action>
					</Empty>
				) : (
					<DnsMonitorsTable monitors={loaderData.dnsMonitors} labelId={`${id}-table`} />
				)}
			</div>
		</>
	);
}

type DnsMonitor = Route.ComponentProps["loaderData"]["dnsMonitors"][number];

function DnsMonitorsTable(props: { monitors: DnsMonitor[]; labelId: string }) {
	let { t } = useTranslation("translation", { keyPrefix: "page.dnsMonitors.table" });

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
			<Table aria-labelledby={props.labelId}>
				<Table.Header columns={columns}>
					{(column) => (
						<Table.Column align={column.align} isRowHeader={column.id === "name"}>
							<span className={cn({ "sr-only": column.id === "actions" })}>{column.name}</span>
						</Table.Column>
					)}
				</Table.Header>

				<Table.Body items={props.monitors}>
					{(monitor) => <DnsMonitorRow key={monitor.id} monitor={monitor} />}
				</Table.Body>
			</Table>
		</div>
	);
}

function DnsMonitorRow(props: { monitor: DnsMonitor }) {
	let { t } = useTranslation("translation", { keyPrefix: "page.dnsMonitors.table" });
	let team = useTeam();
	let revalidator = useRevalidator();

	let deleteFetcher = useFetcher();
	let isDeleting = useSpinDelay(deleteFetcher.state !== "idle", {
		minDuration: 100,
		delay: 50,
	});

	let checkFetcher = useFetcher();
	let isChecking = useSpinDelay(checkFetcher.state !== "idle", {
		minDuration: 100,
		delay: 50,
	});

	let statusColor = getDnsStatusColor(props.monitor.lastStatus);
	let statusText = getDnsStatusText(props.monitor.lastStatus);

	let badgeColor: "success" | "warning" | "danger" | "neutral" =
		statusColor === "error" ? "danger" : statusColor;

	return (
		<Table.Row>
			<Table.Cell>
				<Link
					to={href("/app/:team/dns/:dnsMonitorId", {
						team: team.slug,
						dnsMonitorId: props.monitor.id,
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
				<code className="text-sm">{props.monitor.domain}</code>
			</Table.Cell>
			<Table.Cell className="w-20 text-center">
				<Badge color="neutral" variant="outline">
					{props.monitor.recordType}
				</Badge>
			</Table.Cell>
			<Table.Cell className="w-28 text-center">
				<Badge color={badgeColor} variant="outline">
					{statusText}
				</Badge>
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
								isDisabled={isChecking}
								onAction={() => {
									checkFetcher.submit(
										{ dnsMonitorId: props.monitor.id },
										{
											method: "POST",
											action: href("/actions/:team/check-dns-monitor", {
												team: team.slug,
											}),
										},
									);
									// Revalidate to show updated results
									setTimeout(() => revalidator.revalidate(), 1000);
								}}
							>
								<PlayIcon aria-hidden className="size-5" />
								<span>{t("actions.check")}</span>
								{isChecking && <LoaderIcon aria-hidden className="ml-auto size-5 animate-spin" />}
							</Menu.Item>

							<Menu.Item
								href={href("/app/:team/dns/:dnsMonitorId/edit", {
									team: team.slug,
									dnsMonitorId: props.monitor.id,
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
