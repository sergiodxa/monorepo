import { Alert, Badge, Card, LinkButton, Table } from "@pkg/ui";
import { format } from "date-fns";
import { PencilIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { href, Link, redirect } from "react-router";

import { AppHeader } from "~/components/app-header";
import { StatCard } from "~/components/stat-card";
import { hasActiveSubscription } from "~/middleware/customer-subscription";
import { db } from "~/middleware/drizzle";
import { team } from "~/middleware/team";
import TcpMonitor from "~/models/tcp-monitor";

import type { Route } from "./+types/route";

export async function loader({ params }: Route.LoaderArgs) {
	let tcpMonitor = await TcpMonitor.findByIdAndTeam(db(), params.tcpMonitorId, team().id);

	if (!tcpMonitor) {
		return redirect(href("/app/:team/tcp", params));
	}

	let results = await TcpMonitor.getResultsByMonitorId(db(), tcpMonitor.id, 50);

	// Calculate stats
	let successCount = results.filter((r) => r.status === "up").length;
	let uptime = results.length > 0 ? (successCount / results.length) * 100 : null;
	let avgResponseTime =
		results.length > 0
			? results
					.filter((r) => r.responseTimeMs)
					.reduce((acc, r) => acc + (r.responseTimeMs ?? 0), 0) /
				results.filter((r) => r.responseTimeMs).length
			: null;

	return {
		hasActiveSubscription: await hasActiveSubscription(),
		tcpMonitor: {
			id: tcpMonitor.id,
			name: tcpMonitor.name,
			host: tcpMonitor.host,
			port: tcpMonitor.port,
			isEnabled: tcpMonitor.isEnabled,
			lastStatus: tcpMonitor.lastStatus,
			lastCheckedAt: tcpMonitor.lastCheckedAt,
			lastResponseTimeMs: tcpMonitor.lastResponseTimeMs,
			timeoutMs: tcpMonitor.timeoutMs,
			intervalSeconds: tcpMonitor.intervalSeconds,
		},
		stats: {
			uptime,
			avgResponseTime,
			totalChecks: results.length,
		},
		results: results.map((r) => ({
			id: r.id,
			status: r.status,
			responseTimeMs: r.responseTimeMs,
			errorMessage: r.errorMessage,
			checkedAt: r.checkedAt,
		})),
	};
}

export default function TcpMonitorDetailPage({ loaderData, params }: Route.ComponentProps) {
	let { t } = useTranslation("translation", { keyPrefix: "page.tcpMonitorDetail" });
	let { t: tSidebar } = useTranslation("translation", {
		keyPrefix: "app.layout.sidebar.navigation.items",
	});

	return (
		<>
			<AppHeader
				heading={loaderData.tcpMonitor.name}
				breadcrumbs={[
					{ label: tSidebar("dashboard"), href: href("/app/:team/dashboard", params) },
					{ label: t("header.breadcrumb.tcpMonitors"), href: href("/app/:team/tcp", params) },
					{ label: loaderData.tcpMonitor.name },
				]}
			>
				<LinkButton
					color="neutral"
					href={href("/app/:team/tcp/:tcpMonitorId/edit", {
						team: params.team,
						tcpMonitorId: loaderData.tcpMonitor.id,
					})}
				>
					<PencilIcon className="size-4" />
					{t("header.action.edit")}
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
				{/* Monitor Info Card */}
				<Card>
					<Card.Header>
						<Card.Title>{t("info.title")}</Card.Title>
					</Card.Header>
					<Card.Content>
						<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
							<div>
								<p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
									{t("info.endpoint")}
								</p>
								<code className="text-lg font-semibold">
									{loaderData.tcpMonitor.host}:{loaderData.tcpMonitor.port}
								</code>
							</div>
							<div>
								<p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
									{t("info.status")}
								</p>
								<StatusBadge
									status={loaderData.tcpMonitor.lastStatus}
									isEnabled={loaderData.tcpMonitor.isEnabled}
								/>
							</div>
							<div>
								<p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
									{t("info.interval")}
								</p>
								<p className="text-lg font-semibold">
									{loaderData.tcpMonitor.intervalSeconds / 60}m
								</p>
							</div>
							<div>
								<p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
									{t("info.timeout")}
								</p>
								<p className="text-lg font-semibold">{loaderData.tcpMonitor.timeoutMs / 1000}s</p>
							</div>
						</div>
					</Card.Content>
				</Card>

				{/* Stats */}
				<div className="grid gap-4 md:grid-cols-3 md:gap-8">
					<StatCard
						label={t("stats.uptime.label")}
						value={
							loaderData.stats.uptime !== null ? `${loaderData.stats.uptime.toFixed(1)}%` : "-"
						}
						description={t("stats.uptime.description")}
					/>
					<StatCard
						label={t("stats.avgResponseTime.label")}
						value={
							loaderData.stats.avgResponseTime !== null
								? `${Math.round(loaderData.stats.avgResponseTime)}ms`
								: "-"
						}
						description={t("stats.avgResponseTime.description")}
					/>
					<StatCard
						label={t("stats.totalChecks.label")}
						value={loaderData.stats.totalChecks.toString()}
						description={t("stats.totalChecks.description")}
					/>
				</div>

				{/* Results History */}
				<Card>
					<Card.Header>
						<Card.Title>{t("results.title")}</Card.Title>
						<Card.Description>{t("results.description")}</Card.Description>
					</Card.Header>
					<Card.Content>
						{loaderData.results.length === 0 ? (
							<p className="py-8 text-center text-neutral-500 dark:text-neutral-400">
								{t("results.empty")}
							</p>
						) : (
							<Table aria-label={t("results.label")}>
								<Table.Header>
									<Table.Column isRowHeader>{t("results.columns.time")}</Table.Column>
									<Table.Column>{t("results.columns.status")}</Table.Column>
									<Table.Column>{t("results.columns.responseTime")}</Table.Column>
									<Table.Column>{t("results.columns.error")}</Table.Column>
								</Table.Header>
								<Table.Body items={loaderData.results}>
									{(result) => (
										<Table.Row key={result.id}>
											<Table.Cell>{format(result.checkedAt, "MMM d, yyyy HH:mm:ss")}</Table.Cell>
											<Table.Cell>
												<ResultStatusBadge status={result.status} />
											</Table.Cell>
											<Table.Cell>
												{result.responseTimeMs ? `${result.responseTimeMs}ms` : "-"}
											</Table.Cell>
											<Table.Cell>
												{result.errorMessage ? (
													<span className="text-red-600 dark:text-red-400 text-sm">
														{result.errorMessage}
													</span>
												) : (
													"-"
												)}
											</Table.Cell>
										</Table.Row>
									)}
								</Table.Body>
							</Table>
						)}
					</Card.Content>
				</Card>
			</div>
		</>
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

function ResultStatusBadge({ status }: { status: "up" | "down" | "timeout" }) {
	let { t } = useTranslation("translation", { keyPrefix: "page.tcpMonitors.table.status" });

	let color = {
		up: "success",
		down: "danger",
		timeout: "warning",
	}[status] as "success" | "danger" | "warning";

	return <Badge color={color}>{t(status)}</Badge>;
}
