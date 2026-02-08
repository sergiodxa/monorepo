import {
	GlobeIcon,
	MonitorIcon,
	ShieldCheckIcon,
	UsersIcon,
	WebhookIcon,
	ZapIcon,
} from "lucide-react";

import {
	LandingFAQ,
	LandingFeatures,
	LandingFinalCTA,
	LandingFooter,
	LandingHeader,
	LandingHero,
	LandingHowItWorks,
	LandingTrustIndicators,
} from "~/components/landing";
import { getSession } from "~/middleware/session";

import type { Route } from "./+types/for.startups";

export function meta(): Route.MetaDescriptors {
	return [
		{ title: "Uptime for Startups | Team Monitoring" },
		{
			name: "description",
			content:
				"Uptime monitoring for startups. Team collaboration, instant alerts, and usage-based pricing that scales with you.",
		},
	];
}

export async function loader() {
	let session = getSession();
	return { isSignedIn: session.has("id") };
}

export default function ForStartupsPage({ loaderData }: Route.ComponentProps) {
	let { isSignedIn } = loaderData;

	return (
		<div className="min-h-screen bg-white dark:bg-neutral-950">
			<LandingHeader isSignedIn={isSignedIn} />

			<LandingHero
				isSignedIn={isSignedIn}
				badge="For Startups"
				title={
					<>
						Don't let downtime{" "}
						<strong className="text-primary-600 dark:text-primary-400">kill your growth</strong>
					</>
				}
				description="Uptime monitoring for fast-moving teams that need reliability without enterprise complexity."
				highlights={["Team collaboration", "Instant alerts", "Scale as you grow"]}
			/>

			<LandingTrustIndicators
				indicators={[
					{
						icon: <UsersIcon className="size-6" />,
						value: "Unlimited",
						label: "Team Members",
					},
					{
						icon: <ZapIcon className="size-6" />,
						value: "<1s",
						label: "Alert Latency",
					},
					{
						icon: <ShieldCheckIcon className="size-6" />,
						value: "99.9%",
						label: "Uptime SLA",
					},
					{
						icon: <GlobeIcon className="size-6" />,
						value: "9",
						label: "Regions",
					},
				]}
			/>

			<LandingFeatures
				title="Built for teams"
				description="Everything your startup needs to stay online"
				features={[
					{
						icon: <UsersIcon className="size-6" />,
						title: "Team collaboration",
						description:
							"Invite your co-founders, engineers, and ops team. Everyone sees the same dashboard.",
					},
					{
						icon: <WebhookIcon className="size-6" />,
						title: "Webhook integrations",
						description:
							"Connect to Slack, PagerDuty, OpsGenie, or build custom integrations via webhooks.",
					},
					{
						icon: <MonitorIcon className="size-6" />,
						title: "Multiple monitors",
						description: "Track every microservice, API endpoint, and landing page in one place.",
					},
					{
						icon: <GlobeIcon className="size-6" />,
						title: "Global coverage",
						description: "Monitor from 9 regions worldwide. Choose the closest to your users.",
					},
				]}
			/>

			<LandingHowItWorks
				title="Get started in minutes"
				description="Three simple steps to reliable monitoring"
				steps={[
					{
						title: "Set up your team",
						description: "Create a team and invite members. Everyone gets access instantly.",
					},
					{
						title: "Add monitors",
						description: "Monitor all your critical endpoints with customizable check intervals.",
					},
					{
						title: "Configure alerts",
						description: "Route alerts to the right people via email or webhooks.",
					},
				]}
			/>

			<LandingFAQ
				title="Questions? We've got answers"
				description="Everything you need to know about Uptime for startups"
				items={[
					{
						question: "Can my whole team access the dashboard?",
						answer:
							"Yes! Invite unlimited team members. Each person can view monitors and configure their own alert preferences.",
					},
					{
						question: "How do alerts work with on-call rotations?",
						answer:
							"Use webhook alerts to integrate with PagerDuty, OpsGenie, or your custom on-call system.",
					},
					{
						question: "What's the pricing for a 10-person team?",
						answer:
							"Team size doesn't affect pricing. You only pay for pings used—$5 base + $0.001 per ping after 5,000.",
					},
					{
						question: "Do you support SSO?",
						answer: "SSO is on our roadmap. Currently, team members authenticate via GitHub.",
					},
					{
						question: "Can we monitor staging and production separately?",
						answer:
							"Yes! Create separate monitors for each environment. Use naming conventions to organize them.",
					},
					{
						question: "Is there an SLA?",
						answer: "We guarantee 99.9% uptime for our monitoring infrastructure.",
					},
				]}
			/>

			<LandingFinalCTA
				isSignedIn={isSignedIn}
				title="Ready to scale with confidence?"
				description="Join startups that trust Uptime to keep their services running as they grow."
			/>

			<LandingFooter />
		</div>
	);
}
