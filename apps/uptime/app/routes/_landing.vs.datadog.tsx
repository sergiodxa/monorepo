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
import { generateMeta } from "~/lib/seo";
import { i18next } from "~/middleware/i18next";

import type { Route } from "./+types/_landing.vs.datadog";
import type { loader as landingLoader } from "./_landing";

export const meta: Route.MetaFunction = ({ data }) => data?.meta ?? [];

export async function loader({ request, context }: Route.LoaderArgs) {
	let { t } = i18next(context);

	return {
		meta: generateMeta({
			title: t("landing.vs.datadog.meta.title"),
			description: t("landing.vs.datadog.meta.description"),
			url: request.url,
		}),
	};
}

let features = [
	{ feature: "Uptime monitoring", uptime: true, competitor: true },
	{ feature: "Status pages", uptime: true, competitor: "Via Incidents", highlight: true },
	{ feature: "SSL monitoring", uptime: true, competitor: true },
	{ feature: "DNS monitoring", uptime: true, competitor: true },
	{ feature: "Content/keyword monitoring", uptime: true, competitor: true },
	{ feature: "Native Slack/Discord", uptime: true, competitor: "Slack only" },
	{ feature: "Maintenance windows", uptime: true, competitor: true },
	{ feature: "Recovery alerts", uptime: true, competitor: true },
	{ feature: "API access", uptime: true, competitor: true },
	{ feature: "Alert cooldowns", uptime: true, competitor: true },
	{ feature: "Cron Job Monitoring", uptime: true, competitor: true },
	{ feature: "Team collaboration", uptime: "Unlimited", competitor: "Per-seat pricing" },
	{ feature: "Global regions", uptime: "9", competitor: "100+" },
	{ feature: "Data retention", uptime: "365 days", competitor: "15 months" },
	{
		feature: "Pricing model",
		uptime: "Usage-based ($5/mo)",
		competitor: "Per-test (~$5-12/1000)",
		highlight: true,
	},
	{ feature: "APM/Logs/Infrastructure", uptime: false, competitor: true },
	{ feature: "Real User Monitoring", uptime: false, competitor: true },
];

let whySwitchReasons = [
	{
		icon: <DollarSignIcon className="size-6" />,
		title: "Pay only for what you need",
		description:
			"Datadog's power comes with complexity and cost. If you just need uptime monitoring, why pay for a full observability platform?",
	},
	{
		icon: <CheckIcon className="size-6" />,
		title: "No vendor lock-in",
		description:
			"Works alongside your existing tools. Keep Datadog for APM and logs, use Uptime for focused uptime monitoring.",
	},
	{
		icon: <SparklesIcon className="size-6" />,
		title: "Simple, transparent pricing",
		description:
			"$5/mo base includes 5,000 pings. Additional pings at $0.001 each. No complicated SKUs or surprise bills.",
	},
	{
		icon: <ZapIcon className="size-6" />,
		title: "Built for developers who want simplicity",
		description:
			"Clean, fast dashboard focused on one thing: keeping your services up. No feature bloat or configuration overhead.",
	},
];

let honestTakeReasons = [
	{
		title: "If you need a full observability platform",
		description:
			"Datadog excels at combining logs, traces, metrics, and monitoring in one platform. If you need that unified view, Datadog is the better choice.",
	},
	{
		title: "If you need browser/transaction testing",
		description:
			"Datadog's Synthetic Monitoring includes browser tests and multi-step API tests. Uptime focuses on HTTP endpoint monitoring.",
	},
	{
		title: "If you're already paying for Datadog",
		description:
			"If your team already uses Datadog for other features, adding Synthetic Monitoring might make sense for a unified workflow.",
	},
];

let pricingScenarios = [
	{
		scenario: "10 monitors at 30-min intervals",
		competitorCost: "~$50/mo",
		uptimeCost: "~$15/mo",
		savings: "70%",
	},
	{
		scenario: "25 monitors at 60-min intervals",
		competitorCost: "~$60/mo",
		uptimeCost: "~$18/mo",
		savings: "70%",
	},
	{
		scenario: "50 monitors at 60-min intervals",
		competitorCost: "~$100/mo",
		uptimeCost: "~$36/mo",
		savings: "64%",
	},
];

