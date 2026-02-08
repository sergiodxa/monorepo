import type { TFunction } from "i18next";

import { cn } from "@pkg/cn";
import { Alert, Button, confirm, Empty, LinkButton, Menu, Popover, Skeleton, Table } from "@pkg/ui";
import {
	BellIcon,
	BellMinusIcon,
	BellPlusIcon,
	EllipsisVerticalIcon,
	HistoryIcon,
	LoaderIcon,
	TriangleAlertIcon,
} from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { href, Link, useFetcher } from "react-router";
import { useSpinDelay } from "spin-delay";

import { AppHeader } from "~/components/app-header";
import { useTeam } from "~/hooks/use-team";
import { hasActiveSubscription } from "~/middleware/customer-subscription";
import { db } from "~/middleware/drizzle";
import { logger } from "~/middleware/logger";
import { measure } from "~/middleware/server-timing";
import { team } from "~/middleware/team";

import type { Route } from "./+types/route";

function formatCooldown(minutes: number, t: TFunction<"translation", "page.alerts.table">): string {
	if (minutes === 0) {
		return t("cooldown.none");
	}
	if (minutes >= 60) {
		let hours = Math.floor(minutes / 60);
		return t("cooldown.hours", { count: hours });
	}
	return t("cooldown.minutes", { count: minutes });
}

export async function clientLoader({ serverLoader }: Route.ClientLoaderArgs) {
	return await serverLoader();
}

clientLoader.hydrate = true as const;

export function HydrateFallback() {
	return (
		<>
			<header className="sticky top-0 z-10 flex h-16 flex-shrink-0 items-center gap-2 border-b border-neutral-200 bg-neutral-50/80 px-4 dark:border-neutral-800 dark:bg-neutral-950/80">
				<Skeleton className="h-6 w-16" />
				<aside className="ml-auto flex items-center gap-2">
					<Skeleton className="h-10 w-10 rounded-lg max-sm:w-10 sm:w-28" />
				</aside>
			</header>

			<div className="flex flex-col gap-6 p-5 md:gap-12 md:p-12">
				<AlertsTableSkeleton />
			</div>
		</>
	);
}

