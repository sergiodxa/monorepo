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

import type { Route } from "./+types/use-cases.saas";

export function meta(): Route.MetaDescriptors {
	return [
		{ title: "SaaS Monitoring | Uptime for SaaS Applications" },
		{
			name: "description",
			content:
				"Monitor your SaaS application's critical paths. Dashboard, API, authentication, billing—ensure everything works for customers.",
		},
	];
}

export async function loader() {
	let session = getSession();
	return { isSignedIn: session.has("id") };
}

export default function UseCasesSaasPage({ loaderData }: Route.ComponentProps) {
	let { isSignedIn } = loaderData;

	return (
		<div className="min-h-screen bg-white dark:bg-neutral-950">
			<LandingHeader isSignedIn={isSignedIn} />

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
							"Public monitors feature is coming. Use webhooks to build custom status pages for now.",
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

			<LandingFooter />
		</div>
	);
}
