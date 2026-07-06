/**
 * Route module for the DNS monitor detail page. Its loader fetches a single team-scoped
 * DNS monitor plus its recent check results and derives stats (total checks, success rate,
 * average response time), and the component renders the monitor info, stat cards, and a
 * history table while offering manual re-check, refresh, and edit actions.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Badge, Button, LinkButton, Table } from "@pkg/ui";
import { LoaderIcon, PencilIcon, PlayIcon, RefreshCwIcon } from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { data, href, useFetcher, useRevalidator } from "react-router";
import { useSpinDelay } from "spin-delay";

import { AppHeader } from "~/components/app-header";
import { StatCard } from "~/components/stat-card";
import { useTeam } from "~/hooks/use-team";
import { db } from "~/middleware/drizzle";
import { locale } from "~/middleware/i18next";
import { logger } from "~/middleware/logger";
import { measure } from "~/middleware/server-timing";
import { team } from "~/middleware/team";
import { getDnsStatusColor, getDnsStatusText } from "~/services/check-dns";
import { getHints } from "~/utils/client-hints";

import type { Route } from "./+types/route";

export async function loader({ params, request }: Route.LoaderArgs) {
	logger().info("dnsMonitorDetail.loader.start", {
		route: "dns.$dnsMonitorId",
		dnsMonitorId: params.dnsMonitorId,
		teamId: team().id,
	});

	let clientLocale = locale();
	let timeZone = getHints(request).timeZone;

	let dnsMonitor = await measure("findDnsMonitor", () => {
		return db().query.dnsMonitors.findFirst({
			where(fields, operators) {
				return operators.and(
					operators.eq(fields.id, params.dnsMonitorId),
					operators.eq(fields.teamId, team().id),
				);
			},
		});
	});

	if (!dnsMonitor) {
		logger().info("dnsMonitorDetail.loader.not-found", {
			route: "dns.$dnsMonitorId",
			dnsMonitorId: params.dnsMonitorId,
			teamId: team().id,
		});
		throw data({ message: "DNS Monitor not found" }, { status: 404 });
	}

	let results = await measure("findDnsMonitorResults", () => {
		return db().query.dnsMonitorResults.findMany({
			where(fields, operators) {
				return operators.eq(fields.dnsMonitorId, params.dnsMonitorId);
			},
			orderBy(fields, operators) {
				return operators.desc(fields.checkedAt);
			},
			limit: 50,
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

	// Calculate stats
	let totalChecks = results.length;
	let okChecks = results.filter((r) => r.status === "ok").length;
	let successRate = totalChecks > 0 ? Math.round((okChecks / totalChecks) * 100) : null;

	// Average response time
	let responseTimes = results.filter((r) => r.responseTimeMs != null).map((r) => r.responseTimeMs!);
	let avgResponseTime =
		responseTimes.length > 0
			? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
			: null;

	logger().info("dnsMonitorDetail.loader.complete", {
		route: "dns.$dnsMonitorId",
		dnsMonitorId: dnsMonitor.id,
		teamId: team().id,
		resultsCount: results.length,
		successRate,
	});

	return {
		dnsMonitor: {
			...dnsMonitor,
			lastCheckedAtFormatted: formatDate(dnsMonitor.lastCheckedAt),
		},
		results: results.map((r) => ({
			...r,
			checkedAtFormatted: formatDate(r.checkedAt),
		})),
		stats: {
			totalChecks,
			successRate,
			avgResponseTime,
		},
	};
}

export default function Component({ loaderData, params }: Route.ComponentProps) {
	let { t } = useTranslation("translation", { keyPrefix: "page.dnsMonitorDetail" });
	let { t: tSidebar } = useTranslation("translation", {
		keyPrefix: "app.layout.sidebar.navigation.items",
	});
	let team = useTeam();
	let id = useId();
	let revalidator = useRevalidator();

	let checkFetcher = useFetcher();
	let isChecking = useSpinDelay(checkFetcher.state !== "idle", {
		minDuration: 100,
		delay: 50,
	});

	let statusColor = getDnsStatusColor(loaderData.dnsMonitor.lastStatus);
	let statusText = getDnsStatusText(loaderData.dnsMonitor.lastStatus);
	let badgeColor: "success" | "warning" | "danger" | "neutral" =
		statusColor === "error" ? "danger" : statusColor;

	return (
		<>
			<AppHeader
				heading={t("header.title", { name: loaderData.dnsMonitor.name })}
				breadcrumbs={[
					{ label: tSidebar("dnsMonitors"), href: href("/app/:team/dns", params) },
					{ label: loaderData.dnsMonitor.name },
				]}
			>
				<Button
					color="neutral"
					className="p-2"
					isDisabled={isChecking}
					onPress={() => {
						checkFetcher.submit(
							{ dnsMonitorId: loaderData.dnsMonitor.id },
							{
								method: "POST",
								action: href("/actions/:team/check-dns-monitor", {
									team: team.slug,
								}),
							},
						);
						setTimeout(() => revalidator.revalidate(), 1000);
					}}
				>
					{isChecking ? (
						<LoaderIcon className="size-5 animate-spin" aria-hidden />
					) : (
						<PlayIcon className="size-5" aria-hidden />
					)}
					<span className="sr-only">{t("header.action.check")}</span>
				</Button>
				<Button
					color="neutral"
					className="p-2"
					onPress={() => revalidator.revalidate()}
					isDisabled={revalidator.state !== "idle"}
				>
					<RefreshCwIcon
						className={`size-5 ${revalidator.state !== "idle" ? "animate-spin" : ""}`}
						aria-hidden
					/>
					<span className="sr-only">{t("header.action.refresh")}</span>
				</Button>
				<LinkButton
					color="neutral"
					href={href("/app/:team/dns/:dnsMonitorId/edit", {
						team: team.slug,
						dnsMonitorId: loaderData.dnsMonitor.id,
					})}
					className="px-2"
				>
					<PencilIcon className="size-5" aria-hidden />
					<span className="max-sm:sr-only">{t("header.action.edit")}</span>
				</LinkButton>
			</AppHeader>

			<div className="flex flex-col gap-6 p-5 md:gap-12 md:p-12">
				{/* Monitor Info */}
				<div className="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
					<div className="flex flex-wrap items-center gap-4">
						<div>
							<span className="text-sm text-neutral-500">{t("info.domain")}</span>
							<p className="font-mono text-lg">{loaderData.dnsMonitor.domain}</p>
						</div>
						<div>
							<span className="text-sm text-neutral-500">{t("info.recordType")}</span>
							<p>
								<Badge color="neutral" variant="outline">
									{loaderData.dnsMonitor.recordType}
								</Badge>
							</p>
						</div>
						<div>
							<span className="text-sm text-neutral-500">{t("info.status")}</span>
							<p>
								<Badge color={badgeColor} variant="outline">
									{statusText}
								</Badge>
							</p>
						</div>
						{loaderData.dnsMonitor.expectedValue && (
							<div>
								<span className="text-sm text-neutral-500">{t("info.expectedValue")}</span>
								<p className="font-mono">{loaderData.dnsMonitor.expectedValue}</p>
							</div>
						)}
						{loaderData.dnsMonitor.lastValue && (
							<div>
								<span className="text-sm text-neutral-500">{t("info.currentValue")}</span>
								<p className="font-mono">{loaderData.dnsMonitor.lastValue}</p>
							</div>
						)}
					</div>
				</div>

				{/* Stats */}
				<div className="grid gap-4 md:grid-cols-3">
					<StatCard
						label={t("stats.totalChecks.label")}
						value={loaderData.stats.totalChecks.toString()}
						description={t("stats.totalChecks.description")}
					/>
					<StatCard
						label={t("stats.successRate.label")}
						value={
							loaderData.stats.successRate !== null ? `${loaderData.stats.successRate}%` : "N/A"
						}
						description={t("stats.successRate.description")}
					/>
					<StatCard
						label={t("stats.avgResponseTime.label")}
						value={
							loaderData.stats.avgResponseTime !== null
								? `${loaderData.stats.avgResponseTime}ms`
								: "N/A"
						}
						description={t("stats.avgResponseTime.description")}
					/>
				</div>

				{/* Results History */}
				<div className="flex flex-col gap-4">
					<h2 id={`${id}-results-table`} className="text-lg font-semibold">
						{t("results.title")}
					</h2>

					{loaderData.results.length === 0 ? (
						<p className="text-neutral-500">{t("results.empty")}</p>
					) : (
						<ResultsTable results={loaderData.results} labelId={`${id}-results-table`} />
					)}
				</div>
			</div>
		</>
	);
}

