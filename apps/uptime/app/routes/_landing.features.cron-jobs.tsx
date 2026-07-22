/**
 * Marketing feature route for the cron job monitoring landing page. It renders the
 * hero, trust indicators, feature grid, how-it-works steps, multi-language ping
 * integration code samples, and FAQ describing heartbeat monitoring for scheduled
 * tasks. It exists as an SEO page promoting the cron monitoring capability.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Card } from "@pkg/ui";
import {
	AlarmClockIcon,
	BellIcon,
	CalendarIcon,
	ClockIcon,
	CodeIcon,
	GlobeIcon,
	KeyIcon,
	LayoutDashboardIcon,
	ShieldCheckIcon,
	TimerIcon,
	ZapIcon,
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
import { generateMeta, getSoftwareApplicationSchema } from "~/lib/seo";
import { i18next } from "~/middleware/i18next";

import type { Route } from "./+types/_landing.features.cron-jobs";
import type { loader as landingLoader } from "./_landing";

export const meta: Route.MetaFunction = ({ loaderData }) => loaderData?.meta ?? [];

export async function loader({ request, context }: Route.LoaderArgs) {
	let { t } = i18next(context);

	return {
		meta: generateMeta({
			title: t("landing.features.cron-jobs.meta.title"),
			description: t("landing.features.cron-jobs.meta.description"),
			url: request.url,
			jsonLd: getSoftwareApplicationSchema({
				name: "Uptime Cron Job Monitoring",
				description:
					"Monitor your cron jobs, scheduled tasks, and background processes. Get instant alerts when they fail to run. Simple API integration.",
			}),
		}),
	};
}

export default function FeaturesCronJobsPage() {
	let parentData = useRouteLoaderData<typeof landingLoader>("routes/_landing");
	let isSignedIn = parentData?.isSignedIn ?? false;

	return (
		<>
			<LandingHero
				isSignedIn={isSignedIn}
				badge="Cron Job Monitoring"
				title={
					<>
						Never Miss a Failed Cron Job{" "}
						<strong className="text-primary-600 dark:text-primary-400">Again</strong>
					</>
				}
				description="Monitor your scheduled tasks, database backups, and background jobs. Get instant alerts when they don't run on time."
				highlights={["Flexible cron syntax", "Configurable grace periods", "Multi-channel alerts"]}
			/>

			<LandingTrustIndicators
				indicators={[
					{
						icon: <ShieldCheckIcon className="size-6" />,
						value: "99.9%",
						label: "Uptime SLA",
					},
					{
						icon: <ZapIcon className="size-6" />,
						value: "< 60s",
						label: "Alert Latency",
					},
					{
						icon: <ClockIcon className="size-6" />,
						value: "24/7",
						label: "Monitoring",
					},
					{
						icon: <CalendarIcon className="size-6" />,
						value: "365d",
						label: "Retention",
					},
				]}
			/>

			<LandingFeatures
				badge="Features"
				title="Everything you need to monitor scheduled tasks"
				description="Comprehensive cron job monitoring with flexible configuration and instant alerts."
				features={[
					{
						title: "Flexible Scheduling",
						description:
							"Support for full cron syntax including @hourly, @daily, @weekly, @monthly, and @yearly shortcuts.",
						icon: <CalendarIcon className="size-6" />,
					},
					{
						title: "Configurable Grace Periods",
						description:
							"Set how long to wait before alerting. Perfect for jobs with variable run times.",
						icon: <TimerIcon className="size-6" />,
					},
					{
						title: "Instant Alerts",
						description:
							"Get notified via email, Slack, Discord, or webhooks when jobs fail or run late.",
						icon: <BellIcon className="size-6" />,
					},
					{
						title: "Status Page Integration",
						description:
							"Show cron job status on your public status page to keep stakeholders informed.",
						icon: <LayoutDashboardIcon className="size-6" />,
					},
					{
						title: "Simple API",
						description:
							"Single POST request to record a ping. Add one line of code to any script or job.",
						icon: <CodeIcon className="size-6" />,
					},
					{
						title: "Timezone Support",
						description: "Configure schedules in any timezone. No more UTC conversion headaches.",
						icon: <GlobeIcon className="size-6" />,
					},
				]}
			/>

			<LandingHowItWorks
				title="Get started in three steps"
				description="Set up cron job monitoring in minutes with our simple API."
				steps={[
					{
						title: "Create a monitor",
						description: "Define your cron schedule and configure the grace period for your job.",
					},
					{
						title: "Add a ping to your job",
						description:
							"One line of code at the end of your script sends a ping when the job completes.",
					},
					{
						title: "Get alerted",
						description:
							"We notify you if the ping doesn't arrive on time via your preferred channel.",
					},
				]}
			/>

			<section className="border-border bg-muted/30 border-y py-20">
				<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
					<div className="mb-12 text-center">
						<div className="bg-primary/10 text-primary mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium">
							<KeyIcon className="size-4" />
							Integration Examples
						</div>
						<h2 className="text-foreground text-3xl font-bold tracking-tight sm:text-4xl">
							One line of code. Any language.
						</h2>
						<p className="text-muted-foreground mx-auto mt-4 max-w-2xl text-lg">
							Add a simple HTTP request at the end of your job to ping our API.
						</p>
					</div>

					<div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
						<Card>
							<Card.Header>
								<Card.Title className="flex items-center gap-2 text-lg">
									<AlarmClockIcon className="size-5" />
									Bash / Cron
								</Card.Title>
							</Card.Header>
							<Card.Content>
								<pre className="bg-muted overflow-x-auto rounded-lg p-4 text-sm">
									<code className="text-foreground">{`0 * * * * /path/to/backup.sh && \\
  curl -X POST \\
  https://api.example.com/api/v1/cron-jobs/xxx/ping \\
  -H "Authorization: Bearer YOUR_API_KEY"`}</code>
								</pre>
							</Card.Content>
						</Card>

						<Card>
							<Card.Header>
								<Card.Title className="flex items-center gap-2 text-lg">
									<CodeIcon className="size-5" />
									Python
								</Card.Title>
							</Card.Header>
							<Card.Content>
								<pre className="bg-muted overflow-x-auto rounded-lg p-4 text-sm">
									<code className="text-foreground">{`import requests

# ... your job code ...

requests.post(
    "https://api.example.com/api/v1/cron-jobs/xxx/ping",
    headers={"Authorization": "Bearer YOUR_API_KEY"}
)`}</code>
								</pre>
							</Card.Content>
						</Card>

						<Card>
							<Card.Header>
								<Card.Title className="flex items-center gap-2 text-lg">
									<CodeIcon className="size-5" />
									Node.js
								</Card.Title>
							</Card.Header>
							<Card.Content>
								<pre className="bg-muted overflow-x-auto rounded-lg p-4 text-sm">
									<code className="text-foreground">{`// ... your job code ...

await fetch(
  "https://api.example.com/api/v1/cron-jobs/xxx/ping",
  {
    method: "POST",
    headers: { "Authorization": "Bearer YOUR_API_KEY" }
  }
);`}</code>
								</pre>
							</Card.Content>
						</Card>
					</div>
				</div>
			</section>

			<LandingFAQ
				title="Frequently asked questions"
				description="Common questions about cron job monitoring."
				items={[
					{
						question: "What cron syntax is supported?",
						answer:
							"Full 5-field cron syntax plus @hourly, @daily, @weekly, @monthly, and @yearly shortcuts. We support any valid cron expression.",
					},
					{
						question: "What happens if my job runs late?",
						answer:
							"This is configurable per-monitor. You can choose to alert on late runs or only when they're missed entirely based on your grace period settings.",
					},
					{
						question: "How do I get an API key?",
						answer:
							"Create one in your team settings with the cron-jobs:ping scope. API keys can be scoped to specific permissions for security.",
					},
					{
						question: "Can I monitor jobs that run less than once per minute?",
						answer:
							"Yes, we support any valid cron schedule from once per minute to once per year. Configure whatever schedule fits your needs.",
					},
					{
						question: "Do cron job pings count toward my quota?",
						answer:
							"Yes, each ping counts as one request toward your monthly quota. Check your plan details for limits.",
					},
				]}
			/>

			<LandingFinalCTA
				isSignedIn={isSignedIn}
				title="Start monitoring your cron jobs"
				description="Set up in under 5 minutes. No credit card required."
			/>
		</>
	);
}
