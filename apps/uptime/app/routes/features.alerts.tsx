import { BellIcon, MailIcon, RouteIcon, ShieldCheckIcon, WebhookIcon, ZapIcon } from "lucide-react";

import { LandingFAQ } from "~/components/landing/faq";
import { LandingFeatures } from "~/components/landing/features";
import { LandingFinalCTA } from "~/components/landing/final-cta";
import { LandingFooter } from "~/components/landing/footer";
import { LandingHeader } from "~/components/landing/header";
import { LandingHero } from "~/components/landing/hero";
import { LandingHowItWorks } from "~/components/landing/how-it-works";
import { LandingTrustIndicators } from "~/components/landing/trust-indicators";
import { getSession } from "~/middleware/session";

import type { Route } from "./+types/features.alerts";

export function meta(): Route.MetaDescriptors {
	return [
		{ title: "Uptime Alerts | Email & Webhook Notifications" },
		{
			name: "description",
			content:
				"Instant email and webhook alerts for downtime detection. Under 1 second delivery. Integrates with Slack, Discord, PagerDuty, and more.",
		},
	];
}

export async function loader() {
	let session = getSession();
	return { isSignedIn: session.has("id") };
}

export default function FeaturesAlertsPage({ loaderData }: Route.ComponentProps) {
	let { isSignedIn } = loaderData;

	return (
		<div className="min-h-screen bg-white dark:bg-neutral-950">
			<LandingHeader isSignedIn={isSignedIn} />

			<main>
				<LandingHero
					isSignedIn={isSignedIn}
					badge="Alerts"
					title={
						<>
							Get notified{" "}
							<strong className="text-primary-600 dark:text-primary-400">the moment</strong>{" "}
							something breaks
						</>
					}
					description="Email and webhook alerts delivered in under 1 second. Never miss an outage again."
					highlights={["<1s delivery", "Email & webhooks", "Up to 10 alerts"]}
				/>

				<LandingTrustIndicators
					indicators={[
						{
							icon: <ZapIcon className="size-6" />,
							value: "<1s",
							label: "Alert Latency",
						},
						{
							icon: <MailIcon className="size-6" />,
							value: "Email",
							label: "Notifications",
						},
						{
							icon: <WebhookIcon className="size-6" />,
							value: "Webhooks",
							label: "Integrations",
						},
						{
							icon: <BellIcon className="size-6" />,
							value: "10",
							label: "Alerts/Team",
						},
					]}
				/>

				<LandingFeatures
					title="Instant alerts, your way"
					description="Get notified through your preferred channels the moment something goes wrong."
					features={[
						{
							title: "Email alerts",
							description:
								"Receive alerts directly in your inbox with customizable subject prefixes for easy filtering.",
							icon: <MailIcon className="size-6" />,
						},
						{
							title: "Webhook alerts",
							description:
								"Send alerts to any URL—Slack, Discord, PagerDuty, or your custom endpoint.",
							icon: <WebhookIcon className="size-6" />,
						},
						{
							title: "Secure webhooks",
							description: "Optional HMAC SHA256 signatures for webhook payload verification.",
							icon: <ShieldCheckIcon className="size-6" />,
						},
						{
							title: "Instant delivery",
							description: "Alerts are sent within seconds of detecting an outage.",
							icon: <ZapIcon className="size-6" />,
						},
						{
							title: "Multiple channels",
							description:
								"Create up to 10 alert configurations per team for different notification needs.",
							icon: <BellIcon className="size-6" />,
						},
						{
							title: "Custom routing",
							description:
								"Route different monitors to different alert channels based on severity or team.",
							icon: <RouteIcon className="size-6" />,
						},
					]}
				/>

				<LandingHowItWorks
					title="Set up alerts in minutes"
					description="Configure your notification preferences and start receiving alerts instantly."
					steps={[
						{
							title: "Choose your channel",
							description: "Select email or webhook for your alert delivery method.",
						},
						{
							title: "Configure settings",
							description: "Add email addresses or webhook URLs. Set optional prefixes or secrets.",
						},
						{
							title: "Receive alerts",
							description: "Get instant notifications when monitors detect failures.",
						},
					]}
				/>

				<LandingFAQ
					title="Common questions"
					description="Everything you need to know about Uptime alerts."
					items={[
						{
							question: "How fast are alerts delivered?",
							answer:
								"Within seconds of a failed health check. Email delivery depends on your provider.",
						},
						{
							question: "Can I alert multiple people?",
							answer:
								"Create multiple alert configurations, each with different email addresses or webhook URLs.",
						},
						{
							question: "How do webhook alerts work?",
							answer:
								"We POST a JSON payload to your URL containing monitor details and failure information.",
						},
						{
							question: "Can I verify webhook authenticity?",
							answer:
								"Yes, add a secret and we'll include an HMAC SHA256 signature in the headers.",
						},
						{
							question: "What integrations are supported?",
							answer:
								"Any service that accepts webhooks: Slack, Discord, PagerDuty, OpsGenie, Telegram bots, etc.",
						},
						{
							question: "Will I get alert spam?",
							answer:
								"Alerts are sent on status changes, not every failed check. You won't be flooded.",
						},
					]}
				/>

				<LandingFinalCTA
					isSignedIn={isSignedIn}
					title="Never miss an outage"
					description="Set up alerts in minutes. Get notified instantly when your services go down."
				/>
			</main>

			<LandingFooter />
		</div>
	);
}
