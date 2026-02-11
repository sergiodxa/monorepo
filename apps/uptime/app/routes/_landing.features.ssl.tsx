import {
	AlertTriangleIcon,
	CalendarIcon,
	CheckCircleIcon,
	ClockIcon,
	KeyIcon,
	LinkIcon,
	ShieldCheckIcon,
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

import type { Route } from "./+types/_landing.features.ssl";
import type { loader as landingLoader } from "./_landing";

export const meta: Route.MetaFunction = ({ data }) => data?.meta ?? [];

export async function loader({ request, context }: Route.LoaderArgs) {
	let { t } = i18next(context);

	return {
		meta: generateMeta({
			title: t("landing.features.ssl.meta.title"),
			description: t("landing.features.ssl.meta.description"),
			url: request.url,
			jsonLd: getSoftwareApplicationSchema({
				name: "Uptime SSL Certificate Monitoring",
				description:
					"Never let SSL certificates expire unexpectedly. Get alerts before expiration, monitor certificate health, and prevent security warnings.",
			}),
		}),
	};
}

export default function FeaturesSSLPage() {
	let parentData = useRouteLoaderData<typeof landingLoader>("routes/_landing");
	let isSignedIn = parentData?.isSignedIn ?? false;

	return (
		<>
			<LandingHero
				isSignedIn={isSignedIn}
				badge="SSL Monitoring"
				title={
					<>
						Never let certificates expire{" "}
						<strong className="text-primary-600 dark:text-primary-400">unexpectedly</strong>
					</>
				}
				description="Monitor SSL certificates for expiration, misconfigurations, and security issues. Get alerts days before problems occur."
				highlights={["Expiration alerts", "Chain validation", "Security checks"]}
			/>

			<LandingTrustIndicators
				indicators={[
					{
						icon: <CalendarIcon className="size-6" />,
						value: "30 days",
						label: "Early Warning",
					},
					{
						icon: <LinkIcon className="size-6" />,
						value: "Chain",
						label: "Validation",
					},
					{
						icon: <ShieldCheckIcon className="size-6" />,
						value: "Security",
						label: "Checks",
					},
					{
						icon: <ClockIcon className="size-6" />,
						value: "24/7",
						label: "Monitoring",
					},
				]}
			/>

			<LandingFeatures
				badge="Deep Dive"
				title="Complete SSL certificate monitoring"
				description="Comprehensive monitoring to prevent SSL-related outages and security issues."
				features={[
					{
						title: "Expiration warnings",
						description:
							"Get alerts 30, 14, 7, and 1 day before expiration. Never be caught off guard.",
						icon: <CalendarIcon className="size-6" />,
					},
					{
						title: "Certificate chain validation",
						description:
							"Verify the complete certificate chain. Detect missing intermediates and root issues.",
						icon: <LinkIcon className="size-6" />,
					},
					{
						title: "Domain matching",
						description:
							"Ensure certificates match your domains. Catch misconfigurations before browsers do.",
						icon: <CheckCircleIcon className="size-6" />,
					},
					{
						title: "Security assessment",
						description:
							"Check for weak algorithms, key sizes, and known vulnerabilities in certificates.",
						icon: <ShieldCheckIcon className="size-6" />,
					},
					{
						title: "Certificate changes",
						description:
							"Get notified when certificates are renewed or replaced. Track certificate history.",
						icon: <KeyIcon className="size-6" />,
					},
					{
						title: "Mixed content detection",
						description:
							"Identify pages loading insecure content. Prevent browser security warnings.",
						icon: <AlertTriangleIcon className="size-6" />,
					},
				]}
			/>

			<LandingHowItWorks
				title="Set up SSL monitoring"
				description="Monitor your SSL certificates in three simple steps."
				steps={[
					{
						title: "Add your domains",
						description:
							"Enter the domains you want to monitor. We'll fetch current certificate details.",
					},
					{
						title: "Configure alerts",
						description:
							"Set when you want expiration warnings: 30 days, 14 days, 7 days, or custom.",
					},
					{
						title: "Stay protected",
						description:
							"We check certificates daily. You'll know about issues with time to fix them.",
					},
				]}
			/>

			<LandingFAQ
				title="Frequently asked questions"
				description="Common questions about SSL certificate monitoring."
				items={[
					{
						question: "How far in advance do I get expiration warnings?",
						answer:
							"By default, we alert at 30, 14, 7, and 1 day before expiration. You can customize these thresholds.",
					},
					{
						question: "What certificate issues do you detect?",
						answer:
							"Expiration, chain issues, domain mismatches, weak algorithms, revoked certificates, and more.",
					},
					{
						question: "Do you monitor wildcard certificates?",
						answer:
							"Yes, we monitor wildcard certificates and verify they properly cover your subdomains.",
					},
					{
						question: "Can I monitor internal certificates?",
						answer:
							"SSL monitoring works with publicly accessible domains. Internal certificates require network access.",
					},
					{
						question: "How often are certificates checked?",
						answer:
							"SSL certificates are checked daily by default. Critical issues trigger immediate alerts.",
					},
					{
						question: "Do you support Let's Encrypt certificates?",
						answer:
							"Yes, we monitor all certificate types including Let's Encrypt, commercial CAs, and self-signed.",
					},
				]}
			/>

			<LandingFinalCTA
				isSignedIn={isSignedIn}
				title="Stop certificate emergencies"
				description="Monitor your SSL certificates and get alerts before expiration. Setup in seconds."
			/>
		</>
	);
}
