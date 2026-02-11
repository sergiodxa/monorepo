import { CheckIcon, DollarSignIcon, SparklesIcon, ZapIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
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

import type { Route } from "./+types/_landing.vs.site24x7";
import type { loader as landingLoader } from "./_landing";

export function meta({ data }: Route.MetaArgs) {
	return data.meta;
}

export function loader() {
	return {
		meta: [
			{ title: "Uptime vs Site24x7 | Simple Uptime Monitoring Alternative" },
			{
				name: "description",
				content:
					"Compare Uptime and Site24x7 for uptime monitoring. Get transparent, usage-based pricing instead of complex tiered plans. See features, pricing, and find out which is right for you.",
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
	{ feature: "Native Slack/Discord", uptime: true, competitor: "Slack only" },
	{ feature: "Maintenance windows", uptime: true, competitor: true },
	{ feature: "Recovery alerts", uptime: true, competitor: true },
	{ feature: "API access", uptime: true, competitor: true },
	{ feature: "Alert cooldowns", uptime: true, competitor: true },
	{ feature: "Cron Job Monitoring", uptime: true, competitor: true },
	{ feature: "Team collaboration", uptime: "Unlimited", competitor: "Limited by plan" },
	{ feature: "Global regions", uptime: "9", competitor: "120+" },
	{ feature: "Data retention", uptime: "365 days", competitor: "Varies by plan" },
	{
		feature: "Pricing model",
		uptime: "Usage-based ($5/mo)",
		competitor: "Tiered ($9-225/mo)",
		highlight: true,
	},
	{ feature: "Server monitoring", uptime: false, competitor: true },
	{ feature: "APM", uptime: false, competitor: true },
	{ feature: "Log management", uptime: false, competitor: true },
];

let whySwitchReasons = [
	{
		icon: <DollarSignIcon className="size-6" />,
		title: "Transparent, predictable pricing",
		description:
			"No more figuring out which tier you need. Pay $5/mo base plus $0.001 per ping after 5,000. That's it.",
	},
	{
		icon: <CheckIcon className="size-6" />,
		title: "Unlimited team members included",
		description:
			"Site24x7 limits users based on plan. Uptime includes unlimited team members at no extra cost.",
	},
	{
		icon: <SparklesIcon className="size-6" />,
		title: "No feature gating",
		description:
			"All features available to everyone. No need to upgrade to unlock SSL monitoring or status pages.",
	},
	{
		icon: <ZapIcon className="size-6" />,
		title: "Modern, clean interface",
		description:
			"Purpose-built for uptime monitoring with visual heatmaps, fast dashboard, and API-first design.",
	},
];

let honestTakeReasons = [
	{
		title: "If you need server/infrastructure monitoring",
		description:
			"Site24x7 offers comprehensive server, cloud, and network monitoring. Uptime focuses purely on uptime monitoring via HTTP/HTTPS.",
	},
	{
		title: "If you need APM or log management",
		description:
			"Site24x7 includes application performance monitoring and log management. If you need these, Site24x7's all-in-one approach may be better.",
	},
	{
		title: "If you need 100+ probe locations",
		description:
			"Site24x7 has 120+ monitoring locations globally. Uptime has 9 regions, which covers most use cases but may not suit highly geo-distributed applications.",
	},
];

let pricingScenarios = [
	{
		scenario: "10 monitors at 30-min intervals",
		competitorCost: "$9/mo",
		uptimeCost: "~$15/mo",
		savings: "More features at similar price",
	},
	{
		scenario: "25 monitors at 60-min intervals",
		competitorCost: "$42/mo",
		uptimeCost: "~$18/mo",
		savings: "57%",
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
		question: "How does Uptime's pricing compare to Site24x7?",
		answer:
			"Site24x7 uses tiered pricing starting at $9/mo for their Starter plan (10 monitors) up to $225/mo for Enterprise. Uptime uses simple usage-based pricing: $5/mo base with 5,000 pings included, then $0.001 per additional ping. For most uptime monitoring use cases, Uptime is more affordable.",
	},
	{
		question: "Does Uptime have all the features Site24x7 offers?",
		answer:
			"No. Site24x7 is an all-in-one monitoring platform with server monitoring, APM, log management, and more. Uptime focuses specifically on uptime monitoring. If you only need uptime monitoring, Uptime is simpler and more cost-effective.",
	},
	{
		question: "Can I migrate my monitors from Site24x7?",
		answer:
			"Yes! While there's no automated import, setting up monitors in Uptime takes just minutes. Create new monitors with your existing URLs and configurations.",
	},
	{
		question: "What about probe locations?",
		answer:
			"Site24x7 has 120+ monitoring locations while Uptime has 9 global regions (Africa, Asia-Pacific, Eastern/Western Europe, Eastern/Western North America, Middle East, Oceania, South America). For most applications, 9 regions provide sufficient coverage.",
	},
	{
		question: "Does Uptime support RUM or APM?",
		answer:
			"No. Uptime is focused on synthetic uptime monitoring. If you need Real User Monitoring or Application Performance Monitoring, Site24x7 or dedicated APM tools would be better.",
	},
	{
		question: "How do team limits compare?",
		answer:
			"Site24x7 limits users based on your plan tier. Uptime includes unlimited team members with any subscription, making it ideal for growing teams.",
	},
	{
		question: "Is there a free tier?",
		answer:
			"Uptime offers free manual checks without a credit card. You can test the platform and only need to subscribe when you want automated, scheduled monitoring. Site24x7 offers a 30-day free trial.",
	},
	{
		question: "What if I need features Uptime doesn't have?",
		answer:
			"We're transparent about our focus. If you need server monitoring, APM, log management, or 100+ probe locations, Site24x7 may be a better fit. Uptime is ideal for teams who want simple, affordable uptime monitoring.",
	},
];

export default function VsSite24x7Page() {
	let { t } = useTranslation();
	let parentData = useRouteLoaderData<typeof landingLoader>("routes/_landing");
	let isSignedIn = parentData?.isSignedIn ?? false;

	return (
		<>
			<CompareHero
				competitor="Site24x7"
				tagline="Simple pricing. No tiers."
				description="Get transparent, usage-based pricing instead of complex tiered plans. See how Uptime compares to Site24x7."
				isSignedIn={isSignedIn}
			/>

			<CompareFeatureTable competitor="Site24x7" features={features} />

			<CompareWhySwitch title="Why teams choose Uptime over Site24x7" reasons={whySwitchReasons} />

			<CompareHonestTake competitor="Site24x7" reasons={honestTakeReasons} />

			<ComparePerfectFor
				title="Perfect for teams that want focused uptime monitoring"
				description="If you don't need server monitoring, APM, or log management, why pay for them? Uptime gives you everything you need for uptime monitoring without the bloat."
				highlights={[
					"All features included",
					"Unlimited team members",
					"No complex tier decisions",
				]}
			/>

			<ComparePricing
				competitor="Site24x7"
				competitorPrice="$9-225/mo"
				scenarios={pricingScenarios}
			/>

			<CompareCTA isSignedIn={isSignedIn} competitor="Site24x7" />

			<CompareFAQ
				badge={t("landing.faq.badge")}
				title={t("landing.faq.title")}
				description="Answers to frequently asked questions about switching from Site24x7."
				items={faqItems}
			/>

			<LandingFinalCTA
				isSignedIn={isSignedIn}
				title="Ready for simpler pricing?"
				description="Join developers who switched to Uptime for transparent, usage-based pricing without sacrificing reliability."
				ctaOut="Start Free Trial"
			/>
		</>
	);
}
