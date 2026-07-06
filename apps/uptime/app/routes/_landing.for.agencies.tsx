/**
 * Marketing landing page for the "For Agencies" audience segment. Its loader
 * builds localized SEO meta, and the component composes the shared landing
 * sections (hero, trust indicators, features, how-it-works, FAQ, final CTA) with
 * agency-focused copy about monitoring many client sites from one dashboard.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import {
	BellIcon,
	BuildingIcon,
	DollarSignIcon,
	GlobeIcon,
	LayoutIcon,
	MonitorIcon,
	RouteIcon,
	ShieldCheckIcon,
	TerminalIcon,
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
import { generateMeta } from "~/lib/seo";
import { i18next } from "~/middleware/i18next";

import type { Route } from "./+types/_landing.for.agencies";
import type { loader as landingLoader } from "./_landing";

export const meta: Route.MetaFunction = ({ data }) => data?.meta ?? [];

export async function loader({ request, context }: Route.LoaderArgs) {
	let { t } = i18next(context);

	return {
		meta: generateMeta({
			title: t("landing.for.agencies.meta.title"),
			description: t("landing.for.agencies.meta.description"),
			url: request.url,
		}),
	};
}

export default function ForAgenciesPage() {
	let parentData = useRouteLoaderData<typeof landingLoader>("routes/_landing");
	let isSignedIn = parentData?.isSignedIn ?? false;

	return (
		<>
			<LandingHero
				isSignedIn={isSignedIn}
				badge="For Agencies"
				title={
					<>
						Keep <strong className="text-primary-600 dark:text-primary-400">every client's</strong>{" "}
						site running
					</>
				}
				description="Monitor all your client websites and applications from one dashboard. Proactive monitoring means happier clients."
				highlights={["Unlimited monitors", "Team access", "Client-friendly reports"]}
			/>

			<LandingTrustIndicators
				indicators={[
					{
						icon: <BuildingIcon className="size-6" />,
						value: "Multi-team",
						label: "Support",
					},
					{
						icon: <MonitorIcon className="size-6" />,
						value: "Unlimited",
						label: "Monitors",
					},
					{
						icon: <BellIcon className="size-6" />,
						value: "<1s",
						label: "Alerts",
					},
					{
						icon: <GlobeIcon className="size-6" />,
						value: "9",
						label: "Regions",
					},
				]}
			/>

			<LandingFeatures
				title="Built for agencies"
				description="Everything you need to monitor all your clients without the complexity."
				features={[
					{
						icon: <UsersIcon className="size-6" />,
						title: "Multi-client management",
						description: "Create separate teams for each client or manage everything in one place.",
					},
					{
						icon: <ShieldCheckIcon className="size-6" />,
						title: "Proactive monitoring",
						description: "Catch issues before clients notice. Be the hero who prevents downtime.",
					},
					{
						icon: <RouteIcon className="size-6" />,
						title: "Flexible alerting",
						description: "Route alerts to the right team members based on client or project.",
					},
					{
						icon: <DollarSignIcon className="size-6" />,
						title: "Usage-based pricing",
						description: "Pay only for actual monitoring. Scale up or down with your client base.",
					},
					{
						icon: <LayoutIcon className="size-6" />,
						title: "Status pages",
						description:
							"Create status pages for each client. Share uptime reports and build trust.",
					},
					{
						icon: <TerminalIcon className="size-6" />,
						title: "API access",
						description:
							"Automate monitor creation via API. Integrate with your client onboarding workflow.",
					},
				]}
			/>

			<LandingHowItWorks
				title="Up and running in minutes"
				description="Start monitoring your clients in three simple steps."
				steps={[
					{
						title: "Organize by client",
						description:
							"Create teams for each client or use naming conventions to organize monitors.",
					},
					{
						title: "Set up monitors",
						description: "Add all client endpoints. Configure appropriate check intervals.",
					},
					{
						title: "Stay proactive",
						description: "Get alerts instantly. Fix issues before clients even notice.",
					},
				]}
			/>

			<LandingFAQ
				title="Common questions"
				description="Answers to questions agencies frequently ask."
				items={[
					{
						question: "Can I have separate dashboards per client?",
						answer:
							"Yes! Create separate teams for each client. Team members only see their assigned monitors.",
					},
					{
						question: "How do I bill clients for monitoring?",
						answer:
							"You pay one bill based on total pings. Pass through costs to clients as you see fit.",
					},
					{
						question: "Can clients access their own data?",
						answer:
							"Invite clients as team members to give them read-only access to their monitors.",
					},
					{
						question: "What if a client churns?",
						answer: "Simply delete their monitors or pause them. No long-term commitments.",
					},
					{
						question: "Is there white-labeling?",
						answer:
							"Not currently, but it's on our roadmap. You can use webhooks to build custom dashboards.",
					},
					{
						question: "Do you offer agency discounts?",
						answer: "Our usage-based pricing naturally scales. High-volume users get great value.",
					},
				]}
			/>

			<LandingFinalCTA
				isSignedIn={isSignedIn}
				title="Deliver better uptime for every client"
				description="Join agencies that use proactive monitoring to keep clients happy."
			/>
		</>
	);
}