let faqItems = [
	{
		question: "How does Uptime's pricing compare to Datadog Synthetic Monitoring?",
		answer:
			"Datadog charges ~$5 per 1,000 API test runs and ~$12 per 1,000 browser test runs, plus requires a base Datadog subscription. Uptime starts at $5/mo with 5,000 pings included. For pure uptime monitoring, Uptime is significantly more affordable.",
	},
	{
		question: "Can I use Uptime alongside Datadog?",
		answer:
			"Absolutely! Many teams use Datadog for APM, logs, and infrastructure monitoring while using Uptime for dedicated uptime monitoring. Uptime's webhook alerts can even send data to Datadog if needed.",
	},
	{
		question: "Does Uptime have as many features as Datadog?",
		answer:
			"No, and that's by design. Datadog is a full observability platform with APM, logs, infrastructure monitoring, and more. Uptime focuses solely on uptime monitoring, making it simpler and more affordable for teams who don't need the full suite.",
	},
	{
		question: "What about browser testing and multi-step transactions?",
		answer:
			"Uptime focuses on HTTP endpoint monitoring and doesn't offer browser testing or multi-step transaction monitoring. If you need those features, Datadog's Synthetic Monitoring is better suited.",
	},
	{
		question: "Is Uptime reliable enough for production monitoring?",
		answer:
			"Yes! Uptime runs on Cloudflare's global edge network with 99.9% uptime SLA, 9 global monitoring regions, and sub-second alert latency. It's built for production workloads.",
	},
	{
		question: "How do team seats compare?",
		answer:
			"Uptime includes unlimited team members at no extra cost. Datadog charges per-seat for most features, which can add up quickly for larger teams.",
	},
	{
		question: "Can I migrate from Datadog Synthetic Monitoring?",
		answer:
			"Yes! Setting up monitors in Uptime takes minutes. Simply create new monitors with the same URLs and configurations. There's no automated import, but the process is straightforward.",
	},
	{
		question: "What if I need features Uptime doesn't have?",
		answer:
			"We're transparent about our focus. If you need APM, log management, browser testing, or a unified observability platform, Datadog is the better choice. Uptime is ideal for teams who want dedicated, affordable uptime monitoring.",
	},
];

export default function VsDatadogPage() {
	let { t } = useTranslation();
	let parentData = useRouteLoaderData<typeof landingLoader>("routes/_landing");
	let isSignedIn = parentData?.isSignedIn ?? false;

	return (
		<>
			<CompareHero
				competitor="Datadog"
				tagline="Focused monitoring. No complexity."
				description="Get dedicated uptime monitoring without the overhead of a full observability platform. See how Uptime compares to Datadog Synthetic Monitoring."
				isSignedIn={isSignedIn}
			/>

			<CompareFeatureTable competitor="Datadog" features={features} />

			<CompareWhySwitch
				title="Why teams choose Uptime over Datadog for uptime monitoring"
				reasons={whySwitchReasons}
			/>

			<CompareHonestTake competitor="Datadog" reasons={honestTakeReasons} />

			<ComparePerfectFor
				title="Perfect for teams that already have their observability stack"
				description="If you already use Datadog, Grafana, or other tools for APM and logs, Uptime is the focused, affordable choice for uptime monitoring. No need to pay for features you won't use."
				highlights={[
					"Works alongside existing tools",
					"No vendor lock-in",
					"Unlimited team members included",
				]}
			/>

			<ComparePricing
				competitor="Datadog Synthetics"
				competitorPrice="~$50+/mo"
				scenarios={pricingScenarios}
			/>

			<CompareCTA isSignedIn={isSignedIn} competitor="Datadog" />

			<CompareFAQ
				badge={t("landing.faq.badge")}
				title={t("landing.faq.title")}
				description="Answers to frequently asked questions about switching from Datadog."
				items={faqItems}
			/>

			<LandingFinalCTA
				isSignedIn={isSignedIn}
				title="Ready for focused uptime monitoring?"
				description="Join developers who chose Uptime for dedicated monitoring alongside their existing observability tools."
				ctaOut="Start Free Trial"
			/>
		</>
	);
}
