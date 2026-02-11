import { CheckIcon, DollarSignIcon, SparklesIcon, ZapIcon } from "lucide-react";
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

import type { Route } from "./+types/_landing.vs.pingdom";
import type { loader as landingLoader } from "./_landing";

export const meta: Route.MetaFunction = ({ data }) => data?.meta ?? [];

export async function loader({ request, context }: Route.LoaderArgs) {
	let { t } = i18next(context);

	return {
		meta: generateMeta({
			title: t("landing.vs.pingdom.meta.title"),
			description: t("landing.vs.pingdom.meta.description"),
			url: request.url,
		}),
	};
}

let features = [
	{ feature: "Uptime monitoring", uptime: true, competitor: true },
	{ feature: "Status pages", uptime: true, competitor: "Separate product", highlight: true },
	{ feature: "SSL monitoring", uptime: true, competitor: true },
	{ feature: "DNS monitoring", uptime: true, competitor: "Limited" },
	{ feature: "Content/keyword monitoring", uptime: true, competitor: true },
	{ feature: "Native Slack/Discord", uptime: true, competitor: true },
	{ feature: "Maintenance windows", uptime: true, competitor: true },
	{ feature: "Recovery alerts", uptime: true, competitor: true },
	{ feature: "API access", uptime: true, competitor: true },
	{ feature: "Alert cooldowns", uptime: true, competitor: true },
	{ feature: "Cron Job Monitoring", uptime: true, competitor: true },
	{ feature: "Team collaboration", uptime: "Unlimited", competitor: "Unlimited" },
	{ feature: "Global regions", uptime: "9", competitor: "100+" },
	{ feature: "Data retention", uptime: "365 days", competitor: "Varies by plan" },
	{
		feature: "Pricing model",
		uptime: "Usage-based ($5/mo)",
		competitor: "Per-check ($15/mo)",
		highlight: true,
	},
];

let whySwitchReasons = [
	{
		icon: <DollarSignIcon className="size-6" />,
		title: "10x more affordable for most use cases",
		description:
			"Our usage-based pricing means you only pay for what you use. No wasted money on unused tiers.",
	},
	{
		icon: <CheckIcon className="size-6" />,
		title: "No hidden fees or add-on products",
		description:
			"Status pages included. No separate products to buy. Everything you need in one place.",
	},
	{
		icon: <SparklesIcon className="size-6" />,
		title: "Simple, transparent pricing",
		description:
			"$5/mo base includes 5,000 pings. Additional pings at $0.001 each. No complicated tiers.",
	},
	{
		icon: <ZapIcon className="size-6" />,
		title: "Modern interface built for developers",
		description:
			"Clean, fast dashboard with visual heatmaps, API access, and webhook integrations.",
	},
];

let honestTakeReasons = [
	{
		title: "If you need Real User Monitoring (RUM)",
		description:
			"Pingdom offers Real User Monitoring to track actual user experience metrics. Uptime focuses on synthetic monitoring only.",
	},
	{
		title: "If you need 100+ probe locations",
		description:
			"Pingdom has over 100 probe locations globally. Uptime currently offers 9 regions, which covers most use cases but may not be enough for highly distributed applications.",
	},
	{
		title: "If you need complex transaction monitoring",
		description:
			"Pingdom offers transaction monitoring for multi-step user flows. If you need to monitor login sequences or checkout processes, Pingdom may be a better fit.",
	},
];

let pricingScenarios = [
	{
		scenario: "10 monitors at 30-min intervals",
		competitorCost: "$15/mo",
		uptimeCost: "~$15/mo",
		savings: "Unlimited team members",
	},
	{
		scenario: "25 monitors at 60-min intervals",
		competitorCost: "$29/mo",
		uptimeCost: "~$18/mo",
		savings: "38%",
	},
	{
		scenario: "50 monitors at 60-min intervals",
		competitorCost: "$89/mo",
		uptimeCost: "~$36/mo",
		savings: "60%",
	},
];

let faqItems = [
	{
		question: "How does Uptime's pricing compare to Pingdom?",
		answer:
			"Uptime starts at $5/mo with usage-based pricing, while Pingdom starts at $15/mo with tier-based pricing. With longer check intervals (30-60 minutes), Uptime can cost 30-60% less than Pingdom while including unlimited team members.",
	},
	{
		question: "Can I migrate my monitors from Pingdom?",
		answer:
			"Yes! While we don't have an automated import tool, setting up monitors in Uptime takes just minutes. Simply create new monitors with the same URLs and settings.",
	},
	{
		question: "Does Uptime have as many probe locations as Pingdom?",
		answer:
			"No, Pingdom has 100+ locations while Uptime has 9 global regions. For most applications, 9 regions provide sufficient coverage, but if you need extensive geographic distribution, Pingdom may be better.",
	},
	{
		question: "What about Real User Monitoring (RUM)?",
		answer:
			"Uptime focuses on synthetic monitoring and doesn't offer RUM. If you need to track actual user experience metrics, Pingdom's RUM feature (available at extra cost) might be what you need.",
	},
	{
		question: "Are status pages included with Uptime?",
		answer:
			"Yes! Status pages are included at no extra cost. With Pingdom, status pages are a separate product (Pingdom Public Status Page) that costs additional money.",
	},
	{
		question: "How do check intervals compare?",
		answer:
			"Both Uptime and Pingdom support 1-minute check intervals. Uptime also offers flexibility with intervals up to 60 minutes, which can help reduce costs for less critical monitors.",
	},
	{
		question: "Is there a free trial?",
		answer:
			"Uptime offers free manual checks without a credit card. You can test the platform and only need to subscribe when you want automated, scheduled monitoring.",
	},
	{
		question: "What if I need features Uptime doesn't have?",
		answer:
			"We're transparent about our limitations. If you need RUM, transaction monitoring, or 100+ probe locations, Pingdom may be a better fit for your needs. We'd rather you choose the right tool than be unhappy.",
	},
];

export default function VsPingdomPage() {
	let parentData = useRouteLoaderData<typeof landingLoader>("routes/_landing");
	let isSignedIn = parentData?.isSignedIn ?? false;

	return (
		<>
			<CompareHero
				competitor="Pingdom"
				tagline="Enterprise monitoring. Startup pricing."
				description="Enterprise-grade monitoring without the enterprise price tag. See how Uptime compares to Pingdom."
				isSignedIn={isSignedIn}
			/>

			<CompareFeatureTable competitor="Pingdom" features={features} />

			<CompareWhySwitch title="Why teams are switching to Uptime" reasons={whySwitchReasons} />

			<CompareHonestTake competitor="Pingdom" reasons={honestTakeReasons} />

			<ComparePerfectFor
				title="Perfect for teams that already have their stack"
				description="If you just need monitoring—not a full observability platform—Uptime is the focused, affordable choice. Great for teams that already use Datadog, Grafana, or other tools for logging and APM."
				highlights={[
					"Works alongside your existing tools",
					"No vendor lock-in",
					"API-first design",
				]}
			/>

			<ComparePricing competitor="Pingdom" competitorPrice="$15/mo" scenarios={pricingScenarios} />

			<CompareCTA isSignedIn={isSignedIn} competitor="Pingdom" />

			<CompareFAQ
				badge="FAQ"
				title="Common questions"
				description="Answers to frequently asked questions about switching from Pingdom."
				items={faqItems}
			/>

			<LandingFinalCTA
				isSignedIn={isSignedIn}
				title="Ready to save on monitoring?"
				description="Join thousands of developers who switched to Uptime for better value without compromising on reliability."
				ctaOut="Start Free Trial"
			/>
		</>
	);
}
