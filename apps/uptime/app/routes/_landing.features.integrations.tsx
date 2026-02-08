import {
	BellIcon,
	FilterIcon,
	HashIcon,
	MessageSquareIcon,
	SettingsIcon,
	UsersIcon,
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

import type { loader as landingLoader } from "./_landing";

export function meta() {
	return [
		{ title: "Slack & Discord Integrations | Uptime Monitors" },
		{
			name: "description",
			content:
				"Get instant alerts in Slack and Discord when your services go down. Rich notifications with actionable details delivered where your team works.",
		},
	];
}

export default function FeaturesIntegrationsPage() {
	let parentData = useRouteLoaderData<typeof landingLoader>("routes/_landing");
	let isSignedIn = parentData?.isSignedIn ?? false;

	return (
		<>
			<LandingHero
				isSignedIn={isSignedIn}
				badge="Integrations"
				title={
					<>
						Get alerts where your team{" "}
						<strong className="text-primary-600 dark:text-primary-400">already works</strong>
					</>
				}
				description="Instant notifications in Slack and Discord. Rich, actionable alerts with all the context you need to respond quickly."
				highlights={["Slack integration", "Discord integration", "Rich notifications"]}
			/>

			<LandingTrustIndicators
				indicators={[
					{
						icon: <HashIcon className="size-6" />,
						value: "Slack",
						label: "Integration",
					},
					{
						icon: <MessageSquareIcon className="size-6" />,
						value: "Discord",
						label: "Integration",
					},
					{
						icon: <ZapIcon className="size-6" />,
						value: "Instant",
						label: "Delivery",
					},
					{
						icon: <BellIcon className="size-6" />,
						value: "Rich",
						label: "Notifications",
					},
				]}
			/>

			<LandingFeatures
				badge="Deep Dive"
				title="Powerful integrations for modern teams"
				description="Connect your monitoring to the tools your team uses every day."
				features={[
					{
						title: "Slack notifications",
						description:
							"Send alerts to any Slack channel. Rich formatted messages with monitor details and status.",
						icon: <HashIcon className="size-6" />,
					},
					{
						title: "Discord alerts",
						description:
							"Get notified in Discord servers. Perfect for developer communities and gaming platforms.",
						icon: <MessageSquareIcon className="size-6" />,
					},
					{
						title: "Channel routing",
						description:
							"Route different monitors to different channels. Critical services to #alerts, others to #monitoring.",
						icon: <FilterIcon className="size-6" />,
					},
					{
						title: "Team mentions",
						description:
							"Tag specific users or groups when incidents occur. Ensure the right people see critical alerts.",
						icon: <UsersIcon className="size-6" />,
					},
					{
						title: "Custom webhooks",
						description:
							"Beyond Slack and Discord, send alerts to any webhook endpoint for custom integrations.",
						icon: <WebhookIcon className="size-6" />,
					},
					{
						title: "Flexible configuration",
						description:
							"Configure when to send alerts: on failure only, on recovery, or for every check.",
						icon: <SettingsIcon className="size-6" />,
					},
				]}
			/>

			<LandingHowItWorks
				title="Connect in seconds"
				description="Set up Slack or Discord notifications in just a few clicks."
				steps={[
					{
						title: "Add integration",
						description:
							"Click 'Add Integration' and choose Slack or Discord. Authorize the connection.",
					},
					{
						title: "Choose channels",
						description: "Select which channels should receive alerts. Configure routing rules.",
					},
					{
						title: "Start receiving alerts",
						description:
							"That's it! You'll get instant notifications when monitors fail or recover.",
					},
				]}
			/>

			<LandingFAQ
				title="Frequently asked questions"
				description="Common questions about Slack and Discord integrations."
				items={[
					{
						question: "How do I connect Slack?",
						answer:
							"Click 'Add to Slack' and authorize the app. Then select which channels should receive notifications.",
					},
					{
						question: "How do I connect Discord?",
						answer:
							"Create a webhook in your Discord server settings, then paste the URL into your integration settings.",
					},
					{
						question: "Can I send alerts to multiple channels?",
						answer:
							"Yes, create multiple integration instances or use routing rules to direct alerts to different channels.",
					},
					{
						question: "What information is included in alerts?",
						answer:
							"Monitor name, URL, status code, response time, region, and error details when applicable.",
					},
					{
						question: "Can I customize the message format?",
						answer:
							"Alert messages are pre-formatted for clarity, but you can choose which events trigger notifications.",
					},
					{
						question: "Are there rate limits?",
						answer:
							"We respect Slack and Discord rate limits. Alerts are batched if many monitors fail simultaneously.",
					},
				]}
			/>

			<LandingFinalCTA
				isSignedIn={isSignedIn}
				title="Connect your team's tools"
				description="Set up Slack or Discord alerts in under a minute. Never miss an incident again."
			/>
		</>
	);
}