function AlertsTableSkeleton() {
	return (
		<Table aria-label="Loading alerts">
			<Table.Header>
				<Table.Column isRowHeader>
					<Skeleton className="h-4 w-16" />
				</Table.Column>
				<Table.Column align="right">
					<Skeleton className="ml-auto h-4 w-16" />
				</Table.Column>
				<Table.Column align="center">
					<span className="sr-only">Actions</span>
				</Table.Column>
			</Table.Header>

			<Table.Body items={[{ id: "1" }, { id: "2" }, { id: "3" }]}>
				{(item) => (
					<Table.Row key={item.id}>
						<Table.Cell>
							<Skeleton className="h-4 w-32" />
						</Table.Cell>
						<Table.Cell className="w-28 text-right">
							<Skeleton className="ml-auto h-4 w-16" />
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

export async function loader() {
	logger().info("alerts.loader.start", {
		route: "alerts",
		teamId: team().id,
	});

	let alerts = await measure("findAlerts", () => {
		return db().query.alerts.findMany({
			where(fields, operators) {
				return operators.eq(fields.teamId, team().id);
			},
		});
	});

	logger().info("alerts.loader.complete", {
		route: "alerts",
		teamId: team().id,
		alertCount: alerts.length,
	});

	return { alerts, hasActiveSubscription: await hasActiveSubscription() };
}

export default function Component({ loaderData, params }: Route.ComponentProps) {
	let { t } = useTranslation("translation", { keyPrefix: "page.alerts" });
	let id = useId();

	let columns = [
		{
			id: "name" as const,
			name: t("table.columns.name"),
			align: "left" as const,
		},
		{
			id: "strategy" as const,
			name: t("table.columns.strategy"),
			align: "center" as const,
		},
		{
			id: "notifyOnRecovery" as const,
			name: t("table.columns.notifyOnRecovery"),
			align: "center" as const,
		},
		{
			id: "cooldown" as const,
			name: t("table.columns.cooldown"),
			align: "center" as const,
		},
		{
			id: "actions" as const,
			name: t("table.columns.actions"),
			align: "center" as const,
		},
	];

	return (
		<>
			<AppHeader heading={t("header.title")}>
				<LinkButton
					color="neutral"
					href={href("/app/:team/alert-history", params)}
					className="flex-shrink-0 px-2"
				>
					<HistoryIcon className="size-5" aria-hidden />
					<span className="max-sm:sr-only">{t("header.action.history")}</span>
				</LinkButton>
				{loaderData.alerts.length < 10 && (
					<LinkButton
						color="neutral"
						href={href("/app/:team/alerts/new", params)}
						className="flex-shrink-0 px-2"
					>
						<BellPlusIcon className="size-5" aria-hidden />
						<span className="max-sm:sr-only">{t("header.action.create")}</span>
					</LinkButton>
				)}
			</AppHeader>

			{loaderData.hasActiveSubscription ? null : (
				<div className="p-4">
					<Alert color="warning">
						<Alert.Icon>
							<TriangleAlertIcon className="size-5" />
						</Alert.Icon>
						<Alert.Content>
							<Alert.Title>{t("alert.subscription.title")}</Alert.Title>
							<Alert.Description>{t("alert.subscription.description")}</Alert.Description>
						</Alert.Content>
						<Alert.Action>
							<Link to={href("/app/:team/checkout", params)}>{t("alert.subscription.cta")}</Link>
						</Alert.Action>
					</Alert>
				</div>
			)}

			<div className="flex flex-col gap-6 p-5 md:gap-12 md:p-12">
				{loaderData.alerts.length === 0 ? (
					<Empty className="mx-auto max-w-md py-16">
						<Empty.Icon>
							<BellIcon className="size-12" />
						</Empty.Icon>
						<Empty.Title>{t("empty.title")}</Empty.Title>
						<Empty.Description>{t("empty.description")}</Empty.Description>
						<Empty.Action>
							<LinkButton href={href("/app/:team/alerts/new", params)}>
								<BellPlusIcon className="size-5" aria-hidden />
								{t("empty.cta")}
							</LinkButton>
						</Empty.Action>
					</Empty>
				) : (
					<div className="flex flex-col gap-4">
						<h2 id={`${id}-members-table`}>{t("table.label")}</h2>

						<Table aria-labelledby={`{id}-members-table`}>
							<Table.Header columns={columns}>
								{(column: (typeof columns)[number]) => {
									return (
										<Table.Column align={column.align} isRowHeader={column.id === "name"}>
											<span
												className={cn({
													"sr-only": column.id === "actions",
												})}
											>
												{column.name}
											</span>
										</Table.Column>
									);
								}}
							</Table.Header>

							<Table.Body items={loaderData.alerts}>
								{(alert: (typeof loaderData.alerts)[number]) => <AlertTableRow alert={alert} />}
							</Table.Body>
						</Table>
					</div>
				)}
			</div>
		</>
	);
}

function AlertTableRow(props: { alert: Route.ComponentProps["loaderData"]["alerts"][number] }) {
	let { t } = useTranslation("translation", {
		keyPrefix: "page.alerts.table",
	});

	let team = useTeam();

	let removeAlert = useFetcher();
	let isRemovingAlert = useSpinDelay(removeAlert.state !== "idle", {
		minDuration: 100,
		delay: 50,
	});

	return (
		<Table.Row>
			<Table.Cell>
				<span className="font-semibold">{props.alert.name}</span>
			</Table.Cell>
			<Table.Cell className="w-28 text-center">
				{props.alert.config.strategy === "email"
					? t("types.email")
					: props.alert.config.strategy === "slack"
						? t("types.slack")
						: props.alert.config.strategy === "discord"
							? t("types.discord")
							: t("types.webhook")}
			</Table.Cell>
			<Table.Cell className="w-28 text-center">
				{props.alert.notifyOnRecovery
					? t("notifyOnRecovery.enabled")
					: t("notifyOnRecovery.disabled")}
			</Table.Cell>
			<Table.Cell className="w-28 text-center">
				{formatCooldown(props.alert.cooldownMinutes, t)}
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
								danger
								isDisabled={isRemovingAlert}
								onAction={async () => {
									let confirmed = await confirm(t("confirmation.deleteAlert", props.alert), {
										confirmLabel: t("actions.remove"),
										color: "danger",
									});
									if (confirmed) {
										removeAlert.submit(
											{ alertId: props.alert.id },
											{
												method: "POST",
												action: href("/actions/:team/remove-alert", {
													team: team.slug,
												}),
											},
										);
									}
								}}
							>
								<BellMinusIcon aria-hidden className="size-5" />
								<span>{t(`actions.remove`)}</span>
								{isRemovingAlert && (
									<LoaderIcon aria-hidden className="ml-auto size-5 animate-spin" />
								)}
							</Menu.Item>
						</Menu>
					</Popover>
				</Menu.Trigger>
			</Table.Cell>
		</Table.Row>
	);
}
