/**
 * Marketing feature route for the DNS monitoring landing page. It composes the
 * shared hero, trust indicators, feature grid, how-it-works steps, and FAQ with
 * copy about monitoring A, AAAA, CNAME, MX, TXT, and NS records and detecting
 * hijacking. It exists as an SEO page promoting the DNS monitoring capability.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import {
	ClockIcon,
	DatabaseIcon,
	GlobeIcon,
	LayersIcon,
	RefreshCwIcon,
	ServerIcon,
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

import type { Route } from "./+types/_landing.features.dns";
import type { loader as landingLoader } from "./_landing";

export const meta: Route.MetaFunction = ({ loaderData }) => loaderData?.meta ?? [];

export async function loader({ request, context }: Route.LoaderArgs) {
	let { t } = i18next(context);

	return {
		meta: generateMeta({
			title: t("landing.features.dns.meta.title"),
			description: t("landing.features.dns.meta.description"),
			url: request.url,
			jsonLd: getSoftwareApplicationSchema({
				name: "Uptime DNS Monitoring",
				description:
					"Monitor DNS records for unexpected changes. Get alerted when A, AAAA, CNAME, MX, TXT, or NS records change. Detect DNS hijacking early.",
			}),
		}),
	};
}

export default function FeaturesDNSPage() {
	let parentData = useRouteLoaderData<typeof landingLoader>("routes/_landing");
	let isSignedIn = parentData?.isSignedIn ?? false;

	return (
		<>
			<LandingHero
				isSignedIn={isSignedIn}
				badge="DNS Monitoring"
				title={
					<>
						Detect DNS changes{" "}
						<strong className="text-primary-600 dark:text-primary-400">
							before they cause outages
						</strong>
					</>
				}
				description="Monitor your DNS records for unexpected changes. Get alerted when records are modified, deleted, or hijacked."
				highlights={["All record types", "Change detection", "Hijacking alerts"]}
			/>

			<LandingTrustIndicators
				indicators={[
					{
						icon: <GlobeIcon className="size-6" />,
						value: "A/AAAA",
						label: "Records",
					},
					{
						icon: <ServerIcon className="size-6" />,
						value: "CNAME",
						label: "Records",
					},
					{
						icon: <LayersIcon className="size-6" />,
						value: "MX/TXT",
						label: "Records",
					},
					{
						icon: <ShieldCheckIcon className="size-6" />,
						value: "Hijack",
						label: "Detection",
					},
				]}
			/>

			<LandingFeatures
				badge="Deep Dive"
				title="Complete DNS monitoring coverage"
				description="Monitor all critical DNS record types and detect unauthorized changes."
				features={[
					{
						title: "All record types",
						description:
							"Monitor A, AAAA, CNAME, MX, TXT, and NS records. Complete coverage for your domains.",
						icon: <DatabaseIcon className="size-6" />,
					},
					{
						title: "Change detection",
						description:
							"Get alerted when DNS records change from expected values. Catch misconfigurations early.",
						icon: <RefreshCwIcon className="size-6" />,
					},
					{
						title: "Hijacking protection",
						description:
							"Detect DNS hijacking attempts. Alert when records point to unexpected destinations.",
						icon: <ShieldCheckIcon className="size-6" />,
					},
					{
						title: "Propagation monitoring",
						description:
							"Track DNS propagation after changes. Know when updates have reached all resolvers.",
						icon: <GlobeIcon className="size-6" />,
					},
					{
						title: "TTL tracking",
						description:
							"Monitor TTL values for unexpected changes. Catch cache poisoning attempts.",
						icon: <ClockIcon className="size-6" />,
					},
					{
						title: "Multiple nameservers",
						description:
							"Query multiple DNS servers. Detect inconsistencies between authoritative nameservers.",
						icon: <ServerIcon className="size-6" />,
					},
				]}
			/>

			<LandingHowItWorks
				title="Set up DNS monitoring"
				description="Start monitoring your DNS records in three simple steps."
				steps={[
					{
						title: "Enter your domain",
						description: "Add the domain you want to monitor. We'll discover existing DNS records.",
					},
					{
						title: "Select record types",
						description:
							"Choose which record types to monitor: A, AAAA, CNAME, MX, TXT, NS, or all.",
					},
					{
						title: "Set expected values",
						description: "Confirm or adjust expected values. Get alerted when records deviate.",
					},
				]}
			/>

			<LandingFAQ
				title="Frequently asked questions"
				description="Common questions about DNS monitoring."
				items={[
					{
						question: "What DNS record types can I monitor?",
						answer:
							"A, AAAA, CNAME, MX, TXT, and NS records. Monitor the records that matter to your infrastructure.",
					},
					{
						question: "How does DNS hijacking detection work?",
						answer:
							"We compare current DNS responses to expected values. Any deviation triggers an alert.",
					},
					{
						question: "Can I monitor multiple domains?",
						answer:
							"Yes, add as many domains as you need. Each can have different record types monitored.",
					},
					{
						question: "How often are DNS records checked?",
						answer: "DNS checks follow your configured interval, from every minute to every hour.",
					},
					{
						question: "Which DNS servers do you query?",
						answer:
							"We query authoritative nameservers and major public resolvers like Google and Cloudflare.",
					},
					{
						question: "Can I monitor internal DNS?",
						answer:
							"DNS monitoring works with publicly accessible DNS records. Internal DNS requires network access.",
					},
				]}
			/>

			<LandingFinalCTA
				isSignedIn={isSignedIn}
				title="Protect your DNS records"
				description="Start monitoring your DNS for unauthorized changes. Setup takes under a minute."
			/>
		</>
	);
}
