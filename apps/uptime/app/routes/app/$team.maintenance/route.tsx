import { cn } from "@pkg/cn";
import {
	Badge,
	Button,
	confirm,
	Empty,
	LinkButton,
	Menu,
	Popover,
	Skeleton,
	Table,
	Tabs,
} from "@pkg/ui";
import {
	CalendarIcon,
	EllipsisVerticalIcon,
	LoaderIcon,
	PlusIcon,
	SquareIcon,
	TrashIcon,
	WrenchIcon,
} from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { href, useFetcher } from "react-router";
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
					<Skeleton className="h-10 w-10 rounded-lg max-sm:w-10 sm:w-32" />
				</aside>
			</header>

			<div className="flex flex-col gap-6 p-5 md:gap-12 md:p-12">
				<MaintenanceTableSkeleton />
			</div>
		</>
	);
}

function MaintenanceTableSkeleton() {
	return (
		<Table aria-label="Loading maintenance windows">
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
						<Table.Cell className="w-28">
							<Skeleton className="h-6 w-16 rounded-full" />
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
	logger().info("maintenance.loader.start", {
		route: "maintenance",
		teamId: team().id,
	});

	let now = new Date();
	let clientLocale = locale();
	let timeZone = getHints(request).timeZone;

	let maintenanceWindows = await measure("findMaintenanceWindows", () => {
		return db().query.maintenanceWindows.findMany({
			where(fields, operators) {
				return operators.eq(fields.teamId, team().id);
			},
			with: {
				monitor: {
					columns: { id: true, name: true },
				},
			},
			orderBy(fields, operators) {
				return operators.desc(fields.startsAt);
			},
		});
	});

	// Categorize windows
	let active: typeof maintenanceWindows = [];
	let upcoming: typeof maintenanceWindows = [];
	let past: typeof maintenanceWindows = [];

	for (let window of maintenanceWindows) {
		let effectiveEndTime = window.endedEarlyAt ?? window.endsAt;
		if (window.startsAt <= now && effectiveEndTime > now) {
			active.push(window);
		} else if (window.startsAt > now) {
			upcoming.push(window);
		} else {
			past.push(window);
		}
	}

	function formatDate(date: Date) {
		return date.toLocaleString(clientLocale, {
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
			timeZone,
		});
	}

	logger().info("maintenance.loader.complete", {
		route: "maintenance",
		teamId: team().id,
		activeCount: active.length,
		upcomingCount: upcoming.length,
		pastCount: past.length,
	});

	return {
		active: active.map((w) => ({
			...w,
			startsAtFormatted: formatDate(w.startsAt),
			endsAtFormatted: formatDate(w.endsAt),
		})),
		upcoming: upcoming.map((w) => ({
			...w,
			startsAtFormatted: formatDate(w.startsAt),
			endsAtFormatted: formatDate(w.endsAt),
		})),
		past: past.map((w) => ({
			...w,
			startsAtFormatted: formatDate(w.startsAt),
			endsAtFormatted: formatDate(w.endsAt),
		})),
	};
}

export default function Component({ loaderData, params }: Route.ComponentProps) {
	let { t } = useTranslation("translation", { keyPrefix: "page.maintenance" });
	let id = useId();

	let hasAny =
		loaderData.active.length > 0 || loaderData.upcoming.length > 0 || loaderData.past.length > 0;

	return (
		<>
			<AppHeader heading={t("header.title")}>
				<LinkButton
					color="neutral"
					href={href("/app/:team/maintenance/new", params)}
					className="flex-shrink-0 px-2"
				>
					<PlusIcon className="size-5" aria-hidden />
					<span className="max-sm:sr-only">{t("header.action.create")}</span>
				</LinkButton>
			</AppHeader>

			<div className="flex flex-col gap-6 p-5 md:gap-12 md:p-12">
				{!hasAny ? (
					<Empty className="mx-auto max-w-md py-16">
						<Empty.Icon>
							<WrenchIcon className="size-12" />
						</Empty.Icon>
						<Empty.Title>{t("empty.title")}</Empty.Title>
						<Empty.Description>{t("empty.description")}</Empty.Description>
						<Empty.Action>
							<LinkButton href={href("/app/:team/maintenance/new", params)}>
								<PlusIcon className="size-5" aria-hidden />
								{t("empty.cta")}
							</LinkButton>
						</Empty.Action>
					</Empty>
				) : (
					<Tabs>
						<Tabs.List aria-label={t("tabs.label")}>
							<Tabs.Tab id="active">
								{t("tabs.active")} ({loaderData.active.length})
							</Tabs.Tab>
							<Tabs.Tab id="upcoming">
								{t("tabs.upcoming")} ({loaderData.upcoming.length})
							</Tabs.Tab>
							<Tabs.Tab id="past">
								{t("tabs.past")} ({loaderData.past.length})
							</Tabs.Tab>
						</Tabs.List>

						<Tabs.Panel id="active">
							{loaderData.active.length === 0 ? (
								<div className="py-8 text-center text-neutral-500">{t("noActive")}</div>
							) : (
								<MaintenanceTable
									windows={loaderData.active}
									status="active"
									labelId={`${id}-active`}
								/>
							)}
						</Tabs.Panel>

						<Tabs.Panel id="upcoming">
							{loaderData.upcoming.length === 0 ? (
								<div className="py-8 text-center text-neutral-500">{t("noUpcoming")}</div>
							) : (
								<MaintenanceTable
									windows={loaderData.upcoming}
									status="upcoming"
									labelId={`${id}-upcoming`}
								/>
							)}
						</Tabs.Panel>

						<Tabs.Panel id="past">
							{loaderData.past.length === 0 ? (
								<div className="py-8 text-center text-neutral-500">{t("noPast")}</div>
							) : (
								<MaintenanceTable windows={loaderData.past} status="past" labelId={`${id}-past`} />
							)}
						</Tabs.Panel>
					</Tabs>
				)}
			</div>
		</>
	);
}

type MaintenanceWindow = Route.ComponentProps["loaderData"]["active"][number];

function MaintenanceTable(props: {
	windows: MaintenanceWindow[];
	status: "active" | "upcoming" | "past";
	labelId: string;
}) {
	let { t } = useTranslation("translation", { keyPrefix: "page.maintenance.table" });

	let columns = [
		{ id: "name" as const, name: t("columns.name"), align: "left" as const },
		{ id: "schedule" as const, name: t("columns.schedule"), align: "left" as const },
		{ id: "monitor" as const, name: t("columns.monitor"), align: "left" as const },
		{ id: "status" as const, name: t("columns.status"), align: "center" as const },
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

				<Table.Body items={props.windows}>
					{(window) => <MaintenanceRow key={window.id} window={window} status={props.status} />}
				</Table.Body>
			</Table>
		</div>
	);
}

function MaintenanceRow(props: {
	window: MaintenanceWindow;
	status: "active" | "upcoming" | "past";
}) {
	let { t } = useTranslation("translation", { keyPrefix: "page.maintenance.table" });
	let team = useTeam();

	let deleteFetcher = useFetcher();
	let isDeleting = useSpinDelay(deleteFetcher.state !== "idle", {
		minDuration: 100,
		delay: 50,
	});

	let endFetcher = useFetcher();
	let isEnding = useSpinDelay(endFetcher.state !== "idle", {
		minDuration: 100,
		delay: 50,
	});

	return (
		<Table.Row>
			<Table.Cell>
				<div className="flex flex-col">
					<span className="font-semibold">{props.window.name}</span>
					{props.window.isRecurring && (
						<span className="text-xs text-neutral-500">{t("recurring")}</span>
					)}
				</div>
			</Table.Cell>
			<Table.Cell className="w-64">
				<div className="flex items-center gap-1.5 text-sm text-neutral-600 dark:text-neutral-400">
					<CalendarIcon className="size-4" aria-hidden />
					<span>
						{props.window.startsAtFormatted} - {props.window.endsAtFormatted}
					</span>
				</div>
			</Table.Cell>
			<Table.Cell className="w-40">
				{props.window.monitor ? (
					<span>{props.window.monitor.name}</span>
				) : (
					<span className="text-neutral-500">{t("allMonitors")}</span>
				)}
			</Table.Cell>
			<Table.Cell className="w-28 text-center">
				{props.status === "active" && (
					<Badge color="warning" variant="outline">
						{t("status.active")}
					</Badge>
				)}
				{props.status === "upcoming" && (
					<Badge color="primary" variant="outline">
						{t("status.upcoming")}
					</Badge>
				)}
				{props.status === "past" && (
					<Badge color="neutral" variant="outline">
						{t("status.past")}
					</Badge>
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
							{props.status === "active" && (
								<Menu.Item
									isDisabled={isEnding}
									onAction={async () => {
										let confirmed = await confirm(t("confirmation.endMaintenance", props.window), {
											confirmLabel: t("actions.end"),
											color: "warning",
										});
										if (confirmed) {
											endFetcher.submit(
												{ maintenanceId: props.window.id },
												{
													method: "POST",
													action: href("/actions/:team/end-maintenance", {
														team: team.slug,
													}),
												},
											);
										}
									}}
								>
									<SquareIcon aria-hidden className="size-5" />
									<span>{t("actions.end")}</span>
									{isEnding && <LoaderIcon aria-hidden className="ml-auto size-5 animate-spin" />}
								</Menu.Item>
							)}

							<Menu.Item
								danger
								isDisabled={isDeleting}
								onAction={async () => {
									let confirmed = await confirm(t("confirmation.deleteMaintenance", props.window), {
										confirmLabel: t("actions.delete"),
										color: "danger",
									});
									if (confirmed) {
										deleteFetcher.submit(
											{ maintenanceId: props.window.id },
											{
												method: "POST",
												action: href("/actions/:team/delete-maintenance", {
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