type DnsMonitorResult = Route.ComponentProps["loaderData"]["results"][number];

function ResultsTable(props: { results: DnsMonitorResult[]; labelId: string }) {
	let { t } = useTranslation("translation", { keyPrefix: "page.dnsMonitorDetail.results.table" });

	let columns = [
		{ id: "checkedAt" as const, name: t("columns.checkedAt"), align: "left" as const },
		{ id: "status" as const, name: t("columns.status"), align: "center" as const },
		{ id: "value" as const, name: t("columns.value"), align: "left" as const },
		{ id: "responseTime" as const, name: t("columns.responseTime"), align: "right" as const },
	];

	return (
		<div className="-mx-5 w-[calc(100%+2.5rem)] overflow-x-auto px-5 md:mx-0 md:w-full md:px-0">
			<Table aria-labelledby={props.labelId}>
				<Table.Header columns={columns}>
					{(column) => (
						<Table.Column align={column.align} isRowHeader={column.id === "checkedAt"}>
							{column.name}
						</Table.Column>
					)}
				</Table.Header>

				<Table.Body items={props.results}>
					{(result) => <ResultRow key={result.id} result={result} />}
				</Table.Body>
			</Table>
		</div>
	);
}

function ResultRow(props: { result: DnsMonitorResult }) {
	let statusColor = getDnsStatusColor(props.result.status);
	let statusText = getDnsStatusText(props.result.status);
	let badgeColor: "success" | "warning" | "danger" | "neutral" =
		statusColor === "error" ? "danger" : statusColor;

	return (
		<Table.Row>
			<Table.Cell>{props.result.checkedAtFormatted}</Table.Cell>
			<Table.Cell className="text-center">
				<Badge color={badgeColor} variant="outline">
					{statusText}
				</Badge>
			</Table.Cell>
			<Table.Cell className="max-w-xs truncate font-mono text-sm">
				{props.result.resolvedValue ?? props.result.errorMessage ?? "-"}
			</Table.Cell>
			<Table.Cell className="text-right">
				{props.result.responseTimeMs != null ? `${props.result.responseTimeMs}ms` : "-"}
			</Table.Cell>
		</Table.Row>
	);
}
