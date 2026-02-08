import {
	BellRingIcon,
	GlobeIcon,
	LayoutIcon,
	MonitorIcon,
	ShieldCheckIcon,
	UsersIcon,
	WebhookIcon,
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

import type { loader as landingLoader } from "./_landing";

export function meta() {
	return [
		{ title: "Uptime for Startups | Team Monitoring" },
		{
			name: "description",
			content:
				"Uptime monitoring for startups. Team collaboration, instant alerts, and usage-based pricing that scales with you.",
		},
	];
}

export default function ForStartupsPage() {
	let parentData = useRouteLoaderData<typeof landingLoader>("routes/_landing");
	let isSignedIn = parentData?.isSignedIn ?? false;

	return (
		<>
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
						title: "Native integrations",
						description:
							"Built-in Slack and Discord integrations, plus webhooks for PagerDuty, OpsGenie, and custom tools.",
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
					{
						icon: <LayoutIcon className="size-6" />,
						title: "Status pages",
						description:
							"Share a public status page with your users. Build trust with transparent uptime.",
					},
					{
						icon: <BellRingIcon className="size-6" />,
						title: "Recovery alerts",
						description:
							"Know when services recover, not just when they fail. Keep your team informed.",
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
						description: "Route alerts to the right people via email, Slack, Discord, or webhooks.",
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
							"Use native Slack or Discord integrations, or webhook alerts to integrate with PagerDuty, OpsGenie, or your custom on-call system.",
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
		</>
	);
}
