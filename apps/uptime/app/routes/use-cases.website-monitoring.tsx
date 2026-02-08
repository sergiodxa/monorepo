import {
	BellIcon,
	ClockIcon,
	GaugeIcon,
	GlobeIcon,
	HistoryIcon,
	MapIcon,
	ShoppingCartIcon,
	ZapIcon,
} from "lucide-react";

import {
	LandingFAQ,
	LandingFeatures,
	LandingFinalCTA,
	LandingFooter,
	LandingHeader,
	LandingHero,
	LandingHowItWorks,
	LandingTrustIndicators,
} from "~/components/landing";
import { getSession } from "~/middleware/session";

import type { Route } from "./+types/use-cases.website-monitoring";

export function meta(): Route.MetaDescriptors {
	return [
		{ title: "Website Monitoring | Uptime for Websites" },
		{
			name: "description",
			content:
				"Monitor your landing pages, e-commerce sites, and web apps. Instant alerts when your website goes down.",
		},
	];
}

export function loader() {
	let session = getSession();
	return { isSignedIn: session.has("id") };
}

export default function WebsiteMonitoringPage({ loaderData }: Route.ComponentProps) {
	return (
		<div className="min-h-screen bg-white dark:bg-neutral-950">
			<LandingHeader isSignedIn={loaderData.isSignedIn} />

			<LandingHero
				isSignedIn={loaderData.isSignedIn}
				badge="Website Monitoring"
				title={
					<>
						Never miss a{" "}
						<strong className="text-primary-600 dark:text-primary-400">website outage</strong>
					</>
				}
				description="Monitor your landing pages, e-commerce sites, and web applications. Get instant alerts when your website goes down."
				highlights={["Any website URL", "Instant downtime alerts", "Global monitoring"]}
			/>

			<LandingTrustIndicators
				indicators={[
					{ icon: <GlobeIcon className="size-6" />, value: "Any", label: "Website" },
					{ icon: <BellIcon className="size-6" />, value: "<1s", label: "Alerts" },
					{ icon: <MapIcon className="size-6" />, value: "9", label: "Regions" },
					{ icon: <ClockIcon className="size-6" />, value: "1min", label: "Min Interval" },
				]}
			/>

			<LandingFeatures
				title="Everything you need for website monitoring"
				description="Keep your websites online and fast with comprehensive monitoring tools."
				features={[
					{
						title: "Landing page monitoring",
						description: "Ensure your marketing pages are always available to capture leads.",
						icon: <GlobeIcon className="size-6" />,
					},
					{
						title: "E-commerce uptime",
						description: "Monitor your store. Every minute of downtime is lost revenue.",
						icon: <ShoppingCartIcon className="size-6" />,
					},
					{
						title: "Global checking",
						description: "Test from 9 regions. Catch regional outages before users report them.",
						icon: <MapIcon className="size-6" />,
					},
					{
						title: "Instant alerts",
						description: "Know within seconds when your site goes down. Fix it fast.",
						icon: <ZapIcon className="size-6" />,
					},
					{
						title: "Historical trends",
						description: "Track uptime over 365 days. Prove reliability to stakeholders.",
						icon: <HistoryIcon className="size-6" />,
					},
					{
						title: "Response time tracking",
						description: "Monitor page load times. Catch slowdowns before they become outages.",
						icon: <GaugeIcon className="size-6" />,
					},
				]}
			/>

			<LandingHowItWorks
				title="Start monitoring in minutes"
				description="Get your website monitored in three simple steps."
				steps={[
					{
						title: "Enter your URL",
						description: "Add your website's homepage, landing pages, or critical paths.",
					},
					{
						title: "Set check frequency",
						description: "Choose 1-60 minute intervals based on criticality.",
					},
					{
						title: "Get alerts",
						description: "Receive email or webhook notifications when downtime is detected.",
					},
				]}
			/>

			<LandingFAQ
				title="Frequently asked questions"
				description="Everything you need to know about website monitoring."
				items={[
					{
						question: "What URLs should I monitor?",
						answer:
							"Start with your homepage and key landing pages. Add checkout flows for e-commerce.",
					},
					{
						question: "How often should I check?",
						answer: "Every 1-5 minutes for critical pages. 10-30 minutes for less important pages.",
					},
					{
						question: "Can I monitor HTTPS?",
						answer: "Yes, we support both HTTP and HTTPS URLs.",
					},
					{
						question: "What about dynamic pages?",
						answer:
							"We check if the server responds with the expected status code. Dynamic content works fine.",
					},
					{
						question: "Can I monitor password-protected pages?",
						answer: "Yes, add HTTP Basic Auth headers or session cookies if needed.",
					},
					{
						question: "How do I know which region to use?",
						answer: "Monitor from the region closest to your primary user base.",
					},
				]}
			/>

			<LandingFinalCTA
				isSignedIn={loaderData.isSignedIn}
				title="Keep your website online"
				description="Start monitoring your website in under 2 minutes. Get instant downtime alerts."
			/>

			<LandingFooter />
		</div>
	);
}
