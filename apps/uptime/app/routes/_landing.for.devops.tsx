import {
	BellIcon,
	CodeIcon,
	GitBranchIcon,
	LayersIcon,
	ServerIcon,
	TerminalIcon,
	WebhookIcon,
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

import type { loader as landingLoader } from "./_landing";

export function meta() {
	return [
		{ title: "Uptime for DevOps | API-First Monitoring" },
		{
			name: "description",
			content:
				"Uptime monitoring built for DevOps workflows. API-first design, webhook integrations, and fits into your existing toolchain.",
		},
	];
}

export default function ForDevOpsPage() {
	let parentData = useRouteLoaderData<typeof landingLoader>("routes/_landing");
	let isSignedIn = parentData?.isSignedIn ?? false;

	return (
		<>
			<LandingHero
				isSignedIn={isSignedIn}
				badge="For DevOps"
				title={
					<>
						Monitoring that fits{" "}
						<strong className="text-primary-600 dark:text-primary-400">your workflow</strong>
					</>
				}
				description="API-first uptime monitoring that integrates with your existing tools. No vendor lock-in, no complexity."
				highlights={["API-first design", "Webhook integrations", "Works with your stack"]}
			/>

			<LandingTrustIndicators
				indicators={[
					{
						icon: <CodeIcon className="size-6" />,
						value: "API",
						label: "First",
					},
					{
						icon: <WebhookIcon className="size-6" />,
						value: "Webhooks",
						label: "Built-in",
					},
					{
						icon: <LayersIcon className="size-6" />,
						value: "No",
						label: "Lock-in",
					},
					{
						icon: <TerminalIcon className="size-6" />,
						value: "CLI",
						label: "Friendly",
					},
				]}
			/>

			<LandingFeatures
				title="Built for automation"
				description="Everything DevOps teams need to integrate monitoring into their workflow"
				features={[
					{
						icon: <CodeIcon className="size-6" />,
						title: "Full REST API",
						description:
							"Every dashboard action available via API. Automate monitor creation and management.",
					},
					{
						icon: <WebhookIcon className="size-6" />,
						title: "Webhook alerts",
						description:
							"Send alerts to PagerDuty, OpsGenie, or custom endpoints with HMAC signatures.",
					},
					{
						icon: <ServerIcon className="size-6" />,
						title: "Works alongside existing tools",
						description: "Use Uptime for monitoring, keep Datadog/Grafana for APM and logs.",
					},
					{
						icon: <LayersIcon className="size-6" />,
						title: "No vendor lock-in",
						description: "Simple data model, easy to migrate in or out.",
					},
					{
						icon: <GitBranchIcon className="size-6" />,
						title: "Infrastructure as code ready",
						description: "API makes it easy to manage monitors via Terraform or scripts.",
					},
					{
						icon: <BellIcon className="size-6" />,
						title: "Alert routing flexibility",
						description: "Route different monitors to different channels based on severity.",
					},
				]}
			/>

			<LandingHowItWorks
				title="Integrate in minutes"
				description="Three simple steps to automated monitoring"
				steps={[
					{
						title: "Set up via API or dashboard",
						description: "Create monitors programmatically or through the UI.",
					},
					{
						title: "Integrate with your stack",
						description: "Connect alerts to your existing incident management tools.",
					},
					{
						title: "Automate everything",
						description: "Use the API to manage monitors as part of your deployment pipeline.",
					},
				]}
			/>

			<LandingFAQ
				title="Questions? We've got answers"
				description="Everything you need to know about Uptime for DevOps"
				items={[
					{
						question: "Is there an API for everything?",
						answer: "Yes, all dashboard functionality is available via REST API.",
					},
					{
						question: "How do webhook alerts work?",
						answer: "We POST JSON payloads to your endpoint, optionally signed with HMAC SHA256.",
					},
					{
						question: "Can I use this with Terraform?",
						answer: "The API makes it easy to manage monitors via Terraform or any IaC tool.",
					},
					{
						question: "Do you integrate with PagerDuty/OpsGenie?",
						answer: "Yes, via webhooks. Configure your endpoint and we'll send alerts.",
					},
					{
						question: "How does this fit with Datadog/Grafana?",
						answer:
							"Use Uptime for uptime monitoring, keep your existing tools for APM, logs, and metrics.",
					},
					{
						question: "Is there rate limiting on the API?",
						answer: "Reasonable limits that won't affect normal automation workflows.",
					},
				]}
			/>

			<LandingFinalCTA
				isSignedIn={isSignedIn}
				title="Monitoring built for automation"
				description="API-first design means Uptime fits into your workflow, not the other way around."
			/>
		</>
	);
}
