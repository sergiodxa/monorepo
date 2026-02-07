import { cn } from "@pkg/cn";
import { Alert, Button } from "@pkg/ui";
import { subDays } from "date-fns";
import { PlayIcon, RefreshCwIcon } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { href, Link, redirect, useRevalidator } from "react-router";
import { useSpinDelay } from "spin-delay";

import { ActionButton } from "~/components/action-button";
import { AppHeader } from "~/components/app-header";
import { Heatmap } from "~/components/heatmap";
import { StatCard } from "~/components/stat-card";
import { hasActiveSubscription } from "~/middleware/customer-subscription";
import { db } from "~/middleware/drizzle";
import { locale } from "~/middleware/i18next";
import { measure } from "~/middleware/server-timing";
import { team } from "~/middleware/team";
import Customer from "~/models/customer";
import Monitor from "~/models/monitor";
import daysOfYear from "~/utils/days-of-year";
import groupDatesPerWeek from "~/utils/group-dates-per-week";

import type { Route } from "./+types/route";

export async function loader({ params }: Route.LoaderArgs) {
	let dates = daysOfYear(new Date());
	let weeks = groupDatesPerWeek(dates);

	let [monitor, results, estimated, slowestResult, consumed] = await Promise.all([
		measure("findMonitorById", () => {
			return db().query.monitors.findFirst({
				where(fields, operators) {
					return operators.and(
						operators.eq(fields.id, params.monitorId),
						operators.eq(fields.teamId, team().id),
					);
				},
			});
		}),
		measure("Monitor.getResultsById", () => {
			return Monitor.getResultsById(db(), params.monitorId);
		}),
		measure("Monitor.estimateConsumedPingsByMonitor", () => {
			return Monitor.estimateConsumedPingsByMonitor(db(), params.monitorId, new Date());
		}),
		measure("findSlowestResult", async () => {
			let result = await db().query.monitorResults.findFirst({
				where(fields, operators) {
					return operators.and(
						operators.eq(fields.monitorId, params.monitorId),
						operators.isNotNull(fields.responseTimeMs),
						operators.gte(fields.completedAt, subDays(new Date(), 1)),
					);
				},
				orderBy(fields, operators) {
					return operators.desc(fields.responseTimeMs);
				},
			});

			return result?.responseTimeMs ?? 0;
		}),
		measure("findMonitorUsagePerMonth", () => {
			return Customer.getUsagePerMonth(team().ownerId, { monitorId: params.monitorId }, new Date());
		}),
	]);

	if (!monitor) return redirect(href("/app/:team/dashboard", params));

	return {
		stats: {
			usage: {
				consumed,
				estimated: estimated.toLocaleString(locale(), {
					minimumFractionDigits: 0,
					maximumFractionDigits: 0,
				}),
			},

			slowestResult: slowestResult.toLocaleString(locale(), {
				style: "unit",
				unit: "millisecond",
				minimumFractionDigits: 0,
				maximumFractionDigits: 0,
			}),

			uptime: {
				value: (1).toLocaleString(locale(), {
					style: "percent",
					minimumFractionDigits: 0,
					maximumFractionDigits: 0,
				}),
			},
		},
		hasActiveSubscription: await hasActiveSubscription(),
		monitor: { id: monitor.id, name: monitor.name },
		results,
		weeks,
	};
}

export default function Component({ loaderData, params }: Route.ComponentProps) {
	let { t } = useTranslation("translation", { keyPrefix: "page.monitor" });

	let revalidator = useRevalidator();
	let isRevalidating = useSpinDelay(revalidator.state === "loading", {
		minDuration: 100,
		delay: 50,
	});

	return (
		<>
			<AppHeader heading={t("header.title", { name: loaderData.monitor.name })}>
				<ActionButton
					id={loaderData.monitor.id}
					intent="play"
					label={t("header.action.play")}
					color="neutral"
					action={href("/actions/:team/play-monitor", params)}
				>
					<PlayIcon className="size-5" />
				</ActionButton>

				<Button
					color="neutral"
					type="button"
					onPress={() => revalidator.revalidate()}
					className="flex-shrink-0 px-2"
					isPending={isRevalidating}
				>
					<RefreshCwIcon
						aria-hidden
						className={cn("size-4.5", {
							"animate-spin": isRevalidating,
						})}
					/>
					<span className="max-sm:sr-only">{t("header.action.refresh")}</span>
				</Button>
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

			<div className="flex flex-col gap-12 p-12">
				<div className="grid grid-cols-3 gap-8">
					<StatCard
						label={t("stats.monitors.label")}
						value={
							<Trans
								t={t}
								i18nKey="stats.monitors.value"
								values={{ consumed: loaderData.stats.usage.consumed }}
								components={{
									small: <small className="text-md" />,
								}}
							/>
						}
						description={t("stats.monitors.description", {
							estimated: loaderData.stats.usage.estimated,
						})}
					/>

					<StatCard
						label={t("stats.slowestResult.label")}
						value={loaderData.stats.slowestResult}
						description={t("stats.slowestResult.description")}
					/>

					<StatCard
						label={t("stats.uptime.label")}
						value={loaderData.stats.uptime.value}
						description={t("stats.uptime.description")}
					/>
				</div>

				<Heatmap points={loaderData.results} weeks={loaderData.weeks} size="lg" />
			</div>
		</>
	);
}
