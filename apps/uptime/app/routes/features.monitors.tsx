import {
	ActivityIcon,
	CalendarIcon,
	ClockIcon,
	DatabaseIcon,
	GlobeIcon,
	GridIcon,
	PlayIcon,
	ShieldCheckIcon,
	TimerIcon,
} from "lucide-react";

import { LandingFAQ } from "~/components/landing/faq";
import { LandingFeatures } from "~/components/landing/features";
import { LandingFinalCTA } from "~/components/landing/final-cta";
import { LandingFooter } from "~/components/landing/footer";
import { LandingHeader } from "~/components/landing/header";
import { LandingHero } from "~/components/landing/hero";
import { LandingHowItWorks } from "~/components/landing/how-it-works";
import { LandingTrustIndicators } from "~/components/landing/trust-indicators";
import { getSession } from "~/middleware/session";

import type { Route } from "./+types/features.monitors";

export function meta(): Route.MetaDescriptors {
	return [
		{ title: "HTTP Monitoring | Uptime Monitors" },
		{
			name: "description",
			content:
				"HTTP health checks from 9 global regions. Monitor any URL with 1-60 minute intervals and 365-day data retention.",
		},
	];
}

export async function loader() {
	let session = getSession();
	return { isSignedIn: session.has("id") };
}

export default function FeaturesMonitorsPage({ loaderData }: Route.ComponentProps) {
	let { isSignedIn } = loaderData;

	return (
		<div className="min-h-screen bg-white dark:bg-neutral-950">
			<LandingHeader isSignedIn={isSignedIn} />

			<main>
				<LandingHero
					isSignedIn={isSignedIn}
					badge="Monitors"
					title={
						<>
							Know when your service goes down{" "}
							<strong className="text-primary-600 dark:text-primary-400">
								before your users do
							</strong>
						</>
					}
					description="HTTP health checks from 9 global regions. Monitor any URL with customizable intervals from 1 to 60 minutes."
					highlights={["9 global regions", "1-60 min intervals", "Any HTTP status code"]}
				/>

				<LandingTrustIndicators
					indicators={[
						{
							icon: <GlobeIcon className="size-6" />,
							value: "9",
							label: "Global Regions",
						},
						{
							icon: <ClockIcon className="size-6" />,
							value: "1-60m",
							label: "Check Intervals",
						},
						{
							icon: <ActivityIcon className="size-6" />,
							value: "HTTP",
							label: "Health Checks",
						},
						{
							icon: <DatabaseIcon className="size-6" />,
							value: "365d",
							label: "Data Retention",
						},
					]}
				/>

				<LandingFeatures
					badge="Deep Dive"
					title="Everything you need to monitor your services"
					description="Comprehensive HTTP monitoring with global coverage and flexible configuration."
					features={[
						{
							title: "Global coverage",
							description:
								"Monitor from Africa, APAC, Eastern/Western Europe, Middle East, Oceania, and the Americas.",
							icon: <GlobeIcon className="size-6" />,
						},
						{
							title: "Flexible intervals",
							description:
								"Check every minute for critical services, or every hour for less urgent endpoints.",
							icon: <TimerIcon className="size-6" />,
						},
						{
							title: "Status code validation",
							description:
								"Expect any HTTP status code: 200, 201, 301, 404—whatever your endpoint should return.",
							icon: <ShieldCheckIcon className="size-6" />,
						},
						{
							title: "Instant results",
							description: "Run any monitor on-demand to test immediately after changes.",
							icon: <PlayIcon className="size-6" />,
						},
						{
							title: "Heatmap visualization",
							description:
								"See your service health at a glance with daily heatmaps showing success rates.",
							icon: <GridIcon className="size-6" />,
						},
						{
							title: "365-day history",
							description:
								"Access a full year of monitoring data for trend analysis and incident review.",
							icon: <CalendarIcon className="size-6" />,
						},
					]}
				/>

				<LandingHowItWorks
					title="Get started in minutes"
					description="Set up your first monitor in three simple steps."
					steps={[
						{
							title: "Enter your URL",
							description:
								"Paste the endpoint you want to monitor—website, API, or health check route.",
						},
						{
							title: "Configure checks",
							description: "Set the interval, expected status code, and monitoring region.",
						},
						{
							title: "Start monitoring",
							description: "Automated checks begin immediately. View results in your dashboard.",
						},
					]}
				/>

				<LandingFAQ
					title="Frequently asked questions"
					description="Common questions about HTTP monitoring."
					items={[
						{
							question: "What types of URLs can I monitor?",
							answer:
								"Any publicly accessible HTTP or HTTPS URL: websites, APIs, webhooks, health check endpoints.",
						},
						{
							question: "How do I choose a monitoring region?",
							answer:
								"Select the region closest to your users or where you want to measure performance from.",
						},
						{
							question: "Can I monitor authenticated endpoints?",
							answer: "Yes, you can add custom headers including Authorization tokens.",
						},
						{
							question: "What happens during a check?",
							answer:
								"We send an HTTP request and verify the response status code. Response time is recorded.",
						},
						{
							question: "How quickly do I get notified of failures?",
							answer: "Within seconds of a failed check. Configure email or webhook alerts.",
						},
						{
							question: "Can I monitor multiple URLs?",
							answer: "Yes, create as many monitors as you need. Each can have different settings.",
						},
					]}
				/>

				<LandingFinalCTA
					isSignedIn={isSignedIn}
					title="Start monitoring your services"
					description="Create your first monitor in under 2 minutes. No credit card required to start."
				/>
			</main>

			<LandingFooter />
		</div>
	);
}
