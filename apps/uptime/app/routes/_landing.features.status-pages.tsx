import {
	BellIcon,
	CheckCircleIcon,
	EyeIcon,
	GlobeIcon,
	LayoutIcon,
	PaletteIcon,
	TrendingUpIcon,
	UsersIcon,
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
		{ title: "Status Pages | Uptime Monitors" },
		{
			name: "description",
			content:
				"Beautiful, customizable status pages to keep your users informed. Public or private pages with real-time updates and incident history.",
		},
	];
}

export default function FeaturesStatusPagesPage() {
	let parentData = useRouteLoaderData<typeof landingLoader>("routes/_landing");
	let isSignedIn = parentData?.isSignedIn ?? false;

	return (
		<>
			<LandingHero
				isSignedIn={isSignedIn}
				badge="Status Pages"
				title={
					<>
						Keep your users informed with{" "}
						<strong className="text-primary-600 dark:text-primary-400">
							beautiful status pages
						</strong>
					</>
				}
				description="Professional status pages that automatically reflect your service health. Reduce support tickets and build trust with transparent communication."
				highlights={["Custom branding", "Real-time updates", "Incident history"]}
			/>

			<LandingTrustIndicators
				indicators={[
					{
						icon: <GlobeIcon className="size-6" />,
						value: "Public",
						label: "Status Pages",
					},
					{
						icon: <PaletteIcon className="size-6" />,
						value: "Custom",
						label: "Branding",
					},
					{
						icon: <TrendingUpIcon className="size-6" />,
						value: "Real-time",
						label: "Updates",
					},
					{
						icon: <EyeIcon className="size-6" />,
						value: "24/7",
						label: "Visibility",
					},
				]}
			/>

			<LandingFeatures
				badge="Deep Dive"
				title="Everything you need for transparent status communication"
				description="Professional status pages that build trust and reduce support burden."
				features={[
					{
						title: "Custom branding",
						description:
							"Add your logo, colors, and custom domain to match your brand identity perfectly.",
						icon: <PaletteIcon className="size-6" />,
					},
					{
						title: "Real-time status",
						description:
							"Status pages update automatically based on your monitor health. No manual updates needed.",
						icon: <TrendingUpIcon className="size-6" />,
					},
					{
						title: "Incident management",
						description:
							"Post updates during outages. Keep users informed with timeline of events and resolution status.",
						icon: <BellIcon className="size-6" />,
					},
					{
						title: "Component grouping",
						description:
							"Organize services into logical groups. Show users exactly which parts of your system are affected.",
						icon: <LayoutIcon className="size-6" />,
					},
					{
						title: "Uptime history",
						description:
							"Display historical uptime data. Build confidence with transparent reliability metrics.",
						icon: <CheckCircleIcon className="size-6" />,
					},
					{
						title: "Subscriber notifications",
						description:
							"Let users subscribe to updates. Automatically notify them when incidents occur or resolve.",
						icon: <UsersIcon className="size-6" />,
					},
				]}
			/>

			<LandingHowItWorks
				title="Launch your status page in minutes"
				description="Get a professional status page up and running in three simple steps."
				steps={[
					{
						title: "Create your page",
						description:
							"Choose a subdomain or connect your custom domain. Add your branding elements.",
					},
					{
						title: "Add components",
						description:
							"Select which monitors to display and organize them into logical service groups.",
					},
					{
						title: "Go live",
						description: "Publish your status page. Share the URL with customers and stakeholders.",
					},
				]}
			/>

			<LandingFAQ
				title="Frequently asked questions"
				description="Common questions about status pages."
				items={[
					{
						question: "Can I use my own domain?",
						answer:
							"Yes, connect any custom domain like status.yourdomain.com. We handle SSL certificates automatically.",
					},
					{
						question: "Do status pages update automatically?",
						answer:
							"Yes, component status reflects your monitor health in real-time. No manual intervention required.",
					},
					{
						question: "Can I post manual incident updates?",
						answer:
							"Absolutely. Create incidents with updates, set status (investigating, identified, monitoring, resolved), and notify subscribers.",
					},
					{
						question: "Can users subscribe to updates?",
						answer:
							"Yes, visitors can subscribe via email to receive notifications about incidents and maintenance.",
					},
					{
						question: "Can I make my status page private?",
						answer:
							"Yes, you can password-protect your status page or restrict access to specific users.",
					},
					{
						question: "What uptime metrics are displayed?",
						answer:
							"Show daily, weekly, and monthly uptime percentages along with response time graphs.",
					},
				]}
			/>

			<LandingFinalCTA
				isSignedIn={isSignedIn}
				title="Launch your status page today"
				description="Build trust with transparent communication. Set up your status page in under 5 minutes."
			/>
		</>
	);
}
