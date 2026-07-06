/**
 * Marketing use-case route for the cron job monitoring landing page. Alongside the
 * shared hero, trust indicators, feature grid, and FAQ, it defines a local
 * `LandingScenarios` section that showcases real-world cron schedules and grace
 * periods. It exists as an SEO page targeting scheduled-task monitoring use cases.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Badge, Card } from "@pkg/ui";
import {
	ArrowRightLeftIcon,
	BarChartIcon,
	CheckCircleIcon,
	ClockIcon,
	CreditCardIcon,
	DatabaseIcon,
	EyeIcon,
	MailIcon,
	RefreshCwIcon,
	ShieldIcon,
} from "lucide-react";
import { useRouteLoaderData } from "react-router";

import {
	LandingFAQ,
	LandingFeatures,
	LandingFinalCTA,
	LandingHero,
	LandingHowItWorks,
	LandingTrustIndicators,
} from "~/components/landing";
import { generateMeta } from "~/lib/seo";
import { i18next } from "~/middleware/i18next";

import type { Route } from "./+types/_landing.use-cases.cron-jobs";
import type { loader as landingLoader } from "./_landing";

export const meta: Route.MetaFunction = ({ data }) => data?.meta ?? [];

export async function loader({ request, context }: Route.LoaderArgs) {
	let { t } = i18next(context);

	return {
		meta: generateMeta({
			title: t("landing.useCases.cronJobs.meta.title"),
			description: t("landing.useCases.cronJobs.meta.description"),
			url: request.url,
		}),
	};
}

interface Scenario {
	title: string;
	cronExpression: string;
	gracePeriod: string;
	description: string;
}

function LandingScenarios({
	title,
	description,
	scenarios,
}: {
	title: string;
	description: string;
	scenarios: Scenario[];
}) {
	return (
		<section className="py-16 sm:py-24 lg:py-32">
			<div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
				<div className="mx-auto max-w-2xl text-center">
					<Badge color="primary" variant="secondary" className="mb-4">
						Real-World Examples
					</Badge>
					<h2 className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl dark:text-neutral-50">
						{title}
					</h2>
					<p className="mt-4 text-lg text-neutral-600 dark:text-neutral-400">{description}</p>
				</div>

				<div className="mt-16 grid gap-8 md:grid-cols-3">
					{scenarios.map((scenario) => (
						<Card key={scenario.title} className="transition-shadow hover:shadow-lg">
							<Card.Header>
								<Card.Title className="text-xl">{scenario.title}</Card.Title>
								<Card.Description>
									<code className="rounded bg-neutral-100 px-2 py-1 text-sm dark:bg-neutral-800">
										{scenario.cronExpression}
									</code>
									<span className="ml-2 text-sm text-neutral-500">
										+ {scenario.gracePeriod} grace
									</span>
								</Card.Description>
							</Card.Header>
							<Card.Content className="pt-0">
								<p className="text-neutral-600 dark:text-neutral-400">{scenario.description}</p>
							</Card.Content>
						</Card>
					))}
				</div>
			</div>
		</section>
	);
}

export default function UseCasesCronJobsPage() {
	let parentData = useRouteLoaderData<typeof landingLoader>("routes/_landing");
	let isSignedIn = parentData?.isSignedIn ?? false;

	return (
		<>
			<LandingHero
				isSignedIn={isSignedIn}
				badge="Use Case"
				title={
					<>
						Monitor every scheduled task that{" "}
						<strong className="text-primary-600 dark:text-primary-400">
							keeps your business running
						</strong>
					</>
				}
				description="From database backups to report generation, payment processing to data syncs - ensure your critical background jobs never fail silently."
				highlights={[
					"Database backups",
					"ETL pipelines",
					"Subscription billing",
					"Report generation",
				]}
			/>

			<LandingTrustIndicators
				indicators={[
					{
						icon: <ClockIcon className="size-6" />,
						value: "< 1 min",
						label: "Detection Time",
					},
					{
						icon: <EyeIcon className="size-6" />,
						value: "24/7",
						label: "Monitoring",
					},
					{
						icon: <ShieldIcon className="size-6" />,
						value: "365",
						label: "Days Retention",
					},
					{
						icon: <CheckCircleIcon className="size-6" />,
						value: "99.9%",
						label: "Uptime SLA",
					},
				]}
			/>

			<LandingFeatures
				badge="Use Cases"
				title="Critical jobs that need monitoring"
				description="Every scheduled task that powers your business deserves visibility"
				features={[
					{
						icon: <DatabaseIcon className="size-6" />,
						title: "Database backups",
						description:
							"Never lose data because a backup job silently failed. Get alerted immediately when your PostgreSQL, MySQL, or MongoDB backups don't complete.",
					},
					{
						icon: <ArrowRightLeftIcon className="size-6" />,
						title: "ETL & data pipelines",
						description:
							"Monitor data transformation jobs, warehouse syncs, and analytics pipelines. Know instantly when data isn't flowing.",
					},
					{
						icon: <CreditCardIcon className="size-6" />,
						title: "Subscription & billing",
						description:
							"Ensure payment processing, subscription renewals, and invoice generation run on schedule. Don't miss revenue.",
					},
					{
						icon: <BarChartIcon className="size-6" />,
						title: "Report generation",
						description:
							"Daily sales reports, weekly analytics, monthly summaries - make sure stakeholders get their reports on time.",
					},
					{
						icon: <RefreshCwIcon className="size-6" />,
						title: "Cache warming & cleanup",
						description:
							"Monitor cache invalidation, temp file cleanup, and session purging jobs. Keep your infrastructure healthy.",
					},
					{
						icon: <MailIcon className="size-6" />,
						title: "Email queues & notifications",
						description:
							"Watch email digest jobs, notification batches, and newsletter sends. Ensure your communications go out.",
					},
				]}
			/>

			<LandingHowItWorks
				title="Simple integration, powerful monitoring"
				description="Get cron job monitoring running in three steps"
				steps={[
					{
						title: "Create a monitor",
						description: "Set up a cron job monitor with your job's schedule expression.",
					},
					{
						title: "Add a ping call",
						description: "Add a single HTTP request at the end of your script to ping us.",
					},
					{
						title: "Get alerted",
						description: "Receive instant alerts when pings don't arrive on time.",
					},
				]}
			/>

			<LandingScenarios
				title="See it in action"
				description="Common scenarios and how to configure monitoring for them"
				scenarios={[
					{
						title: "Nightly Database Backup",
						cronExpression: "0 2 * * *",
						gracePeriod: "30 min",
						description:
							"Your backup runs at 2 AM. If the backup hasn't pinged by 2:30 AM, you'll know something's wrong before your team arrives.",
					},
					{
						title: "Hourly Data Sync",
						cronExpression: "0 * * * *",
						gracePeriod: "10 min",
						description:
							"Your ETL pulls data every hour. Catch sync failures before they compound into bigger data integrity issues.",
					},
					{
						title: "Weekly Sales Report",
						cronExpression: "0 8 * * 0",
						gracePeriod: "1 hour",
						description:
							"Your sales report runs Sunday at 8 AM. Ensure your team has the data they need for Monday morning meetings.",
					},
				]}
			/>

			<LandingFAQ
				title="Cron job monitoring FAQ"
				description="Common questions about monitoring scheduled tasks"
				items={[
					{
						question: "My jobs run at variable times. Can I still monitor them?",
						answer:
							"Yes, set a longer grace period to accommodate variability. For example, if your job runs between 2:00 and 2:15 AM, set a 30-minute grace period.",
					},
					{
						question: "Can I monitor jobs on multiple servers?",
						answer:
							"Yes, just call the ping endpoint from each server. We'll track them all and alert you if any instance fails to report.",
					},
					{
						question: "What if my job runs successfully but takes longer than expected?",
						answer:
							"Add the ping call at the very end of your script, after all work is complete. This way, you only get a success ping when the job truly finishes.",
					},
					{
						question: "Do you integrate with cron, systemd, Kubernetes CronJobs?",
						answer:
							"Yes, any system that can make an HTTP request can integrate with our monitoring. Simply add a curl command or HTTP POST request at the end of your job script.",
					},
					{
						question: "How do I handle jobs that shouldn't run on weekends?",
						answer:
							"Configure your monitor with a cron expression that matches your job's schedule exactly. We'll only expect pings during scheduled windows.",
					},
				]}
			/>

			<LandingFinalCTA
				isSignedIn={isSignedIn}
				title="Stop silent failures today"
				description="Monitor unlimited cron jobs during your free trial."
			/>
		</>
	);
}
