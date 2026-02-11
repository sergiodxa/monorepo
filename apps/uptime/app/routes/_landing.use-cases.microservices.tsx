import { ActivityIcon, BoxesIcon, NetworkIcon, ZapIcon } from "lucide-react";
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

import type { Route } from "./+types/_landing.use-cases.microservices";
import type { loader as landingLoader } from "./_landing";

export const meta: Route.MetaFunction = ({ data }) => data?.meta ?? [];

export async function loader({ request, context }: Route.LoaderArgs) {
	let { t } = i18next(context);

	return {
		meta: generateMeta({
			title: t("landing.useCases.microservices.meta.title"),
			description: t("landing.useCases.microservices.meta.description"),
			url: request.url,
		}),
	};
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

export default function MicroservicesPage() {
	let parentData = useRouteLoaderData<typeof landingLoader>("routes/_landing");
	let isSignedIn = parentData?.isSignedIn ?? false;

	return (
		<>
			<LandingHero
				isSignedIn={isSignedIn}
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
				isSignedIn={isSignedIn}
				title="Monitor your entire microservices stack"
				description="Get visibility into every service. Catch failures before they cascade."
			/>
		</>
	);
}
