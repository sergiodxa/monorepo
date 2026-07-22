/**
 * Marketing use-case route for the API monitoring landing page. It composes the
 * shared hero, trust indicators, feature grid, how-it-works steps, and FAQ with
 * copy about monitoring REST/GraphQL endpoints and webhooks using custom auth
 * headers and status-code validation. It exists as an SEO page for API monitoring.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import {
	ClockIcon,
	CodeIcon,
	GlobeIcon,
	KeyIcon,
	NetworkIcon,
	ServerIcon,
	ShieldIcon,
	WebhookIcon,
	ZapIcon,
} from "lucide-react";
import { useRouteLoaderData } from "react-router";

import {
	LandingFAQ,
	LandingFeatures,
	LandingFinalCTA,
	LandingHero,
	LandingHowItWorks,
	LandingTrustIndicators,
} from "~/components/landing";
import { generateMeta } from "~/lib/seo";
import { i18next } from "~/middleware/i18next";

import type { Route } from "./+types/_landing.use-cases.api-monitoring";
import type { loader as landingLoader } from "./_landing";

export const meta: Route.MetaFunction = ({ loaderData }) => loaderData?.meta ?? [];

export async function loader({ request, context }: Route.LoaderArgs) {
	let { t } = i18next(context);

	return {
		meta: generateMeta({
			title: t("landing.useCases.apiMonitoring.meta.title"),
			description: t("landing.useCases.apiMonitoring.meta.description"),
			url: request.url,
		}),
	};
}

const trustIndicators = [
	{
		icon: <CodeIcon className="size-6" />,
		value: "REST",
		label: "& GraphQL",
	},
	{
		icon: <GlobeIcon className="size-6" />,
		value: "9",
		label: "Regions",
	},
	{
		icon: <ClockIcon className="size-6" />,
		value: "P99",
		label: "Latency",
	},
	{
		icon: <ShieldIcon className="size-6" />,
		value: "Auth",
		label: "Headers",
	},
];

const features = [
	{
		title: "REST API monitoring",
		description: "Monitor any REST endpoint. Validate responses return expected status codes.",
		icon: <ServerIcon className="size-6" />,
	},
	{
		title: "GraphQL support",
		description: "Monitor your GraphQL endpoints with GET or POST health checks.",
		icon: <NetworkIcon className="size-6" />,
	},
	{
		title: "Custom headers",
		description: "Add Authorization tokens, API keys, or any custom headers your API requires.",
		icon: <KeyIcon className="size-6" />,
	},
	{
		title: "Status code validation",
		description: "Expect 200, 201, 204, or any status code your endpoint should return.",
		icon: <ZapIcon className="size-6" />,
	},
	{
		title: "Global latency tracking",
		description: "Measure API response times from 9 regions worldwide.",
		icon: <GlobeIcon className="size-6" />,
	},
	{
		title: "Webhook monitoring",
		description: "Ensure your incoming webhook endpoints are ready to receive data.",
		icon: <WebhookIcon className="size-6" />,
	},
];

const howItWorksSteps = [
	{
		title: "Add your API endpoint",
		description: "Enter the URL of your API—REST, GraphQL, or webhook receiver.",
	},
	{
		title: "Configure authentication",
		description: "Add headers for API keys or Bearer tokens if needed.",
	},
	{
		title: "Monitor globally",
		description: "Select regions and intervals. Track performance worldwide.",
	},
];

const faqItems = [
	{
		question: "Can I monitor authenticated APIs?",
		answer:
			"Yes, add custom headers including Authorization, API-Key, or any header your API expects.",
	},
	{
		question: "Do you support GraphQL?",
		answer: "Yes, monitor GraphQL endpoints via GET or POST. We check the HTTP status code.",
	},
	{
		question: "What about rate-limited APIs?",
		answer:
			"Set check intervals appropriately. 10-60 minute intervals work well for rate-limited APIs.",
	},
	{
		question: "Can I monitor internal APIs?",
		answer:
			"Only if they're publicly accessible. For internal APIs, expose a health check endpoint.",
	},
	{
		question: "How do I validate JSON responses?",
		answer: "Currently we validate status codes. JSON body validation is on our roadmap.",
	},
	{
		question: "Can I monitor multiple API versions?",
		answer: "Yes, create separate monitors for /v1, /v2, etc. Track each independently.",
	},
];

export default function ApiMonitoringPage() {
	let parentData = useRouteLoaderData<typeof landingLoader>("routes/_landing");
	let isSignedIn = parentData?.isSignedIn ?? false;

	return (
		<>
			<LandingHero
				isSignedIn={isSignedIn}
				badge="API Monitoring"
				title={
					<>
						Keep your APIs{" "}
						<strong className="text-primary-600 dark:text-primary-400">running smoothly</strong>
					</>
				}
				description="Monitor REST APIs, GraphQL endpoints, and webhooks. Validate status codes and track response times from 9 global regions."
				highlights={["Any HTTP endpoint", "Status code validation", "Response time tracking"]}
			/>

			<LandingTrustIndicators indicators={trustIndicators} />

			<LandingFeatures
				title="Everything you need for API monitoring"
				description="Monitor any HTTP endpoint with powerful validation and global coverage."
				features={features}
			/>

			<LandingHowItWorks
				title="Get started in minutes"
				description="Set up API monitoring quickly and start tracking performance."
				steps={howItWorksSteps}
			/>

			<LandingFAQ
				title="Frequently asked questions"
				description="Common questions about API monitoring."
				items={faqItems}
			/>

			<LandingFinalCTA
				isSignedIn={isSignedIn}
				title="Start monitoring your APIs"
				description="Ensure your APIs are always available for your users and integrations."
			/>
		</>
	);
}
