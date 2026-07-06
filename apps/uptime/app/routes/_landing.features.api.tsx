/**
 * Marketing landing page for the public REST API feature. Its loader builds
 * localized SEO meta including SoftwareApplication JSON-LD, and the component
 * composes the shared landing sections with copy about programmatic monitor
 * management, alert configuration, metrics access, API keys, and rate limits.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import {
	BookOpenIcon,
	CodeIcon,
	KeyIcon,
	LayersIcon,
	RefreshCwIcon,
	ShieldCheckIcon,
	TerminalIcon,
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
import { generateMeta, getSoftwareApplicationSchema } from "~/lib/seo";
import { i18next } from "~/middleware/i18next";

import type { Route } from "./+types/_landing.features.api";
import type { loader as landingLoader } from "./_landing";

export const meta: Route.MetaFunction = ({ data }) => data?.meta ?? [];

export async function loader({ request, context }: Route.LoaderArgs) {
	let { t } = i18next(context);

	return {
		meta: generateMeta({
			title: t("landing.features.api.meta.title"),
			description: t("landing.features.api.meta.description"),
			url: request.url,
			jsonLd: getSoftwareApplicationSchema({
				name: "Uptime API",
				description:
					"Integrate monitoring into your workflow with our REST API. Create monitors, manage alerts, and access metrics programmatically.",
			}),
		}),
	};
}

export default function FeaturesAPIPage() {
	let parentData = useRouteLoaderData<typeof landingLoader>("routes/_landing");
	let isSignedIn = parentData?.isSignedIn ?? false;

	return (
		<>
			<LandingHero
				isSignedIn={isSignedIn}
				badge="Public API"
				title={
					<>
						Automate your monitoring with our{" "}
						<strong className="text-primary-600 dark:text-primary-400">powerful API</strong>
					</>
				}
				description="Full REST API access to create monitors, manage alerts, and retrieve metrics. Build custom integrations and automate your workflow."
				highlights={["REST API", "Full access", "Automation ready"]}
			/>

			<LandingTrustIndicators
				indicators={[
					{
						icon: <CodeIcon className="size-6" />,
						value: "REST",
						label: "API",
					},
					{
						icon: <BookOpenIcon className="size-6" />,
						value: "Full",
						label: "Documentation",
					},
					{
						icon: <KeyIcon className="size-6" />,
						value: "API",
						label: "Keys",
					},
					{
						icon: <ZapIcon className="size-6" />,
						value: "Fast",
						label: "Responses",
					},
				]}
			/>

			<LandingFeatures
				badge="Deep Dive"
				title="Everything you need to integrate"
				description="A complete API for managing your monitoring infrastructure programmatically."
				features={[
					{
						title: "Monitor management",
						description:
							"Create, update, delete, and list monitors. Full CRUD operations for all monitor types.",
						icon: <LayersIcon className="size-6" />,
					},
					{
						title: "Alert configuration",
						description:
							"Manage alert channels and notification settings. Configure email, Slack, Discord, and webhooks.",
						icon: <RefreshCwIcon className="size-6" />,
					},
					{
						title: "Metrics access",
						description:
							"Retrieve uptime percentages, response times, and historical data. Build custom dashboards.",
						icon: <TerminalIcon className="size-6" />,
					},
					{
						title: "Status page control",
						description:
							"Create and manage status pages programmatically. Control which monitors appear and their display settings.",
						icon: <CodeIcon className="size-6" />,
					},
					{
						title: "Secure authentication",
						description:
							"API keys with granular permissions. Rotate keys without downtime. Audit access logs.",
						icon: <KeyIcon className="size-6" />,
					},
					{
						title: "Rate limiting",
						description:
							"Generous rate limits for automation. Clear headers indicate remaining quota.",
						icon: <ShieldCheckIcon className="size-6" />,
					},
				]}
			/>

			<LandingHowItWorks
				title="Get started with the API"
				description="Start making API calls in three simple steps."
				steps={[
					{
						title: "Generate API key",
						description:
							"Create an API key from your dashboard. Set permissions for read, write, or full access.",
					},
					{
						title: "Read the docs",
						description:
							"Explore our comprehensive API documentation with examples in multiple languages.",
					},
					{
						title: "Start building",
						description:
							"Make your first API call. Create monitors, fetch metrics, and automate your workflow.",
					},
				]}
			/>

			<LandingFAQ
				title="Frequently asked questions"
				description="Common questions about our public API."
				items={[
					{
						question: "What can I do with the API?",
						answer:
							"Everything! Create and manage monitors, configure alerts, access metrics, manage status pages, and more.",
					},
					{
						question: "Is there API documentation?",
						answer:
							"Yes, comprehensive documentation with examples in curl, JavaScript, Python, and other languages.",
					},
					{
						question: "What are the rate limits?",
						answer:
							"Generous limits for most use cases. Response headers indicate your current quota and reset time.",
					},
					{
						question: "How do I authenticate?",
						answer:
							"Use API keys passed in the Authorization header. Keys can have read-only or full access permissions.",
					},
					{
						question: "Can I use the API for CI/CD?",
						answer:
							"Absolutely. Create monitors during deployment, pause during maintenance, and integrate with your pipeline.",
					},
					{
						question: "Is there a webhook for events?",
						answer:
							"Yes, configure webhooks to receive real-time notifications for monitor events and status changes.",
					},
				]}
			/>

			<LandingFinalCTA
				isSignedIn={isSignedIn}
				title="Build with our API"
				description="Generate your API key and start integrating monitoring into your workflow today."
			/>
		</>
	);
}
