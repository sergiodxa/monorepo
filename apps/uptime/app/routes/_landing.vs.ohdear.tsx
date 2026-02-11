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

import type { Route } from "./+types/_landing.vs.ohdear";
import type { loader as landingLoader } from "./_landing";

export function meta({ data }: Route.MetaArgs) {
	return data.meta;
}

export function loader() {
	return {
		meta: [
			{ title: "Uptime vs Oh Dear | Developer-Focused Monitoring Comparison" },
			{
				name: "description",
				content:
					"Compare Uptime and Oh Dear for uptime monitoring. Both are developer-focused tools - see how usage-based pricing compares to per-site pricing, and find which is right for you.",
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
	{ feature: "Team collaboration", uptime: "Unlimited", competitor: "Unlimited" },
	{ feature: "Global regions", uptime: "9", competitor: "6" },
	{ feature: "Data retention", uptime: "365 days", competitor: "90 days", highlight: true },
	{
		feature: "Pricing model",
		uptime: "Usage-based ($5/mo)",
		competitor: "Per-site (€15-79/mo)",
		highlight: true,
	},
	{ feature: "Broken links checker", uptime: false, competitor: true },
	{ feature: "Lighthouse audits", uptime: false, competitor: true },
	{ feature: "Cron Job Monitoring", uptime: false, competitor: true },
];

let whySwitchReasons = [
	{
		icon: <DollarSignIcon className="size-6" />,
		title: "Usage-based vs per-site pricing",
		description:
			"Oh Dear charges per site (€15/mo for 5 sites). Uptime's usage-based model means you pay for actual usage, not site slots.",
	},
	{
		icon: <CheckIcon className="size-6" />,
		title: "365 days data retention",
		description:
			"Uptime keeps your monitoring data for a full year. Oh Dear retains data for 90 days on most plans.",
	},
	{
		icon: <SparklesIcon className="size-6" />,
		title: "More global regions",
		description:
			"Monitor from 9 regions worldwide compared to Oh Dear's 6 locations. Better coverage for global applications.",
	},
	{
		icon: <ZapIcon className="size-6" />,
		title: "Native Discord integration",
		description:
			"Get rich notifications directly in Discord. Oh Dear only supports Slack for native chat integrations.",
	},
];

let honestTakeReasons = [
	{
		title: "If you need broken link checking",
		description:
			"Oh Dear includes a broken links crawler that scans your entire site. Uptime focuses on endpoint monitoring and doesn't crawl for broken links.",
	},
	{
		title: "If you need Lighthouse audits",
		description:
			"Oh Dear runs automated Lighthouse performance audits. If you need regular performance scoring, Oh Dear has this built in.",
	},
	{
		title: "If you need cron job monitoring",
		description:
			"Oh Dear offers cron job (heartbeat) monitoring to ensure scheduled tasks run on time. Uptime doesn't currently offer this feature.",
	},
	{
		title: "If you're in the Laravel ecosystem",
		description:
			"Oh Dear is built by Spatie and has excellent Laravel integration. If you're heavily invested in Laravel, the ecosystem fit may be valuable.",
	},
];

let pricingScenarios = [
	{
		scenario: "5 monitors at 30-min intervals",
		competitorCost: "€15/mo (~$16)",
		uptimeCost: "~$8/mo",
		savings: "50%",
	},
	{
		scenario: "20 monitors at 60-min intervals",
		competitorCost: "€29/mo (~$31)",
		uptimeCost: "~$14/mo",
		savings: "55%",
	},
	{
		scenario: "50 monitors at 60-min intervals",
		competitorCost: "€79/mo (~$85)",
		uptimeCost: "~$36/mo",
		savings: "58%",
	},
];

let faqItems = [
	{
		question: "How does Uptime's pricing compare to Oh Dear?",
		answer:
			"Oh Dear uses per-site pricing: €15/mo for 5 sites, €29/mo for 20 sites, €79/mo for 100 sites. Uptime uses usage-based pricing: $5/mo base with 5,000 pings included, then $0.001 per additional ping. This means Uptime scales more cost-effectively, especially with longer check intervals.",
	},
	{
		question: "Both seem developer-focused. What's the main difference?",
		answer:
			"Both tools are built for developers, but with different focuses. Oh Dear offers a broader feature set (broken links, Lighthouse, cron monitoring) while Uptime focuses deeply on uptime monitoring with longer data retention and more global regions.",
	},
	{
		question: "Does Uptime have broken link checking?",
		answer:
			"No. Uptime focuses on endpoint monitoring and doesn't crawl sites for broken links. If broken link checking is important, Oh Dear or a dedicated tool would be better.",
	},
	{
		question: "What about Lighthouse performance audits?",
		answer:
			"Uptime doesn't include Lighthouse audits. If you need automated performance scoring, Oh Dear includes this feature or you can use PageSpeed Insights directly.",
	},
	{
		question: "How does data retention compare?",
		answer:
			"Uptime retains monitoring data for 365 days. Oh Dear retains data for 90 days on most plans. If long-term historical data is important, Uptime offers better retention.",
	},
	{
		question: "Which has more monitoring locations?",
		answer:
			"Uptime has 9 global regions (Africa, Asia-Pacific, Eastern/Western Europe, Eastern/Western North America, Middle East, Oceania, South America). Oh Dear has 6 locations. Uptime offers slightly better geographic coverage.",
	},
	{
		question: "Does Uptime support cron job monitoring?",
		answer:
			"Not currently. Oh Dear's heartbeat monitoring is great for ensuring scheduled tasks run. If you need cron monitoring, Oh Dear or a dedicated service like Cronitor would be better.",
	},
	{
		question: "Can I migrate from Oh Dear?",
		answer:
			"Yes! Setting up monitors in Uptime is quick. Simply create new monitors with your existing URLs. There's no automated import, but the process is straightforward.",
	},
];

export default function VsOhDearPage() {
	let { t } = useTranslation();
	let parentData = useRouteLoaderData<typeof landingLoader>("routes/_landing");
	let isSignedIn = parentData?.isSignedIn ?? false;

	return (
		<>
			<CompareHero
				competitor="Oh Dear"
				tagline="Developer-focused. Usage-based pricing."
				description="Two developer-focused monitoring tools with different pricing models. See how Uptime's usage-based approach compares to Oh Dear's per-site pricing."
				isSignedIn={isSignedIn}
			/>

			<CompareFeatureTable competitor="Oh Dear" features={features} />

			<CompareWhySwitch
				title="Why developers choose Uptime over Oh Dear"
				reasons={whySwitchReasons}
			/>

			<CompareHonestTake competitor="Oh Dear" reasons={honestTakeReasons} />

			<ComparePerfectFor
				title="Perfect for teams that want flexible pricing"
				description="If you want to pay for actual usage rather than site slots, Uptime's model scales better. Ideal for teams with many monitors at longer intervals or variable monitoring needs."
				highlights={[
					"365 days data retention",
					"9 global monitoring regions",
					"Native Discord integration",
				]}
			/>

			<ComparePricing
				competitor="Oh Dear"
				competitorPrice="€15-79/mo"
				scenarios={pricingScenarios}
			/>

			<CompareCTA isSignedIn={isSignedIn} competitor="Oh Dear" />

			<CompareFAQ
				badge={t("landing.faq.badge")}
				title={t("landing.faq.title")}
				description="Answers to frequently asked questions about switching from Oh Dear."
				items={faqItems}
			/>

			<LandingFinalCTA
				isSignedIn={isSignedIn}
				title="Ready for usage-based monitoring?"
				description="Join developers who prefer paying for what they use rather than site slots."
				ctaOut="Start Free Trial"
			/>
		</>
	);
}
