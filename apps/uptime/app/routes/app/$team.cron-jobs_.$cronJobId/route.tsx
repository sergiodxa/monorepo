import { Alert, Badge, Button, Card, confirm, LinkButton, Table } from "@pkg/ui";
import { format, formatDistanceToNow } from "date-fns";
import { CopyIcon, PencilIcon, TrashIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { href, Link, redirect, useFetcher, useNavigate } from "react-router";
import { toast } from "sonner";
import { useSpinDelay } from "spin-delay";

import { AppHeader } from "~/components/app-header";
import { StatCard } from "~/components/stat-card";
import { useTeam } from "~/hooks/use-team";
import { hasActiveSubscription } from "~/middleware/customer-subscription";
import { db } from "~/middleware/drizzle";
import { logger } from "~/middleware/logger";
import { team } from "~/middleware/team";
import CronJobMonitor from "~/models/cron-job-monitor";

import type { Route } from "./+types/route";

export async function loader({ params }: Route.LoaderArgs) {
	logger().info("cronJobDetail.loader.start", {
		route: "cron-jobs.$cronJobId",
		cronJobId: params.cronJobId,
		teamId: team().id,
	});

	let cronJob = await CronJobMonitor.findByIdAndTeam(db(), params.cronJobId, team().id);

	if (!cronJob) {
		logger().info("cronJobDetail.loader.not-found", {
			route: "cron-jobs.$cronJobId",
			cronJobId: params.cronJobId,
			teamId: team().id,
		});
		return redirect(href("/app/:team/cron-jobs", params));
	}

	let [stats, pings] = await Promise.all([
		CronJobMonitor.getStatsById(db(), cronJob.id, 30),
		CronJobMonitor.getPingsById(db(), cronJob.id, 50),
	]);

	logger().info("cronJobDetail.loader.complete", {
		route: "cron-jobs.$cronJobId",
		cronJobId: cronJob.id,
		teamId: team().id,
		pingCount: pings.length,
	});

	return {
		hasActiveSubscription: await hasActiveSubscription(),
		cronJob: {
			id: cronJob.id,
			name: cronJob.name,
			description: cronJob.description,
			cronExpression: cronJob.cronExpression,
			schedule: CronJobMonitor.describeCronExpression(cronJob.cronExpression),
			gracePeriodSeconds: cronJob.gracePeriodSeconds,
			timezone: cronJob.timezone,
			status: cronJob.status,
			alertOnLate: cronJob.alertOnLate,
			lastPingAt: cronJob.lastPingAt,
			nextExpectedAt: cronJob.nextExpectedAt,
			enabledAt: cronJob.enabledAt,
		},
		stats: {
			totalPings: stats.totalPings,
			onTimePings: stats.onTimePings,
			latePings: stats.latePings,
			successRate: stats.successRate,
		},
		pings: pings.map((ping) => ({
			id: ping.id,
			wasOnTime: ping.wasOnTime,
			sourceIp: ping.sourceIp,
			createdAt: ping.createdAt,
		})),
	};
}

export default function CronJobDetailPage({ loaderData, params }: Route.ComponentProps) {
	let { t } = useTranslation("translation", { keyPrefix: "page.cronJobDetail" });
	let { t: tSidebar } = useTranslation("translation", {
		keyPrefix: "app.layout.sidebar.navigation.items",
	});

	return (
		<>
			<AppHeader
				heading={loaderData.cronJob.name}
				breadcrumbs={[
					{ label: tSidebar("dashboard"), href: href("/app/:team/dashboard", params) },
					{
						label: t("header.breadcrumb.cronJobs"),
						href: href("/app/:team/cron-jobs", params),
					},
					{ label: loaderData.cronJob.name },
				]}
			>
				<LinkButton
					color="neutral"
					href={href("/app/:team/cron-jobs/:cronJobId/edit", {
						team: params.team,
						cronJobId: loaderData.cronJob.id,
					})}
				>
					<PencilIcon className="size-4" />
					{t("header.action.edit")}
				</LinkButton>
				<DeleteButton cronJob={loaderData.cronJob} />
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
				{/* Cron Job Info Card */}
				<Card>
					<Card.Header>
						<Card.Title>{t("info.title")}</Card.Title>
					</Card.Header>
					<Card.Content>
						<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
							<div>
								<p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
									{t("info.schedule")}
								</p>
								<div className="flex flex-col">
									<span className="text-lg font-semibold">{loaderData.cronJob.schedule}</span>
									<code className="text-sm text-neutral-500 dark:text-neutral-400">
										{loaderData.cronJob.cronExpression}
									</code>
								</div>
							</div>
							<div>
								<p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
									{t("info.status")}
								</p>
								<StatusBadge
									status={loaderData.cronJob.status}
									isEnabled={loaderData.cronJob.enabledAt !== null}
								/>
							</div>
							<div>
								<p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
									{t("info.timezone")}
								</p>
								<p className="text-lg font-semibold">{loaderData.cronJob.timezone}</p>
							</div>
							<div>
								<p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
									{t("info.gracePeriod")}
								</p>
								<p className="text-lg font-semibold">
									{Math.round(loaderData.cronJob.gracePeriodSeconds / 60)} min
								</p>
							</div>
						</div>
						{loaderData.cronJob.description && (
							<div className="mt-4">
								<p className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
									{t("info.description")}
								</p>
								<p className="text-sm">{loaderData.cronJob.description}</p>
							</div>
						)}
					</Card.Content>
				</Card>

				{/* Stats */}
				<div className="grid gap-4 md:grid-cols-4 md:gap-8">
					<StatCard
						label={t("stats.totalPings.label")}
						value={loaderData.stats.totalPings.toString()}
						description={t("stats.totalPings.description")}
					/>
					<StatCard
						label={t("stats.onTimeRate.label")}
						value={
							loaderData.stats.totalPings > 0 ? `${loaderData.stats.successRate.toFixed(1)}%` : "-"
						}
						description={t("stats.onTimeRate.description")}
					/>
					<StatCard
						label={t("stats.lastPing.label")}
						value={
							loaderData.cronJob.lastPingAt
								? formatDistanceToNow(loaderData.cronJob.lastPingAt, { addSuffix: true })
								: "-"
						}
						description={t("stats.lastPing.description")}
					/>
					<StatCard
						label={t("stats.nextExpected.label")}
						value={
							loaderData.cronJob.nextExpectedAt
								? formatDistanceToNow(loaderData.cronJob.nextExpectedAt, { addSuffix: true })
								: "-"
						}
						description={t("stats.nextExpected.description")}
					/>
				</div>

				{/* Integration Instructions */}
				<IntegrationInstructions cronJobId={loaderData.cronJob.id} />

				{/* Ping History */}
				<Card>
					<Card.Header>
						<Card.Title>{t("pings.title")}</Card.Title>
						<Card.Description>{t("pings.description")}</Card.Description>
					</Card.Header>
					<Card.Content>
						{loaderData.pings.length === 0 ? (
							<p className="py-8 text-center text-neutral-500 dark:text-neutral-400">
								{t("pings.empty")}
							</p>
						) : (
							<PingHistoryTable pings={loaderData.pings} />
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
	status: "healthy" | "late" | "missed" | "new";
	isEnabled: boolean;
}) {
	let { t } = useTranslation("translation", { keyPrefix: "page.cronJobs.table.status" });

	if (!isEnabled) {
		return <Badge color="neutral">{t("new")}</Badge>;
	}

	let color = {
		healthy: "success",
		late: "warning",
		missed: "danger",
		new: "neutral",
	}[status] as "success" | "warning" | "danger" | "neutral";

	return <Badge color={color}>{t(status)}</Badge>;
}

function DeleteButton({ cronJob }: { cronJob: { id: string; name: string } }) {
	let { t } = useTranslation("translation", { keyPrefix: "page.cronJobDetail" });
	let team = useTeam();
	let navigate = useNavigate();
	let fetcher = useFetcher();
	let isPending = useSpinDelay(fetcher.state !== "idle", {
		minDuration: 100,
		delay: 50,
	});

	return (
		<Button
			type="button"
			color="danger"
			isPending={isPending}
			onPress={async () => {
				let confirmed = await confirm(t("delete.confirmation", { name: cronJob.name }), {
					confirmLabel: t("header.action.delete"),
					color: "danger",
				});
				if (confirmed) {
					fetcher.submit(
						{ cronJobId: cronJob.id },
						{
							method: "POST",
							action: href("/actions/:team/delete-cron-job", { team: team.slug }),
						},
					);
					navigate(href("/app/:team/cron-jobs", { team: team.slug }));
				}
			}}
		>
			<TrashIcon className="size-4" />
			{t("header.action.delete")}
		</Button>
	);
}

function IntegrationInstructions({ cronJobId }: { cronJobId: string }) {
	let { t } = useTranslation("translation", { keyPrefix: "page.cronJobDetail.integration" });

	let pingUrl = `https://uptime.sergiodxa.com/api/v1/cron-jobs/${cronJobId}/ping`;

	let curlExample = `curl -X POST "${pingUrl}" \\
  -H "Authorization: Bearer YOUR_API_KEY"`;

	let bashExample = `# Add to your crontab
0 * * * * /path/to/your/job.sh && curl -X POST "${pingUrl}" -H "Authorization: Bearer YOUR_API_KEY"`;

	let pythonExample = `import requests

# After your job completes successfully
requests.post(
    "${pingUrl}",
    headers={"Authorization": "Bearer YOUR_API_KEY"}
)`;

	let nodeExample = `// After your job completes successfully
await fetch("${pingUrl}", {
  method: "POST",
  headers: { "Authorization": "Bearer YOUR_API_KEY" }
});`;

	async function copyToClipboard(text: string) {
		await navigator.clipboard.writeText(text);
		toast.success("Copied to clipboard");
	}

	return (
		<Card>
			<Card.Header>
				<Card.Title>{t("title")}</Card.Title>
				<Card.Description>{t("description")}</Card.Description>
			</Card.Header>
			<Card.Content className="flex flex-col gap-6">
				{/* Endpoint */}
				<div>
					<p className="mb-2 text-sm font-medium">{t("endpoint")}</p>
					<div className="flex items-center gap-2">
						<code className="flex-1 rounded bg-neutral-100 px-3 py-2 text-sm dark:bg-neutral-800">
							POST {pingUrl}
						</code>
						<Button
							type="button"
							color="neutral"
							size="sm"
							onPress={() => copyToClipboard(pingUrl)}
						>
							<CopyIcon className="size-4" />
						</Button>
					</div>
				</div>

				{/* cURL Example */}
				<div>
					<p className="mb-2 text-sm font-medium">{t("curlExample")}</p>
					<div className="relative">
						<pre className="overflow-x-auto rounded bg-neutral-100 p-3 text-sm dark:bg-neutral-800">
							{curlExample}
						</pre>
						<Button
							type="button"
							color="neutral"
							size="sm"
							className="absolute top-2 right-2"
							onPress={() => copyToClipboard(curlExample)}
						>
							<CopyIcon className="size-4" />
						</Button>
					</div>
				</div>

				{/* Code Examples */}
				<div>
					<p className="mb-2 text-sm font-medium">{t("codeExamples.title")}</p>
					<div className="flex flex-col gap-4">
						{/* Bash/Cron */}
						<div>
							<p className="mb-1 text-xs font-medium text-neutral-500 dark:text-neutral-400">
								{t("codeExamples.bash")}
							</p>
							<div className="relative">
								<pre className="overflow-x-auto rounded bg-neutral-100 p-3 text-sm dark:bg-neutral-800">
									{bashExample}
								</pre>
								<Button
									type="button"
									color="neutral"
									size="sm"
									className="absolute top-2 right-2"
									onPress={() => copyToClipboard(bashExample)}
								>
									<CopyIcon className="size-4" />
								</Button>
							</div>
						</div>

						{/* Python */}
						<div>
							<p className="mb-1 text-xs font-medium text-neutral-500 dark:text-neutral-400">
								{t("codeExamples.python")}
							</p>
							<div className="relative">
								<pre className="overflow-x-auto rounded bg-neutral-100 p-3 text-sm dark:bg-neutral-800">
									{pythonExample}
								</pre>
								<Button
									type="button"
									color="neutral"
									size="sm"
									className="absolute top-2 right-2"
									onPress={() => copyToClipboard(pythonExample)}
								>
									<CopyIcon className="size-4" />
								</Button>
							</div>
						</div>

						{/* Node.js */}
						<div>
							<p className="mb-1 text-xs font-medium text-neutral-500 dark:text-neutral-400">
								{t("codeExamples.nodejs")}
							</p>
							<div className="relative">
								<pre className="overflow-x-auto rounded bg-neutral-100 p-3 text-sm dark:bg-neutral-800">
									{nodeExample}
								</pre>
								<Button
									type="button"
									color="neutral"
									size="sm"
									className="absolute top-2 right-2"
									onPress={() => copyToClipboard(nodeExample)}
								>
									<CopyIcon className="size-4" />
								</Button>
							</div>
						</div>
					</div>
				</div>

				{/* API Key Note */}
				<p className="text-sm text-neutral-500 dark:text-neutral-400">{t("apiKeyNote")}</p>
			</Card.Content>
		</Card>
	);
}

function PingHistoryTable({
	pings,
}: {
	pings: Array<{
		id: string;
		wasOnTime: boolean;
		sourceIp: string | null;
		createdAt: Date;
	}>;
}) {
	let { t } = useTranslation("translation", { keyPrefix: "page.cronJobDetail.pings" });

	return (
		<Table aria-label={t("label")}>
			<Table.Header>
				<Table.Column isRowHeader>{t("columns.time")}</Table.Column>
				<Table.Column>{t("columns.status")}</Table.Column>
				<Table.Column>{t("columns.sourceIp")}</Table.Column>
			</Table.Header>
			<Table.Body items={pings}>
				{(ping) => (
					<Table.Row key={ping.id}>
						<Table.Cell>{format(ping.createdAt, "MMM d, yyyy HH:mm:ss")}</Table.Cell>
						<Table.Cell>
							<Badge color={ping.wasOnTime ? "success" : "warning"}>
								{ping.wasOnTime ? t("status.onTime") : t("status.late")}
							</Badge>
						</Table.Cell>
						<Table.Cell>
							{ping.sourceIp ? (
								<code className="text-sm">{ping.sourceIp}</code>
							) : (
								<span className="text-neutral-500 dark:text-neutral-400">-</span>
							)}
						</Table.Cell>
					</Table.Row>
				)}
			</Table.Body>
		</Table>
	);
}
