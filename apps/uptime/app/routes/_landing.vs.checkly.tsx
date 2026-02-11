import { DollarSignIcon, MousePointerClickIcon, UsersIcon, ZapIcon } from "lucide-react";
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

import type { Route } from "./+types/_landing.vs.checkly";
import type { loader as landingLoader } from "./_landing";

export const meta: Route.MetaFunction = ({ data }) => data?.meta ?? [];

export async function loader({ request, context }: Route.LoaderArgs) {
	let { t } = i18next(context);

	return {
		meta: generateMeta({
			title: t("landing.vs.checkly.meta.title"),
			description: t("landing.vs.checkly.meta.description"),
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
	{ feature: "Cron Job Monitoring", uptime: true, competitor: false, highlight: true },
	{ feature: "Team collaboration", uptime: "Unlimited", competitor: "Per-seat", highlight: true },
	{ feature: "Global regions", uptime: "9", competitor: "22" },
	{ feature: "Data retention", uptime: "365 days", competitor: "Varies" },
	{
		feature: "Setup approach",
		uptime: "No-code UI",
		competitor: "Monitoring as Code",
		highlight: true,
	},
	{
		feature: "Pricing model",
		uptime: "Usage-based ($5/mo)",
		competitor: "Per-check ($24/mo)",
		highlight: true,
	},
];

let whySwitchReasons = [
	{
		icon: <MousePointerClickIcon className="size-6" />,
		title: "No coding required",
		description:
			"Perfect for non-developers and teams without dedicated DevOps. Set up monitoring through our intuitive UI in minutes, not hours.",
	},
	{
		icon: <DollarSignIcon className="size-6" />,
		title: "5x more affordable entry point",
		description:
			"Start at $5/mo instead of $24/mo. Our usage-based pricing means you only pay for what you actually use.",
	},
	{
		icon: <ZapIcon className="size-6" />,
		title: "Simple to set up in minutes",
		description:
			"No need to learn a new DSL or set up CI/CD pipelines. Just enter your URLs and start monitoring immediately.",
	},
	{
		icon: <UsersIcon className="size-6" />,
		title: "Unlimited team members included",
		description:
			"Invite your whole team at no extra cost. Checkly charges per seat, which adds up quickly for larger teams.",
	},
];

let honestTakeReasons = [
	{
		title: "If you need Playwright browser testing",
		description:
			"Checkly's core strength is browser-based testing with Playwright. If you need to test user flows, form submissions, or complex interactions, Checkly is purpose-built for this.",
	},
	{
		title: "If you prefer monitoring-as-code approach",
		description:
			"Checkly lets you define monitors in code and version control them alongside your application. This is ideal for teams with strong DevOps practices who want infrastructure-as-code.",
	},
	{
		title: "If you need complex multi-step API checks",
		description:
			"Checkly excels at chaining API calls together, extracting values between steps, and testing complex workflows. Uptime focuses on simpler HTTP health checks.",
	},
	{
		title: "If you want Terraform/Pulumi integration",
		description:
			"Checkly has first-class support for Terraform and Pulumi providers. If you're managing infrastructure as code, Checkly integrates seamlessly into your workflow.",
	},
];

let pricingScenarios = [
	{
		scenario: "10 monitors at 30-min intervals",
		competitorCost: "$24/mo",
		uptimeCost: "~$15/mo",
		savings: "38%",
	},
	{
		scenario: "25 monitors at 60-min intervals",
		competitorCost: "$24/mo",
		uptimeCost: "~$18/mo",
		savings: "25%",
	},
	{
		scenario: "50 monitors at 60-min intervals",
		competitorCost: "$45/mo",
		uptimeCost: "~$36/mo",
		savings: "20%",
	},
	{
		scenario: "Team of 5 people",
		competitorCost: "+$60/mo seats",
		uptimeCost: "$0 extra",
		savings: "100%",
	},
];

let faqItems = [
	{
		question: "What's the main difference between Uptime and Checkly?",
		answer:
			"Checkly is a developer-focused monitoring-as-code platform with Playwright browser testing at its core. Uptime is a no-code monitoring solution focused on simple uptime checks. Choose Checkly if you need browser testing and infrastructure-as-code; choose Uptime if you want simple, affordable monitoring without coding.",
	},
	{
		question: "How does pricing compare?",
		answer:
			"Uptime starts at $5/mo with usage-based pricing, while Checkly's Starter plan is $24/mo. With longer check intervals (30-60 minutes), Uptime costs 20-40% less. Additionally, Checkly charges per team seat while Uptime includes unlimited team members.",
	},
	{
		question: "Do I need to write code to use Uptime?",
		answer:
			"No! Uptime is designed to be completely no-code. You can set up monitors, configure alerts, and create status pages entirely through our web interface. No programming, no CLI tools, no YAML files required.",
	},
	{
		question: "Can Uptime do browser testing like Checkly?",
		answer:
			"No, Uptime focuses on HTTP-based uptime monitoring, SSL checks, and keyword monitoring. If you need Playwright browser testing, visual regression testing, or complex multi-step user flow testing, Checkly is the better choice.",
	},
	{
		question: "What if I have a team of 10 people?",
		answer:
			"With Uptime, you get unlimited team members on all plans at no extra cost. With Checkly, you'd pay for additional seats beyond their base plan allowance, which can add $10-15 per user per month.",
	},
	{
		question: "Does Uptime support Terraform or Pulumi?",
		answer:
			"No, Uptime is designed as a UI-first tool without infrastructure-as-code integration. If you manage your infrastructure with Terraform or Pulumi and want your monitoring defined alongside it, Checkly's providers would be a better fit.",
	},
	{
		question: "Which should I choose as a non-technical founder?",
		answer:
			"Uptime is designed for you. You can set up monitoring in minutes without any technical knowledge. Checkly requires JavaScript/TypeScript knowledge and familiarity with testing concepts. If your site goes down, you want to know—you don't need complex browser testing for that.",
	},
	{
		question: "Can I migrate from Checkly to Uptime?",
		answer:
			"If you're only using Checkly for basic HTTP checks, yes! You can recreate those monitors in Uptime in minutes. However, if you rely on Checkly's Playwright tests or multi-step API checks, those features don't exist in Uptime.",
	},
];

export default function VsChecklyPage() {
	let parentData = useRouteLoaderData<typeof landingLoader>("routes/_landing");
	let isSignedIn = parentData?.isSignedIn ?? false;

	return (
		<>
			<CompareHero
				competitor="Checkly"
				tagline="Simple uptime monitoring. Without the code."
				description="Get reliable monitoring without learning a new DSL or setting up CI/CD pipelines. See how Uptime compares to Checkly."
				isSignedIn={isSignedIn}
			/>

			<CompareFeatureTable competitor="Checkly" features={features} />

			<CompareWhySwitch title="Why teams are switching to Uptime" reasons={whySwitchReasons} />

			<CompareHonestTake competitor="Checkly" reasons={honestTakeReasons} />

			<ComparePerfectFor
				title="Perfect for teams that already have their stack"
				description="If you just need monitoring—not a full observability platform—Uptime is the focused, affordable choice. Great for teams that already use Datadog, Grafana, or other tools for logging and APM."
				highlights={[
					"Works alongside your existing tools",
					"No vendor lock-in",
					"API-first design",
				]}
			/>

			<ComparePricing competitor="Checkly" competitorPrice="$24/mo" scenarios={pricingScenarios} />

			<CompareCTA isSignedIn={isSignedIn} competitor="Checkly" />

			<CompareFAQ
				badge="FAQ"
				title="Common questions"
				description="Answers to frequently asked questions about Uptime vs Checkly."
				items={faqItems}
			/>

			<LandingFinalCTA
				isSignedIn={isSignedIn}
				title="Ready for simpler monitoring?"
				description="Join thousands of teams who chose simplicity over complexity. Start monitoring in minutes, not hours."
				ctaOut="Start Free Trial"
			/>
		</>
	);
}
