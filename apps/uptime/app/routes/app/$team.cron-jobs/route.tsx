/**
 * Route for the team's cron job monitors index page. The loader lists the team's cron job
 * monitors with humanized schedules and subscription status; the component renders them in a
 * table showing status, last ping, and next expected run, with edit and delete actions, or an
 * empty state and a subscription warning. It exists to let teams manage their scheduled-job
 * (heartbeat) monitors.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Alert, Badge, Button, confirm, Empty, LinkButton, Table } from "@pkg/ui";
import { formatDistanceToNow } from "date-fns";
import { ClockIcon, PlusIcon, TrashIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { href, Link, useFetcher } from "react-router";
import { useSpinDelay } from "spin-delay";

import { AppHeader } from "~/components/app-header";
import { useTeam } from "~/hooks/use-team";
import { hasActiveSubscription } from "~/middleware/customer-subscription";
import { db } from "~/middleware/drizzle";
import { logger } from "~/middleware/logger";
import { team } from "~/middleware/team";
import CronJobMonitor from "~/models/cron-job-monitor";

import type { Route } from "./+types/route";

export async function loader() {
	logger().info("cronJobs.loader.start", {
		route: "cron-jobs",
		teamId: team().id,
	});

	let cronJobs = await CronJobMonitor.listByTeam(db(), team().id);

	logger().info("cronJobs.loader.complete", {
		route: "cron-jobs",
		teamId: team().id,
		cronJobCount: cronJobs.length,
	});

	return {
		hasActiveSubscription: await hasActiveSubscription(),
		cronJobs: cronJobs.map((job) => ({
			id: job.id,
			name: job.name,
			cronExpression: job.cronExpression,
			schedule: CronJobMonitor.describeCronExpression(job.cronExpression),
			status: job.status,
			lastPingAt: job.lastPingAt,
			nextExpectedAt: job.nextExpectedAt,
			enabledAt: job.enabledAt,
		})),
	};
}

export default function CronJobsPage({ loaderData, params }: Route.ComponentProps) {
	let { t } = useTranslation("translation", { keyPrefix: "page.cronJobs" });
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
				<LinkButton href={href("/app/:team/cron-jobs/new", { team: params.team })}>
					<PlusIcon className="size-5" aria-hidden />
					<span className="max-sm:sr-only">{t("header.action.create")}</span>
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
				{loaderData.cronJobs.length === 0 ? (
					<EmptyState teamSlug={params.team} />
				) : (
					<CronJobsTable cronJobs={loaderData.cronJobs} teamSlug={params.team} />
				)}
			</div>
		</>
	);
}

function EmptyState({ teamSlug }: { teamSlug: string }) {
	let { t } = useTranslation("translation", { keyPrefix: "page.cronJobs.empty" });

	return (
		<Empty className="mx-auto max-w-md py-16">
			<Empty.Icon>
				<ClockIcon className="size-12" />
			</Empty.Icon>
			<Empty.Title>{t("title")}</Empty.Title>
			<Empty.Description>{t("description")}</Empty.Description>
			<Empty.Action>
				<LinkButton href={href("/app/:team/cron-jobs/new", { team: teamSlug })}>
					<PlusIcon className="size-5" aria-hidden />
					{t("cta")}
				</LinkButton>
			</Empty.Action>
		</Empty>
	);
}

function CronJobsTable({
	cronJobs,
	teamSlug,
}: {
	cronJobs: Array<{
		id: string;
		name: string;
		cronExpression: string;
		schedule: string;
		status: "healthy" | "late" | "missed" | "new";
		lastPingAt: Date | null;
		nextExpectedAt: Date | null;
		enabledAt: Date | null;
	}>;
	teamSlug: string;
}) {
	let { t } = useTranslation("translation", { keyPrefix: "page.cronJobs.table" });

	return (
		<Table aria-label={t("label")}>
			<Table.Header>
				<Table.Column isRowHeader>{t("columns.name")}</Table.Column>
				<Table.Column>{t("columns.schedule")}</Table.Column>
				<Table.Column>{t("columns.status")}</Table.Column>
				<Table.Column>{t("columns.lastPing")}</Table.Column>
				<Table.Column>{t("columns.nextExpected")}</Table.Column>
				<Table.Column>{t("columns.actions")}</Table.Column>
			</Table.Header>
			<Table.Body items={cronJobs}>
				{(job) => (
					<Table.Row key={job.id}>
						<Table.Cell>
							<Link
								to={href("/app/:team/cron-jobs/:cronJobId", {
									team: teamSlug,
									cronJobId: job.id,
								})}
								className="font-medium hover:underline"
							>
								{job.name}
							</Link>
						</Table.Cell>
						<Table.Cell>
							<div className="flex flex-col">
								<span className="text-sm">{job.schedule}</span>
								<code className="text-xs text-neutral-500 dark:text-neutral-400">
									{job.cronExpression}
								</code>
							</div>
						</Table.Cell>
						<Table.Cell>
							<StatusBadge status={job.status} isEnabled={job.enabledAt !== null} />
						</Table.Cell>
						<Table.Cell>
							{job.lastPingAt ? formatDistanceToNow(job.lastPingAt, { addSuffix: true }) : "-"}
						</Table.Cell>
						<Table.Cell>
							{job.nextExpectedAt
								? formatDistanceToNow(job.nextExpectedAt, { addSuffix: true })
								: "-"}
						</Table.Cell>
						<Table.Cell>
							<CronJobActions job={job} teamSlug={teamSlug} />
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

function CronJobActions({
	job,
	teamSlug,
}: {
	job: { id: string; name: string };
	teamSlug: string;
}) {
	let { t } = useTranslation("translation", { keyPrefix: "page.cronJobs.table.actions" });
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
				href={href("/app/:team/cron-jobs/:cronJobId/edit", {
					team: teamSlug,
					cronJobId: job.id,
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
					let confirmed = await confirm(t("confirmation.delete", { name: job.name }), {
						confirmLabel: t("delete"),
						color: "danger",
					});
					if (confirmed) {
						fetcher.submit(
							{ cronJobId: job.id },
							{
								method: "POST",
								action: href("/actions/:team/delete-cron-job", { team: team.slug }),
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
