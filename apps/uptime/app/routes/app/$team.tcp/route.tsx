import { Alert, Badge, Button, Card, confirm, LinkButton, Table } from "@pkg/ui";
import { format } from "date-fns";
import { NetworkIcon, PlusIcon, TrashIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { href, Link, useFetcher } from "react-router";
import { useSpinDelay } from "spin-delay";

import { AppHeader } from "~/components/app-header";
import { useTeam } from "~/hooks/use-team";
import { hasActiveSubscription } from "~/middleware/customer-subscription";
import { db } from "~/middleware/drizzle";
import { logger } from "~/middleware/logger";
import { team } from "~/middleware/team";
import TcpMonitor from "~/models/tcp-monitor";

import type { Route } from "./+types/route";

export async function loader() {
	logger().info("tcp.loader.start", {
		route: "tcp",
		teamId: team().id,
	});

	let tcpMonitors = await TcpMonitor.listByTeam(db(), team().id);

	logger().info("tcp.loader.complete", {
		route: "tcp",
		teamId: team().id,
		tcpMonitorCount: tcpMonitors.length,
	});

	return {
		hasActiveSubscription: await hasActiveSubscription(),
		tcpMonitors: tcpMonitors.map((monitor) => ({
			id: monitor.id,
			name: monitor.name,
			host: monitor.host,
			port: monitor.port,
			isEnabled: monitor.isEnabled,
			lastStatus: monitor.lastStatus,
			lastCheckedAt: monitor.lastCheckedAt,
			lastResponseTimeMs: monitor.lastResponseTimeMs,
		})),
	};
}

export default function TcpMonitorsPage({ loaderData, params }: Route.ComponentProps) {
	let { t } = useTranslation("translation", { keyPrefix: "page.tcpMonitors" });
	let { t: tSidebar } = useTranslation("translation", {
		keyPrefix: "app.layout.sidebar.navigation.items",
	});

	return (
		<>
			<AppHeader
				heading={t("header.title")}
				breadcrumbs={[
					{ label: tSidebar("dashboard"), href: href("/app/:team/dashboard", params) },
					{ label: t("header.title") },
				]}
			>
				<LinkButton color="primary" href={href("/app/:team/tcp/new", { team: params.team })}>
					<PlusIcon className="size-4" />
					{t("header.action.create")}
				</LinkButton>
			</AppHeader>

			{loaderData.hasActiveSubscription ? null : (
				<div className="p-4">
					<Alert color="warning">
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
				{loaderData.tcpMonitors.length === 0 ? (
					<EmptyState teamSlug={params.team} />
				) : (
					<TcpMonitorsTable tcpMonitors={loaderData.tcpMonitors} teamSlug={params.team} />
				)}
			</div>
		</>
	);
}

function EmptyState({ teamSlug }: { teamSlug: string }) {
	let { t } = useTranslation("translation", { keyPrefix: "page.tcpMonitors.empty" });

	return (
		<Card className="flex flex-col items-center justify-center p-12 text-center">
			<NetworkIcon className="mb-4 size-12 text-neutral-400" />
			<h3 className="text-lg font-semibold">{t("title")}</h3>
			<p className="mb-6 text-neutral-500 dark:text-neutral-400">{t("description")}</p>
			<LinkButton color="primary" href={href("/app/:team/tcp/new", { team: teamSlug })}>
				<PlusIcon className="size-4" />
				{t("cta")}
			</LinkButton>
		</Card>
	);
}

function TcpMonitorsTable({
	tcpMonitors,
	teamSlug,
}: {
	tcpMonitors: Array<{
		id: string;
		name: string;
		host: string;
		port: number;
		isEnabled: boolean;
		lastStatus: "up" | "down" | "timeout" | null;
		lastCheckedAt: Date | null;
		lastResponseTimeMs: number | null;
	}>;
	teamSlug: string;
}) {
	let { t } = useTranslation("translation", { keyPrefix: "page.tcpMonitors.table" });

	return (
		<Table aria-label={t("label")}>
			<Table.Header>
				<Table.Column isRowHeader>{t("columns.name")}</Table.Column>
				<Table.Column>{t("columns.endpoint")}</Table.Column>
				<Table.Column>{t("columns.status")}</Table.Column>
				<Table.Column>{t("columns.lastChecked")}</Table.Column>
				<Table.Column>{t("columns.responseTime")}</Table.Column>
				<Table.Column>{t("columns.actions")}</Table.Column>
			</Table.Header>
			<Table.Body items={tcpMonitors}>
				{(monitor) => (
					<Table.Row key={monitor.id}>
						<Table.Cell>
							<Link
								to={href("/app/:team/tcp/:tcpMonitorId", {
									team: teamSlug,
									tcpMonitorId: monitor.id,
								})}
								className="font-medium hover:underline"
							>
								{monitor.name}
							</Link>
						</Table.Cell>
						<Table.Cell>
							<code className="rounded bg-neutral-100 px-2 py-1 text-sm dark:bg-neutral-800">
								{monitor.host}:{monitor.port}
							</code>
						</Table.Cell>
						<Table.Cell>
							<StatusBadge status={monitor.lastStatus} isEnabled={monitor.isEnabled} />
						</Table.Cell>
						<Table.Cell>
							{monitor.lastCheckedAt ? format(monitor.lastCheckedAt, "MMM d, HH:mm") : "-"}
						</Table.Cell>
						<Table.Cell>
							{monitor.lastResponseTimeMs ? `${monitor.lastResponseTimeMs}ms` : "-"}
						</Table.Cell>
						<Table.Cell>
							<TcpMonitorActions monitor={monitor} teamSlug={teamSlug} />
						</Table.Cell>
					</Table.Row>
				)}
			</Table.Body>
		</Table>
	);
}

function StatusBadge({
	status,
	isEnabled,
}: {
	status: "up" | "down" | "timeout" | null;
	isEnabled: boolean;
}) {
	let { t } = useTranslation("translation", { keyPrefix: "page.tcpMonitors.table.status" });

	if (!isEnabled) {
		return <Badge color="neutral">{t("disabled")}</Badge>;
	}

	if (!status) {
		return <Badge color="neutral">{t("pending")}</Badge>;
	}

	let color = {
		up: "success",
		down: "danger",
		timeout: "warning",
	}[status] as "success" | "danger" | "warning";

	return <Badge color={color}>{t(status)}</Badge>;
}

function TcpMonitorActions({
	monitor,
	teamSlug,
}: {
	monitor: { id: string; name: string };
	teamSlug: string;
}) {
	let { t } = useTranslation("translation", { keyPrefix: "page.tcpMonitors.table.actions" });
	let team = useTeam();
	let fetcher = useFetcher();
	let isPending = useSpinDelay(fetcher.state !== "idle", {
		minDuration: 100,
		delay: 50,
	});

	return (
		<div className="flex items-center gap-2">
			<LinkButton
				color="neutral"
				size="sm"
				href={href("/app/:team/tcp/:tcpMonitorId/edit", {
					team: teamSlug,
					tcpMonitorId: monitor.id,
				})}
			>
				{t("edit")}
			</LinkButton>
			<Button
				type="button"
				color="danger"
				size="sm"
				isPending={isPending}
				onPress={async () => {
					let confirmed = await confirm(t("confirmation.delete", { name: monitor.name }), {
						confirmLabel: t("delete"),
						color: "danger",
					});
					if (confirmed) {
						fetcher.submit(
							{ tcpMonitorId: monitor.id },
							{
								method: "POST",
								action: href("/actions/:team/delete-tcp-monitor", { team: team.slug }),
							},
						);
					}
				}}
			>
				<TrashIcon className="size-4" />
			</Button>
		</div>
	);
}
