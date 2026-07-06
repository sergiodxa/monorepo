/**
 * Marketing comparison page pitching Uptime against UptimeRobot. Its loader
 * builds localized SEO meta, and the component feeds static feature, why-switch,
 * honest-take, pricing-scenario, and FAQ data into the shared compare sections to
 * highlight usage-based pricing, more regions, and unlimited team members.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { DollarSignIcon, GlobeIcon, SparklesIcon, UsersIcon } from "lucide-react";
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

import type { Route } from "./+types/_landing.vs.uptimerobot";
import type { loader as landingLoader } from "./_landing";

export const meta: Route.MetaFunction = ({ data }) => data?.meta ?? [];

export async function loader({ request, context }: Route.LoaderArgs) {
	let { t } = i18next(context);

	return {
		meta: generateMeta({
			title: t("landing.vs.uptimerobot.meta.title"),
			description: t("landing.vs.uptimerobot.meta.description"),
			url: request.url,
		}),
	};
}

let features = [
	{ feature: "Uptime monitoring", uptime: true, competitor: true },
	{ feature: "Status pages", uptime: true, competitor: "Basic free, custom paid" },
	{ feature: "SSL monitoring", uptime: true, competitor: "Paid plans only" },
	{ feature: "DNS monitoring", uptime: true, competitor: true },
	{ feature: "Content/keyword monitoring", uptime: true, competitor: true },
	{ feature: "Native Slack/Discord", uptime: true, competitor: "Via webhooks", highlight: true },
	{ feature: "Maintenance windows", uptime: true, competitor: true },
	{ feature: "Recovery alerts", uptime: true, competitor: true },
	{ feature: "API access", uptime: true, competitor: true },
	{ feature: "Alert cooldowns", uptime: true, competitor: true },
	{ feature: "Cron Job Monitoring", uptime: true, competitor: true },
	{
		feature: "Team collaboration",
		uptime: "Unlimited members",
		competitor: "Limited by plan",
		highlight: true,
	},
	{
		feature: "Global regions",
		uptime: "9 regions",
		competitor: "Limited regions",
		highlight: true,
	},
	{ feature: "Data retention", uptime: "365 days", competitor: "90 days (free)", highlight: true },
	{
		feature: "Pricing model",
		uptime: "Usage-based",
		competitor: "Tiered ($7-$54/mo)",
		highlight: true,
	},
];

let whySwitchReasons = [
	{
		icon: <DollarSignIcon className="size-6" />,
		title: "Pay only for what you use",
		description:
			"No wasted money on unused monitor slots. With usage-based pricing, you only pay for actual pings.",
	},
	{
		icon: <GlobeIcon className="size-6" />,
		title: "More global regions",
		description:
			"Monitor from 9 regions worldwide for comprehensive coverage and accurate latency data.",
	},
	{
		icon: <SparklesIcon className="size-6" />,
		title: "Modern, clean interface",
		description:
			"A streamlined dashboard built for speed. See your service health at a glance with visual heatmaps.",
	},
	{
		icon: <UsersIcon className="size-6" />,
		title: "Better team collaboration",
		description: "Unlimited team members on all plans. No per-seat charges or artificial limits.",
	},
];

let honestTakeReasons = [
	{
		title: "If you need a generous free tier",
		description:
			"UptimeRobot offers 50 monitors with 5-minute intervals for free. Uptime's free tier only includes manual pings, requiring a paid plan for automated monitoring.",
	},
	{
		title: "If you're already embedded in their ecosystem",
		description:
			"If your team has built workflows around UptimeRobot's specific features and integrations, the switching cost may not be worth it for minor savings.",
	},
];

let pricingScenarios = [
	{
		scenario: "10 monitors at 30-min intervals",
		competitorCost: "$7/mo (Solo plan)",
		uptimeCost: "~$15/mo",
		savings: "More features included",
	},
	{
		scenario: "25 monitors at 60-min intervals",
		competitorCost: "$21/mo (Team plan)",
		uptimeCost: "~$18/mo",
		savings: "~$36/year",
	},
	{
		scenario: "50 monitors at 60-min intervals",
		competitorCost: "$54/mo (Enterprise plan)",
		uptimeCost: "~$36/mo",
		savings: "~$216/year",
	},
];

let faqItems = [
	{
		question: "Can I import my monitors from UptimeRobot?",
		answer:
			"Currently, you'll need to manually recreate your monitors in Uptime. The setup process is quick - most users have all their monitors configured in under 10 minutes.",
	},
	{
		question: "How does usage-based pricing compare to UptimeRobot's tiers?",
		answer:
			"With UptimeRobot, you pay for a tier whether you use all the monitors or not. With Uptime, you pay $5/month base plus $0.001 per ping. For users with longer check intervals (15-60 minutes), this can work out cheaper than UptimeRobot tiers while getting more features like unlimited team members.",
	},
	{
		question: "What if I only need a few monitors?",
		answer:
			"If you have very few monitors and don't mind 5-minute intervals, UptimeRobot's free tier might work for you. Uptime offers free manual pings, with paid automatic monitoring starting at $5/month.",
	},
	{
		question: "Do you support the same check types?",
		answer:
			"Yes, Uptime supports HTTP/HTTPS monitoring, keyword monitoring, SSL certificate monitoring, and DNS monitoring - all the essential check types you'd use with UptimeRobot.",
	},
	{
		question: "What about status pages?",
		answer:
			"Status pages are included with Uptime at no extra cost. You can create public status pages to keep your users informed about service health.",
	},
	{
		question: "How do alerts compare?",
		answer:
			"Uptime offers native Slack and Discord integrations, plus webhook support for custom integrations. You'll receive instant notifications when monitors detect issues.",
	},
];

export default function VsUptimeRobotPage() {
	let parentData = useRouteLoaderData<typeof landingLoader>("routes/_landing");
	let isSignedIn = parentData?.isSignedIn ?? false;

	return (
		<>
			<CompareHero
				competitor="UptimeRobot"
				tagline="Modern, usage-based monitoring"
				description="A modern alternative with transparent, usage-based pricing. Pay only for what you use instead of fixed tiers."
				isSignedIn={isSignedIn}
			/>

			<CompareFeatureTable competitor="UptimeRobot" features={features} />

			<CompareWhySwitch title="Why teams are switching to Uptime" reasons={whySwitchReasons} />

			<CompareHonestTake competitor="UptimeRobot" reasons={honestTakeReasons} />

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
				competitor="UptimeRobot"
				competitorPrice="$7/mo"
				scenarios={pricingScenarios}
			/>

			<CompareCTA isSignedIn={isSignedIn} competitor="UptimeRobot" />

			<CompareFAQ
				title="Common questions"
				description="Answers to questions about switching from UptimeRobot."
				items={faqItems}
			/>

			<LandingFinalCTA
				isSignedIn={isSignedIn}
				title="Ready to make the switch?"
				description="Join teams who've moved to transparent, usage-based monitoring."
				ctaOut="Start Free Today"
			/>
		</>
	);
}
