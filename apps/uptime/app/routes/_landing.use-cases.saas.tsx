/**
 * Marketing landing page for the SaaS monitoring use case. Its loader builds
 * localized SEO meta, and the component composes the shared landing sections with
 * copy about monitoring a SaaS app's critical paths—dashboard, APIs, auth, and
 * billing—across environments so customer-facing reliability stays intact.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import {
	CreditCardIcon,
	KeyIcon,
	LayoutDashboardIcon,
	LayersIcon,
	ServerIcon,
	TrendingUpIcon,
	UsersIcon,
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

import type { Route } from "./+types/_landing.use-cases.saas";
import type { loader as landingLoader } from "./_landing";

export const meta: Route.MetaFunction = ({ data }) => data?.meta ?? [];

export async function loader({ request, context }: Route.LoaderArgs) {
	let { t } = i18next(context);

	return {
		meta: generateMeta({
			title: t("landing.useCases.saas.meta.title"),
			description: t("landing.useCases.saas.meta.description"),
			url: request.url,
		}),
	};
}

export default function UseCasesSaasPage() {
	let parentData = useRouteLoaderData<typeof landingLoader>("routes/_landing");
	let isSignedIn = parentData?.isSignedIn ?? false;

	return (
		<>
			<LandingHero
				isSignedIn={isSignedIn}
				badge="SaaS Monitoring"
				title={
					<>
						Keep your SaaS reliable{" "}
						<strong className="text-primary-600 dark:text-primary-400">for customers</strong>
					</>
				}
				description="Monitor your SaaS application's critical paths. Dashboard, API, authentication, and billing—ensure everything works."
				highlights={[
					"Multi-endpoint monitoring",
					"Customer-facing reliability",
					"Usage-based pricing",
				]}
			/>

			<LandingTrustIndicators
				indicators={[
					{
						icon: <LayersIcon className="size-6" />,
						value: "Multi",
						label: "Endpoint",
					},
					{
						icon: <UsersIcon className="size-6" />,
						value: "Customer",
						label: "Facing",
					},
					{
						icon: <ZapIcon className="size-6" />,
						value: "99.9%",
						label: "SLA",
					},
					{
						icon: <TrendingUpIcon className="size-6" />,
						value: "Scales",
						label: "With You",
					},
				]}
			/>

			<LandingFeatures
				title="Monitor every critical path"
				description="Comprehensive monitoring for SaaS applications"
				features={[
					{
						icon: <LayoutDashboardIcon className="size-6" />,
						title: "Dashboard monitoring",
						description: "Ensure your main app interface is always accessible to customers.",
					},
					{
						icon: <ServerIcon className="size-6" />,
						title: "API health checks",
						description: "Monitor your public and internal APIs. Keep integrations working.",
					},
					{
						icon: <KeyIcon className="size-6" />,
						title: "Auth endpoint monitoring",
						description: "Login and signup flows are critical. Monitor them closely.",
					},
					{
						icon: <CreditCardIcon className="size-6" />,
						title: "Billing system checks",
						description: "Payment endpoints must work. Monitor Stripe webhooks and checkout flows.",
					},
					{
						icon: <LayersIcon className="size-6" />,
						title: "Multi-tenant support",
						description: "Monitor different customer endpoints or environments separately.",
					},
					{
						icon: <TrendingUpIcon className="size-6" />,
						title: "Scale as you grow",
						description: "Usage-based pricing grows with your SaaS. No upfront commitments.",
					},
				]}
			/>

			<LandingHowItWorks
				title="Start monitoring your SaaS"
				description="Get comprehensive coverage in three steps"
				steps={[
					{
						title: "Map critical paths",
						description: "Identify your most important endpoints: dashboard, API, auth, billing.",
					},
					{
						title: "Create monitors",
						description: "Add a monitor for each critical path with appropriate intervals.",
					},
					{
						title: "Route alerts",
						description: "Send alerts to the right team—frontend, backend, or ops.",
					},
				]}
			/>

			<LandingFAQ
				title="SaaS monitoring FAQ"
				description="Common questions about monitoring SaaS applications"
				items={[
					{
						question: "What endpoints should I monitor for my SaaS?",
						answer:
							"Start with: main dashboard, API endpoints, login/signup, and payment/billing endpoints.",
					},
					{
						question: "How do I handle staging vs production?",
						answer:
							"Create separate monitors for each environment. Use naming conventions to organize.",
					},
					{
						question: "Can I share uptime data with customers?",
						answer:
							"Yes! Create public status pages to share your service health with customers. Add your branding and select which monitors to display.",
					},
					{
						question: "What about third-party dependencies?",
						answer: "Monitor your own endpoints. For third-party health, check their status pages.",
					},
					{
						question: "How do I monitor microservices?",
						answer:
							"Create a monitor for each service. Group them by naming convention in the dashboard.",
					},
					{
						question: "Is there an API for automation?",
						answer: "Yes, all dashboard actions are available via API.",
					},
				]}
			/>

			<LandingFinalCTA
				isSignedIn={isSignedIn}
				title="Deliver reliable SaaS"
				description="Monitor every critical path. Keep your customers happy with consistent uptime."
			/>
		</>
	);
}
