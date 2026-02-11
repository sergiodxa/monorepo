import { CheckIcon, DollarSignIcon, SparklesIcon, UsersIcon } from "lucide-react";
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
import { generateMeta } from "~/lib/seo";
import { i18next } from "~/middleware/i18next";

import type { Route } from "./+types/_landing.vs.statuscake";
import type { loader as landingLoader } from "./_landing";

export const meta: Route.MetaFunction = ({ data }) => data?.meta ?? [];

export async function loader({ request, context }: Route.LoaderArgs) {
	let { t } = i18next(context);

	return {
		meta: generateMeta({
			title: t("landing.vs.statuscake.meta.title"),
			description: t("landing.vs.statuscake.meta.description"),
			url: request.url,
		}),
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
		competitor: "Limited by plan",
		highlight: true,
	},
	{ feature: "Global regions", uptime: "9", competitor: "Multiple" },
	{ feature: "Data retention", uptime: "365 days", competitor: "Varies by plan", highlight: true },
	{
		feature: "Pricing model",
		uptime: "Usage-based ($5/mo)",
		competitor: "Tiered ($20/mo)",
		highlight: true,
	},
];

let whySwitchReasons = [
	{
		icon: <SparklesIcon className="size-6" />,
		title: "Modern, intuitive interface",
		description:
			"Clean, fast dashboard built for developers. Visual heatmaps, streamlined workflows, and a UI that gets out of your way.",
	},
	{
		icon: <DollarSignIcon className="size-6" />,
		title: "4x more affordable entry",
		description:
			"Start at just $5/mo compared to StatusCake's $20/mo. Usage-based pricing means you only pay for what you use.",
	},
	{
		icon: <CheckIcon className="size-6" />,
		title: "Longer data retention included",
		description:
			"365 days of data retention included on all plans. StatusCake's retention varies by plan tier.",
	},
	{
		icon: <UsersIcon className="size-6" />,
		title: "Unlimited team members",
		description:
			"Invite your whole team at no extra cost. No per-seat pricing or team limits based on your plan.",
	},
];

let honestTakeReasons = [
	{
		title: "If you need page speed monitoring",
		description:
			"StatusCake offers page speed monitoring to track load times and performance metrics. Uptime focuses on uptime monitoring and doesn't include page speed analysis.",
	},
	{
		title: "If you need server resource monitoring",
		description:
			"StatusCake provides server monitoring to track CPU, memory, and disk usage. If you need infrastructure-level monitoring alongside uptime checks, StatusCake has you covered.",
	},
	{
		title: "If you prefer a traditional UI",
		description:
			"StatusCake has a more traditional, feature-dense interface. If you prefer that style over modern minimalist design, StatusCake might feel more familiar.",
	},
];

let pricingScenarios = [
	{
		scenario: "10 monitors at 30-min intervals",
		competitorCost: "$20/mo",
		uptimeCost: "~$15/mo",
		savings: "25%",
	},
	{
		scenario: "25 monitors at 60-min intervals",
		competitorCost: "$20/mo",
		uptimeCost: "~$18/mo",
		savings: "10%",
	},
	{
		scenario: "50 monitors at 60-min intervals",
		competitorCost: "$66/mo",
		uptimeCost: "~$36/mo",
		savings: "45%",
	},
];

let faqItems = [
	{
		question: "How does Uptime's pricing compare to StatusCake?",
		answer:
			"Uptime starts at $5/mo with usage-based pricing, while StatusCake starts at $20/mo with tiered pricing. With longer check intervals (30-60 minutes), Uptime can cost 10-45% less than StatusCake while including unlimited team members and 365-day data retention.",
	},
	{
		question: "Does StatusCake have a better free tier?",
		answer:
			"StatusCake's free tier includes 10 monitors with 5-minute intervals. Uptime's free tier allows unlimited manual pings but requires a paid plan for automated monitoring. If you only need basic free monitoring, StatusCake's free tier is more generous.",
	},
	{
		question: "Can I migrate my monitors from StatusCake?",
		answer:
			"Yes! While we don't have an automated import tool, setting up monitors in Uptime takes just minutes. Simply create new monitors with the same URLs and settings.",
	},
	{
		question: "What about page speed monitoring?",
		answer:
			"Uptime focuses on uptime monitoring and doesn't include page speed analysis. If you need page speed monitoring, StatusCake includes this feature in their plans.",
	},
	{
		question: "Does Uptime have server monitoring?",
		answer:
			"No, Uptime focuses on HTTP/HTTPS, SSL, and DNS monitoring. StatusCake offers server resource monitoring (CPU, memory, disk). If you need infrastructure monitoring, StatusCake or a dedicated tool may be better.",
	},
	{
		question: "How do check intervals compare?",
		answer:
			"Uptime offers intervals from 1-60 minutes, giving you flexibility to reduce costs for less critical monitors. StatusCake offers 1-5 minute intervals on paid plans.",
	},
	{
		question: "Are team seats really unlimited with Uptime?",
		answer:
			"Yes! Invite your entire team at no extra cost. StatusCake limits team members based on your plan tier.",
	},
	{
		question: "What about data retention?",
		answer:
			"Uptime includes 365 days of data retention on all plans. StatusCake's retention varies by plan tier, with lower tiers having shorter retention periods.",
	},
];

export default function VsStatusCakePage() {
	let parentData = useRouteLoaderData<typeof landingLoader>("routes/_landing");
	let isSignedIn = parentData?.isSignedIn ?? false;

	return (
		<>
			<CompareHero
				competitor="StatusCake"
				tagline="Modern monitoring. Fresh approach."
				description="Modern monitoring with a fresh approach. See how Uptime compares to StatusCake."
				isSignedIn={isSignedIn}
			/>

			<CompareFeatureTable competitor="StatusCake" features={features} />

			<CompareWhySwitch title="Why teams are switching to Uptime" reasons={whySwitchReasons} />

			<CompareHonestTake competitor="StatusCake" reasons={honestTakeReasons} />

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
				competitor="StatusCake"
				competitorPrice="$20/mo"
				scenarios={pricingScenarios}
			/>

			<CompareCTA isSignedIn={isSignedIn} competitor="StatusCake" />

			<CompareFAQ
				badge="FAQ"
				title="Common questions"
				description="Answers to frequently asked questions about switching from StatusCake."
				items={faqItems}
			/>

			<LandingFinalCTA
				isSignedIn={isSignedIn}
				title="Ready to try modern monitoring?"
				description="Join developers who switched to Uptime for a cleaner interface and better value."
				ctaOut="Start Free Trial"
			/>
		</>
	);
}
