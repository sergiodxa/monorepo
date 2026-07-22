/**
 * Marketing comparison route rendering the "Uptime vs Healthchecks.io" landing page.
 * It defines the feature-parity table, why-switch reasons, honest-take caveats,
 * pricing scenarios, and FAQ positioning Uptime as an all-in-one platform versus a
 * cron-only tool, composed via the shared compare components as an SEO page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { BellIcon, GlobeIcon, LayoutDashboardIcon, ZapIcon } from "lucide-react";
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

import type { Route } from "./+types/_landing.vs.healthchecks";
import type { loader as landingLoader } from "./_landing";

export const meta: Route.MetaFunction = ({ loaderData }) => loaderData?.meta ?? [];

export async function loader({ request, context }: Route.LoaderArgs) {
	let { t } = i18next(context);

	return {
		meta: generateMeta({
			title: t("landing.vs.healthchecks.meta.title"),
			description: t("landing.vs.healthchecks.meta.description"),
			url: request.url,
		}),
	};
}

let features = [
	{ feature: "Cron Job Monitoring", uptime: true, competitor: true },
	{ feature: "HTTP/API Monitoring", uptime: true, competitor: false, highlight: true },
	{ feature: "DNS Monitoring", uptime: true, competitor: false, highlight: true },
	{ feature: "TCP Port Monitoring", uptime: true, competitor: false, highlight: true },
	{ feature: "SSL Certificate Monitoring", uptime: true, competitor: false, highlight: true },
	{ feature: "Status Pages", uptime: true, competitor: "Badges only", highlight: true },
	{ feature: "Grace Period Configuration", uptime: true, competitor: true },
	{ feature: "Cron Syntax Support", uptime: true, competitor: true },
	{ feature: "Slack Integration", uptime: "Native", competitor: "Webhook", highlight: true },
	{ feature: "Discord Integration", uptime: "Native", competitor: "Webhook", highlight: true },
	{ feature: "Email Alerts", uptime: true, competitor: true },
	{ feature: "Webhook Alerts", uptime: true, competitor: true },
	{ feature: "API Access", uptime: true, competitor: true },
	{ feature: "Free Tier", uptime: "Manual only", competitor: "20 monitors" },
];

let whySwitchReasons = [
	{
		icon: <GlobeIcon className="size-6" />,
		title: "Complete monitoring in one platform",
		description:
			"Don't juggle multiple tools. Monitor cron jobs, HTTP endpoints, DNS, TCP ports, and SSL certificates from a single dashboard.",
	},
	{
		icon: <LayoutDashboardIcon className="size-6" />,
		title: "Professional status pages",
		description:
			"Create branded status pages for your users instead of relying on basic badges. Keep stakeholders informed with real-time updates.",
	},
	{
		icon: <BellIcon className="size-6" />,
		title: "Native integrations",
		description:
			"First-class Slack and Discord integrations with rich formatting. No webhook configuration or third-party tools needed.",
	},
	{
		icon: <ZapIcon className="size-6" />,
		title: "Modern, unified dashboard",
		description:
			"See all your monitors—cron jobs, HTTP, DNS, and more—in one clean interface with visual heatmaps and quick insights.",
	},
];

let honestTakeReasons = [
	{
		title: "If you only need cron job monitoring",
		description:
			"Healthchecks.io does one thing really well. If cron monitoring is all you need and you don't anticipate needing HTTP or DNS monitoring, their focused approach might work for you.",
	},
	{
		title: "If you want a generous free tier",
		description:
			"Healthchecks.io offers 20 monitors for free with no credit card required. Uptime's free tier only includes manual pings.",
	},
	{
		title: "If badge-based status is enough",
		description:
			"If you just need simple status badges for your README or internal docs, Healthchecks.io provides these out of the box.",
	},
];

let pricingScenarios = [
	{
		scenario: "50 cron monitors",
		competitorCost: "Free (under 20) / $20/mo",
		uptimeCost: "~$8/mo",
		savings: "Full monitoring suite included",
	},
	{
		scenario: "100 monitors total",
		competitorCost: "$20/mo (cron only)",
		uptimeCost: "~$15/mo",
		savings: "HTTP + DNS + SSL included",
	},
	{
		scenario: "Mixed monitoring needs",
		competitorCost: "$20/mo + separate tool",
		uptimeCost: "~$20/mo",
		savings: "Single platform, no tool sprawl",
	},
];

let faqItems = [
	{
		question: "Can I migrate my cron monitors from Healthchecks.io?",
		answer:
			"You'll need to manually recreate your monitors, but the process is straightforward. Simply create new cron job monitors in Uptime with the same schedule expressions and update your endpoints to ping Uptime instead.",
	},
	{
		question: "How does cron job monitoring work in Uptime?",
		answer:
			"Uptime provides heartbeat monitoring with configurable grace periods. Your cron jobs ping a unique URL after each run. If we don't receive a ping within the expected window plus grace period, we alert you immediately.",
	},
	{
		question: "What if I also need HTTP monitoring?",
		answer:
			"That's where Uptime shines. Add HTTP, DNS, TCP, and SSL monitors alongside your cron jobs. Everything lives in one dashboard with unified alerting and status pages.",
	},
	{
		question: "How do the status pages compare?",
		answer:
			"Healthchecks.io provides status badges you can embed. Uptime offers full status pages with custom domains, incident management, and subscriber notifications—professional pages your users can actually visit.",
	},
	{
		question: "Do you support the same cron syntax?",
		answer:
			"Yes, Uptime supports standard cron syntax for scheduling. You can define exact schedules and grace periods just like with Healthchecks.io.",
	},
	{
		question: "What about Slack and Discord notifications?",
		answer:
			"Uptime has native Slack and Discord integrations with rich message formatting. No need to configure webhooks or use third-party bridges—just connect your workspace directly.",
	},
];

export default function VsHealthchecksPage() {
	let parentData = useRouteLoaderData<typeof landingLoader>("routes/_landing");
	let isSignedIn = parentData?.isSignedIn ?? false;

	return (
		<>
			<CompareHero
				competitor="Healthchecks.io"
				tagline="Complete monitoring, not just cron jobs"
				description="While Healthchecks.io focuses solely on cron monitoring, Uptime offers HTTP, DNS, TCP, SSL, and cron job monitoring in one unified platform."
				isSignedIn={isSignedIn}
			/>

			<CompareFeatureTable competitor="Healthchecks.io" features={features} />

			<CompareWhySwitch
				title="Why teams choose Uptime over Healthchecks.io"
				reasons={whySwitchReasons}
			/>

			<CompareHonestTake competitor="Healthchecks.io" reasons={honestTakeReasons} />

			<ComparePerfectFor
				title="Perfect for teams that need more than cron monitoring"
				description="If your infrastructure includes APIs, websites, and background jobs, why use separate tools? Uptime brings everything together with native integrations and professional status pages."
				highlights={[
					"Single dashboard for all monitoring types",
					"Native Slack/Discord integrations",
					"Professional status pages included",
				]}
			/>

			<ComparePricing
				competitor="Healthchecks.io"
				competitorPrice="$20/mo"
				scenarios={pricingScenarios}
			/>

			<CompareCTA isSignedIn={isSignedIn} competitor="Healthchecks.io" />

			<CompareFAQ
				title="Common questions"
				description="Answers to questions about switching from Healthchecks.io."
				items={faqItems}
			/>

			<LandingFinalCTA
				isSignedIn={isSignedIn}
				title="Ready for complete monitoring?"
				description="Join teams who've consolidated their monitoring into one powerful platform."
				ctaOut="Start Free Today"
			/>
		</>
	);
}
