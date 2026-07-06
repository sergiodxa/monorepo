/**
 * Marketing feature route for the analytics landing page. It composes the shared
 * hero, trust indicators, feature grid, how-it-works steps, and FAQ with copy about
 * visual heatmaps, P99 response-time tracking, uptime percentages, and 365-day data
 * retention. It exists as an SEO page promoting the analytics capability.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import {
	BarChartIcon,
	CalendarIcon,
	ClockIcon,
	GridIcon,
	HistoryIcon,
	LineChartIcon,
	PercentIcon,
	TimerIcon,
	TrendingUpIcon,
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

import type { Route } from "./+types/_landing.features.analytics";
import type { loader as landingLoader } from "./_landing";

export const meta: Route.MetaFunction = ({ data }) => data?.meta ?? [];

export async function loader({ request, context }: Route.LoaderArgs) {
	let { t } = i18next(context);

	return {
		meta: generateMeta({
			title: t("landing.features.analytics.meta.title"),
			description: t("landing.features.analytics.meta.description"),
			url: request.url,
			jsonLd: getSoftwareApplicationSchema({
				name: "Uptime Analytics",
				description:
					"Visual heatmaps, response time tracking, and 365-day data retention. Understand your service reliability at a glance.",
			}),
		}),
	};
}

export default function FeaturesAnalyticsPage() {
	let parentData = useRouteLoaderData<typeof landingLoader>("routes/_landing");
	let isSignedIn = parentData?.isSignedIn ?? false;

	return (
		<>
			<LandingHero
				isSignedIn={isSignedIn}
				badge="Analytics"
				title={
					<>
						365 days of{" "}
						<strong className="text-primary-600 dark:text-primary-400">uptime insights</strong>
					</>
				}
				description="Visual heatmaps, response time trends, and detailed historical data to understand your service reliability."
				highlights={["365-day retention", "Visual heatmaps", "Response time metrics"]}
			/>

			<LandingTrustIndicators
				indicators={[
					{
						icon: <CalendarIcon className="size-6" />,
						value: "365",
						label: "Days Retention",
					},
					{
						icon: <BarChartIcon className="size-6" />,
						value: "Visual",
						label: "Heatmaps",
					},
					{
						icon: <ClockIcon className="size-6" />,
						value: "P99",
						label: "Response Time",
					},
					{
						icon: <TrendingUpIcon className="size-6" />,
						value: "Trends",
						label: "Analysis",
					},
				]}
			/>

			<LandingFeatures
				badge="Deep Dive"
				title="Everything you need to analyze your uptime"
				description="Comprehensive analytics to understand and improve your service reliability."
				features={[
					{
						title: "Visual heatmaps",
						description:
							"See daily success rates at a glance. Green for up, red for down, yellow for mixed.",
						icon: <GridIcon className="size-6" />,
					},
					{
						title: "365-day history",
						description:
							"A full year of data retention. Review past incidents and track improvement.",
						icon: <CalendarIcon className="size-6" />,
					},
					{
						title: "Response time tracking",
						description:
							"Monitor P99 response times. Identify slow endpoints before they become problems.",
						icon: <TimerIcon className="size-6" />,
					},
					{
						title: "Uptime percentage",
						description: "Calculate overall uptime across all monitors or individually.",
						icon: <PercentIcon className="size-6" />,
					},
					{
						title: "Incident timeline",
						description: "See when outages occurred and how long they lasted.",
						icon: <HistoryIcon className="size-6" />,
					},
					{
						title: "Latency trends",
						description: "Track response time changes over time with visual charts.",
						icon: <LineChartIcon className="size-6" />,
					},
				]}
			/>

			<LandingHowItWorks
				title="How analytics works"
				description="Understand your service reliability with powerful insights."
				steps={[
					{
						title: "Monitor your services",
						description: "Every health check is recorded with timestamp and response time.",
					},
					{
						title: "View your dashboard",
						description: "Heatmaps and stats update in real-time as checks complete.",
					},
					{
						title: "Analyze trends",
						description: "Review historical data to identify patterns and improvements.",
					},
				]}
			/>

			<LandingFAQ
				title="Frequently asked questions"
				description="Common questions about analytics and data retention."
				items={[
					{
						question: "How long is data retained?",
						answer: "All monitoring data is stored for 365 days, then automatically deleted.",
					},
					{
						question: "What does the heatmap show?",
						answer:
							"Each cell represents a day. Color indicates success rate: green (high), yellow (mixed), red (low), gray (no data).",
					},
					{
						question: "Can I export data?",
						answer: "Data export is on our roadmap. Currently, view all data in the dashboard.",
					},
					{
						question: "What is P99 response time?",
						answer: "The 99th percentile—99% of checks were faster than this value.",
					},
					{
						question: "How is uptime calculated?",
						answer: "Successful checks divided by total checks, expressed as a percentage.",
					},
					{
						question: "Can I see individual check results?",
						answer: "Yes, click on any heatmap cell to see detailed results for that day.",
					},
				]}
			/>

			<LandingFinalCTA
				isSignedIn={isSignedIn}
				title="Understand your service reliability"
				description="Get actionable insights from 365 days of monitoring data."
			/>
		</>
	);
}
