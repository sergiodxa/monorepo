import { DollarSignIcon, TargetIcon, UsersIcon, ZapIcon } from "lucide-react";
import { useRouteLoaderData } from "react-router";

import { LandingFinalCTA } from "~/components/landing";
import {
	CompareCTA,
	CompareFAQ,
	CompareFeatureTable,
	CompareHero,
	CompareHonestTake,
	ComparePerfectFor,
	ComparePricing,
	CompareWhySwitch,
} from "~/components/landing/compare";

import type { Route } from "./+types/_landing.vs.better-uptime";
import type { loader as landingLoader } from "./_landing";

export function meta({ data }: Route.MetaArgs) {
	return data.meta;
}

export function loader() {
	return {
		meta: [
			{ title: "Uptime vs Better Uptime | Feature Comparison" },
			{
				name: "description",
				content:
					"Compare Uptime vs Better Uptime (BetterStack). See how our focused monitoring solution compares to their full observability platform. Starting at $5/mo vs $29/mo.",
			},
		],
	};
}

let features = [
	{ feature: "Uptime monitoring", uptime: true, competitor: true },
	{ feature: "Status pages", uptime: true, competitor: true },
	{ feature: "SSL monitoring", uptime: true, competitor: true },
	{ feature: "DNS monitoring", uptime: true, competitor: true },
	{ feature: "Content/keyword monitoring", uptime: true, competitor: true },
	{ feature: "Native Slack/Discord", uptime: true, competitor: true },
	{ feature: "Maintenance windows", uptime: true, competitor: true },
	{ feature: "Recovery alerts", uptime: true, competitor: true },
	{ feature: "API access", uptime: true, competitor: true },
	{ feature: "Alert cooldowns", uptime: true, competitor: true },
	{ feature: "Cron Job Monitoring", uptime: true, competitor: true },
	{
		feature: "Team collaboration",
		uptime: "Unlimited",
		competitor: "Per-seat pricing",
		highlight: true,
	},
	{ feature: "Global regions", uptime: "9", competitor: "Multiple" },
	{ feature: "Data retention", uptime: "365 days", competitor: "Varies" },
	{
		feature: "Pricing model",
		uptime: "Usage-based ($5/mo)",
		competitor: "Per-responder ($29/mo)",
		highlight: true,
	},
];

let whySwitchReasons = [
	{
		icon: <TargetIcon className="size-6" />,
		title: "Focused on monitoring",
		description:
			"We do one thing and do it well. No feature bloat, no complexity—just reliable uptime monitoring that works.",
	},
	{
		icon: <DollarSignIcon className="size-6" />,
		title: "6x more affordable",
		description:
			"Start at $5/mo instead of $29/mo. Our usage-based pricing means you only pay for what you actually use.",
	},
	{
		icon: <UsersIcon className="size-6" />,
		title: "No per-seat pricing",
		description:
			"Invite your entire team without worrying about escalating costs. Unlimited team members included.",
	},
	{
		icon: <ZapIcon className="size-6" />,
		title: "Simple to use",
		description:
			"Set up a monitor in under 2 minutes. No complex configuration or DevOps expertise required.",
	},
];

let honestTakeReasons = [
	{
		title: "If you need a full observability platform",
		description:
			"Better Uptime's broader BetterStack platform offers logs, traces, and APM in one place. Uptime focuses solely on uptime monitoring.",
	},
	{
		title: "If you need advanced on-call scheduling",
		description:
			"Better Uptime includes sophisticated on-call scheduling and escalation policies that we don't offer.",
	},
	{
		title: "If you want one platform for everything",
		description:
			"If consolidating all your monitoring, logging, and incident management tools is a priority, their all-in-one approach may suit you better.",
	},
];

let pricingScenarios = [
	{
		scenario: "10 monitors at 30-min intervals",
		competitorCost: "$29/mo",
		uptimeCost: "~$15/mo",
		savings: "48%",
	},
	{
		scenario: "25 monitors at 60-min intervals",
		competitorCost: "$29/mo",
		uptimeCost: "~$18/mo",
		savings: "38%",
	},
	{
		scenario: "50 monitors at 60-min intervals",
		competitorCost: "$29/mo",
		uptimeCost: "~$36/mo",
		savings: "Per-seat costs add up",
	},
];

let faqItems = [
	{
		question: "What's the main difference between Uptime and Better Uptime?",
		answer:
			"Better Uptime (BetterStack) is a full observability platform with logging, APM, and on-call management. Uptime focuses specifically on uptime monitoring with a simpler, more affordable approach.",
	},
	{
		question: "How does pricing compare?",
		answer:
			"Uptime starts at $5/mo with usage-based pricing. Better Uptime starts at $29/mo per responder. With longer check intervals (30-60 minutes), Uptime costs 35-50% less and includes unlimited team members instead of per-seat pricing.",
	},
	{
		question: "Do I need on-call scheduling?",
		answer:
			"If you have a small team or don't need complex escalation policies, Uptime's straightforward alerting may be sufficient. For larger teams with on-call rotations, Better Uptime's scheduling features could be valuable.",
	},
	{
		question: "Can I use Uptime alongside other tools?",
		answer:
			"Absolutely! Uptime is designed to work alongside your existing stack. If you already use Datadog, Grafana, or PagerDuty, Uptime integrates via webhooks and provides focused uptime monitoring without overlap.",
	},
	{
		question: "Are team seats really unlimited?",
		answer:
			"Yes! Unlike Better Uptime's per-responder pricing, Uptime includes unlimited team members on all plans at no extra cost.",
	},
	{
		question: "What about status pages?",
		answer:
			"Both platforms include status pages. Uptime's status pages are included at no extra cost and provide a clean, public-facing way to communicate service health.",
	},
];

export default function VsBetterUptimePage() {
	let parentData = useRouteLoaderData<typeof landingLoader>("routes/_landing");
	let isSignedIn = parentData?.isSignedIn ?? false;

	return (
		<>
			<CompareHero
				competitor="Better Uptime"
				tagline="Focused monitoring without the complexity"
				description="See how Uptime compares to Better Uptime (BetterStack) and find the right fit for your needs."
				isSignedIn={isSignedIn}
			/>

			<CompareFeatureTable competitor="Better Uptime" features={features} />

			<CompareWhySwitch title="Why teams are switching to Uptime" reasons={whySwitchReasons} />

			<CompareHonestTake competitor="Better Uptime" reasons={honestTakeReasons} />

			<ComparePerfectFor
				title="Perfect for teams that already have their stack"
				description="If you just need monitoring—not a full observability platform—Uptime is the focused, affordable choice. Great for teams that already use Datadog, Grafana, or other tools for logging and APM."
				highlights={[
					"Works alongside your existing tools",
					"No vendor lock-in",
					"API-first design",
				]}
			/>

			<ComparePricing
				competitor="Better Uptime"
				competitorPrice="$29/mo"
				scenarios={pricingScenarios}
			/>

			<CompareCTA isSignedIn={isSignedIn} competitor="Better Uptime" />

			<CompareFAQ
				title="Common questions"
				description="Answers to frequently asked questions about Uptime vs Better Uptime."
				items={faqItems}
			/>

			<LandingFinalCTA
				isSignedIn={isSignedIn}
				title="Focused monitoring, fair pricing"
				description="Join teams who chose simplicity over complexity. Start monitoring in under 2 minutes."
				ctaOut="Get Started Free"
			/>
		</>
	);
}
