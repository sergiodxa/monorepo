/**
 * Marketing comparison route rendering the "Uptime vs Cronitor" landing page. It
 * defines the feature-parity table, why-switch reasons, honest-take caveats,
 * pricing scenarios, and FAQ highlighting DNS/TCP monitoring and simpler pricing,
 * composed via the shared compare components as an SEO-targeted conversion page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { DollarSignIcon, FocusIcon, GlobeIcon, ZapIcon } from "lucide-react";
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

import type { Route } from "./+types/_landing.vs.cronitor";
import type { loader as landingLoader } from "./_landing";

export const meta: Route.MetaFunction = ({ data }) => data?.meta ?? [];

export async function loader({ request, context }: Route.LoaderArgs) {
	let { t } = i18next(context);

	return {
		meta: generateMeta({
			title: t("landing.vs.cronitor.meta.title"),
			description: t("landing.vs.cronitor.meta.description"),
			url: request.url,
		}),
	};
}

let features = [
	{ feature: "Cron Job Monitoring", uptime: true, competitor: true },
	{ feature: "HTTP/API Monitoring", uptime: true, competitor: true },
	{ feature: "DNS Monitoring", uptime: true, competitor: false, highlight: true },
	{ feature: "TCP Port Monitoring", uptime: true, competitor: false, highlight: true },
	{ feature: "SSL Certificate Monitoring", uptime: true, competitor: true },
	{ feature: "Status Pages", uptime: true, competitor: true },
	{ feature: "Real User Monitoring (RUM)", uptime: false, competitor: true },
	{ feature: "Heartbeat Monitoring", uptime: true, competitor: true },
	{ feature: "Grace Period Configuration", uptime: true, competitor: true },
	{ feature: "Slack Integration", uptime: "Native", competitor: "Native" },
	{ feature: "Discord Integration", uptime: "Native", competitor: true },
	{
		feature: "Pricing Model",
		uptime: "Simple usage-based",
		competitor: "Complex tiers",
		highlight: true,
	},
	{ feature: "Free Tier", uptime: "Manual only", competitor: "Limited" },
];

let whySwitchReasons = [
	{
		icon: <DollarSignIcon className="size-6" />,
		title: "Simpler, predictable pricing",
		description:
			"No confusing feature bundles or tier calculations. Pay $5/month base plus usage. Know exactly what you'll pay without spreadsheet math.",
	},
	{
		icon: <GlobeIcon className="size-6" />,
		title: "DNS and TCP monitoring included",
		description:
			"Monitor your DNS records and TCP ports alongside HTTP and cron jobs. Cronitor doesn't offer these monitoring types.",
	},
	{
		icon: <FocusIcon className="size-6" />,
		title: "Focused, not bloated",
		description:
			"Uptime does monitoring well without trying to be an observability platform. No feature sprawl—just the monitoring you need.",
	},
	{
		icon: <ZapIcon className="size-6" />,
		title: "Fast, modern interface",
		description:
			"A clean dashboard that loads instantly. Visual heatmaps show your service health at a glance without navigating complex menus.",
	},
];

let honestTakeReasons = [
	{
		title: "If you need Real User Monitoring (RUM)",
		description:
			"Cronitor offers RUM to track actual user experiences. Uptime focuses on synthetic monitoring—if you need RUM, Cronitor has you covered.",
	},
	{
		title: "If you want synthetic browser checks",
		description:
			"Cronitor can run browser-based checks that execute JavaScript. Uptime's HTTP monitoring is powerful but doesn't run full browser sessions.",
	},
	{
		title: "If you need error tracking built-in",
		description:
			"Cronitor includes error tracking features. If you want monitoring and error tracking in one tool, that might be valuable for your team.",
	},
];

let pricingScenarios = [
	{
		scenario: "Basic monitoring (20 monitors)",
		competitorCost: "$20/mo (Starter)",
		uptimeCost: "~$10/mo",
		savings: "~$120/year",
	},
	{
		scenario: "Growing team (50 monitors)",
		competitorCost: "$49/mo+ (Pro)",
		uptimeCost: "~$25/mo",
		savings: "~$288/year",
	},
	{
		scenario: "Full monitoring suite",
		competitorCost: "$99/mo+ (Business)",
		uptimeCost: "~$40/mo",
		savings: "~$708/year",
	},
];

let faqItems = [
	{
		question: "Can I migrate my monitors from Cronitor?",
		answer:
			"You'll need to recreate monitors manually, but it's quick. For cron jobs, create new heartbeat monitors and update your ping URLs. For HTTP monitors, simply add your endpoints with the same check intervals.",
	},
	{
		question: "How does pricing compare for similar usage?",
		answer:
			"Cronitor uses tiered pricing that scales up quickly as you add features or monitors. Uptime's $5/month base plus $0.001/ping model is predictable and often cheaper, especially for teams with longer check intervals.",
	},
	{
		question: "What monitoring types does Uptime offer that Cronitor doesn't?",
		answer:
			"Uptime includes DNS and TCP port monitoring that Cronitor doesn't offer. You can monitor DNS record changes and verify that TCP services are responding—useful for databases, mail servers, and other infrastructure.",
	},
	{
		question: "Why doesn't Uptime have RUM?",
		answer:
			"Uptime focuses on synthetic monitoring—actively checking your services rather than tracking real user sessions. Many teams already use dedicated RUM tools like Datadog or Sentry and just need reliable synthetic monitoring.",
	},
	{
		question: "How do status pages compare?",
		answer:
			"Both Uptime and Cronitor offer status pages. Uptime includes status pages at no extra cost with custom domains and subscriber notifications.",
	},
	{
		question: "What about alerting and integrations?",
		answer:
			"Both platforms offer native Slack integration and webhook support. Uptime also has native Discord integration with rich message formatting for teams that use Discord.",
	},
];

export default function VsCronitorPage() {
	let parentData = useRouteLoaderData<typeof landingLoader>("routes/_landing");
	let isSignedIn = parentData?.isSignedIn ?? false;

	return (
		<>
			<CompareHero
				competitor="Cronitor"
				tagline="Simpler pricing, focused monitoring"
				description="While Cronitor bundles monitoring with RUM and error tracking, Uptime offers focused monitoring with simpler pricing and DNS/TCP support Cronitor lacks."
				isSignedIn={isSignedIn}
			/>

			<CompareFeatureTable competitor="Cronitor" features={features} />

			<CompareWhySwitch title="Why teams choose Uptime over Cronitor" reasons={whySwitchReasons} />

			<CompareHonestTake competitor="Cronitor" reasons={honestTakeReasons} />

			<ComparePerfectFor
				title="Perfect for teams that want monitoring without the bloat"
				description="If you already have observability tools and just need reliable, focused monitoring, Uptime delivers exactly that. No upsells to features you don't need."
				highlights={[
					"DNS and TCP monitoring included",
					"Simple usage-based pricing",
					"Works alongside your existing stack",
				]}
			/>

			<ComparePricing competitor="Cronitor" competitorPrice="$20/mo" scenarios={pricingScenarios} />

			<CompareCTA isSignedIn={isSignedIn} competitor="Cronitor" />

			<CompareFAQ
				title="Common questions"
				description="Answers to questions about switching from Cronitor."
				items={faqItems}
			/>

			<LandingFinalCTA
				isSignedIn={isSignedIn}
				title="Ready for simpler monitoring?"
				description="Join teams who've switched to focused, usage-based monitoring."
				ctaOut="Start Free Today"
			/>
		</>
	);
}
