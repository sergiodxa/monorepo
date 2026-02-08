import { ActivityIcon, BoxesIcon, NetworkIcon, ZapIcon } from "lucide-react";

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

import type { Route } from "./+types/use-cases.microservices";

export function meta(): Route.MetaDescriptors {
	return [
		{ title: "Microservices Monitoring | Distributed System Health" },
		{
			name: "description",
			content:
				"Monitor every microservice in your stack. Individual health tracking, per-service alerts, unlimited services.",
		},
	];
}

export function loader() {
	let session = getSession();
	return { isSignedIn: session.has("id") };
}

const trustIndicators = [
	{
		icon: <BoxesIcon className="size-6" />,
		value: "Unlimited",
		label: "Services",
	},
	{
		icon: <NetworkIcon className="size-6" />,
		value: "Distributed",
		label: "Architecture",
	},
	{
		icon: <ActivityIcon className="size-6" />,
		value: "Per-Service",
		label: "Health",
	},
	{
		icon: <ZapIcon className="size-6" />,
		value: "Fast",
		label: "Detection",
	},
];

const features = [
	{
		title: "Per-service monitoring",
		description: "Create a dedicated monitor for each microservice in your architecture.",
		icon: <BoxesIcon className="size-6" />,
	},
	{
		title: "Independent health tracking",
		description: "Track uptime and response time independently for each service.",
		icon: <ActivityIcon className="size-6" />,
	},
	{
		title: "Service naming",
		description: "Use consistent naming: user-service, auth-service, payment-service.",
		icon: <NetworkIcon className="size-6" />,
	},
	{
		title: "Dependency awareness",
		description: "Monitor services that depend on each other. Identify cascade failures.",
		icon: <ZapIcon className="size-6" />,
	},
	{
		title: "Team routing",
		description: "Route alerts to the team responsible for each microservice.",
		icon: <BoxesIcon className="size-6" />,
	},
	{
		title: "Unlimited services",
		description: "Monitor as many microservices as you have. Usage-based pricing scales with you.",
		icon: <NetworkIcon className="size-6" />,
	},
];

const howItWorksSteps = [
	{
		title: "Inventory your services",
		description: "List all microservices and their health endpoints.",
	},
	{
		title: "Create monitors",
		description: "Add a monitor for each service with consistent naming.",
	},
	{
		title: "Configure alerts",
		description: "Route failures to the team responsible for each service.",
	},
];

const faqItems = [
	{
		question: "How many microservices can I monitor?",
		answer: "Unlimited. Create as many monitors as you have services.",
	},
	{
		question: "How do I organize many monitors?",
		answer: "Use consistent naming: auth-service-prod, auth-service-staging, etc.",
	},
	{
		question: "Can I monitor internal services?",
		answer:
			"Only publicly accessible endpoints. Expose health endpoints through your gateway if needed.",
	},
	{
		question: "What about service mesh integration?",
		answer: "Monitor the external-facing endpoints. Internal mesh health is handled by your mesh.",
	},
	{
		question: "How do I identify cascade failures?",
		answer: "When multiple related monitors fail, investigate the common dependency.",
	},
	{
		question: "What intervals should I use?",
		answer: "1-5 minutes for critical services. Less frequent for supporting services.",
	},
];

export default function MicroservicesPage({ loaderData }: Route.ComponentProps) {
	return (
		<div className="min-h-screen bg-white dark:bg-neutral-950">
			<LandingHeader isSignedIn={loaderData.isSignedIn} />

			<main>
				<LandingHero
					isSignedIn={loaderData.isSignedIn}
					badge="Microservices"
					title={
						<>
							Monitor{" "}
							<strong className="text-primary-600 dark:text-primary-400">every service</strong> in
							your stack
						</>
					}
					description="Individual monitors for each microservice. Track health, response times, and dependencies across your distributed system."
					highlights={["Per-service monitoring", "Distributed tracing ready", "Unlimited services"]}
				/>

				<LandingTrustIndicators indicators={trustIndicators} />

				<LandingFeatures
					title="Everything you need for microservices monitoring"
					description="Monitor your entire distributed architecture with dedicated tracking for each service."
					features={features}
				/>

				<LandingHowItWorks
					title="Get started in minutes"
					description="Set up monitoring for your microservices quickly."
					steps={howItWorksSteps}
				/>

				<LandingFAQ
					title="Frequently asked questions"
					description="Common questions about microservices monitoring."
					items={faqItems}
				/>

				<LandingFinalCTA
					isSignedIn={loaderData.isSignedIn}
					title="Monitor your entire microservices stack"
					description="Get visibility into every service. Catch failures before they cascade."
				/>
			</main>

			<LandingFooter />
		</div>
	);
}
