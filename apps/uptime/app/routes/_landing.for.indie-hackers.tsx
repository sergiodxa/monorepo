import {
	DollarSignIcon,
	GlobeIcon,
	GridIcon,
	RocketIcon,
	SettingsIcon,
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

import type { Route } from "./+types/_landing.for.indie-hackers";
import type { loader as landingLoader } from "./_landing";

export function meta({ data }: Route.MetaArgs) {
	return data.meta;
}

export function loader() {
	return {
		meta: [
			{ title: "Uptime for Indie Hackers | Simple Monitoring" },
			{
				name: "description",
				content:
					"Uptime monitoring built for indie hackers. Start free, pay only for what you use. $5/mo includes 5,000 pings.",
			},
		],
	};
}

export default function ForIndieHackersPage() {
	let parentData = useRouteLoaderData<typeof landingLoader>("routes/_landing");
	let isSignedIn = parentData?.isSignedIn ?? false;

	return (
		<>
			<LandingHero
				isSignedIn={isSignedIn}
				badge="For Indie Hackers"
				title={
					<>
						Ship fast.{" "}
						<strong className="text-primary-600 dark:text-primary-400">Sleep soundly.</strong>
					</>
				}
				description="Uptime monitoring built for indie hackers who can't afford downtime—or bloated bills."
				highlights={[
					"Start in under 2 minutes",
					"$5/mo includes 5,000 pings",
					"No credit card to start",
				]}
			/>

			<LandingTrustIndicators
				indicators={[
					{
						icon: <ZapIcon className="size-6" />,
						value: "99.9%",
						label: "Uptime SLA",
					},
					{
						icon: <RocketIcon className="size-6" />,
						value: "<2min",
						label: "Setup Time",
					},
					{
						icon: <DollarSignIcon className="size-6" />,
						value: "$5",
						label: "Base Price",
					},
					{
						icon: <GlobeIcon className="size-6" />,
						value: "9",
						label: "Global Regions",
					},
				]}
			/>

			<LandingFeatures
				title="Built for bootstrappers"
				description="Everything you need to monitor your projects without enterprise complexity."
				features={[
					{
						icon: <DollarSignIcon className="size-6" />,
						title: "Usage-based pricing",
						description:
							"No wasted money on unused tiers. Pay only for the pings you actually use.",
					},
					{
						icon: <WebhookIcon className="size-6" />,
						title: "Flexible alerts",
						description:
							"Native Slack and Discord integrations, plus email and webhooks for any endpoint.",
					},
					{
						icon: <SettingsIcon className="size-6" />,
						title: "Simple setup",
						description:
							"Create a monitor in seconds. No complex configuration or DevOps knowledge needed.",
					},
					{
						icon: <GridIcon className="size-6" />,
						title: "Visual heatmaps",
						description: "See your service health at a glance with 365-day historical data.",
					},
				]}
			/>

			<LandingHowItWorks
				title="Up and running in minutes"
				description="Start monitoring your services in three simple steps."
				steps={[
					{
						title: "Create an account",
						description: "Sign up with GitHub in seconds. No credit card required to start.",
					},
					{
						title: "Add your endpoints",
						description:
							"Enter the URLs you want to monitor. Set check frequency from 1-60 minutes.",
					},
					{
						title: "Get notified",
						description:
							"Receive alerts via email, Slack, Discord, or webhooks when something goes wrong.",
					},
				]}
			/>

			<LandingFAQ
				title="Common questions"
				description="Answers to questions indie hackers frequently ask."
				items={[
					{
						question: "How much will it cost for my side project?",
						answer:
							"With a single monitor checking every 10 minutes, you'll use about 4,000 pings/month—well within the $5 base plan.",
					},
					{
						question: "Can I monitor multiple products?",
						answer:
							"Yes! Create as many monitors as you need. Each one can have different check intervals and alert settings.",
					},
					{
						question: "What happens if I exceed 5,000 pings?",
						answer:
							"You're charged $0.001 per additional ping. At 10,000 extra pings, that's just $10 more.",
					},
					{
						question: "Do I need a credit card to start?",
						answer:
							"No. You can create monitors and trigger pings manually for free. Only automatic scheduled monitoring requires a subscription.",
					},
					{
						question: "Can I pause monitoring when not needed?",
						answer:
							"Absolutely. Pause any monitor individually to save on pings during development or maintenance.",
					},
					{
						question: "Is there an API?",
						answer: "Yes, all actions available in the dashboard can be automated via API.",
					},
				]}
			/>

			<LandingFinalCTA
				isSignedIn={isSignedIn}
				title="Ready to ship with confidence?"
				description="Join indie hackers who sleep soundly knowing their services are monitored 24/7."
			/>
		</>
	);
}
