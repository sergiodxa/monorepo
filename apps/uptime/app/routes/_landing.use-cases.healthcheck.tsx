import {
	ActivityIcon,
	CheckCircleIcon,
	ContainerIcon,
	DatabaseIcon,
	HeartPulseIcon,
	RouteIcon,
	ServerIcon,
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

import type { Route } from "./+types/_landing.use-cases.healthcheck";
import type { loader as landingLoader } from "./_landing";

export const meta: Route.MetaFunction = ({ data }) => data?.meta ?? [];

export async function loader({ request, context }: Route.LoaderArgs) {
	let { t } = i18next(context);

	return {
		meta: generateMeta({
			title: t("landing.useCases.healthcheck.meta.title"),
			description: t("landing.useCases.healthcheck.meta.description"),
			url: request.url,
		}),
	};
}

const trustIndicators = [
	{
		icon: <HeartPulseIcon className="size-6" />,
		value: "/health",
		label: "Endpoints",
	},
	{
		icon: <ContainerIcon className="size-6" />,
		value: "K8s",
		label: "& Docker",
	},
	{
		icon: <CheckCircleIcon className="size-6" />,
		value: "Readiness",
		label: "Probes",
	},
	{
		icon: <ActivityIcon className="size-6" />,
		value: "Liveness",
		label: "Checks",
	},
];

const features = [
	{
		title: "Standard health endpoints",
		description: "Monitor /health, /healthz, /ready, /live, or any custom health path.",
		icon: <RouteIcon className="size-6" />,
	},
	{
		title: "Kubernetes integration",
		description: "Works alongside K8s readiness and liveness probes for external validation.",
		icon: <ContainerIcon className="size-6" />,
	},
	{
		title: "Docker health checks",
		description: "Complement HEALTHCHECK instructions with external monitoring.",
		icon: <ServerIcon className="size-6" />,
	},
	{
		title: "Status code flexibility",
		description: "Expect 200, 204, or any status code your health endpoint returns.",
		icon: <CheckCircleIcon className="size-6" />,
	},
	{
		title: "Lightweight checks",
		description: "Use HEAD requests for minimal overhead on your health endpoints.",
		icon: <ZapIcon className="size-6" />,
	},
	{
		title: "Dependency validation",
		description: "Monitor endpoints that check database, cache, and external service connectivity.",
		icon: <DatabaseIcon className="size-6" />,
	},
];

const howItWorksSteps = [
	{
		title: "Implement a health endpoint",
		description: "Add /health to your service that returns 200 when healthy.",
	},
	{
		title: "Create a monitor",
		description: "Point Uptime at your health endpoint with appropriate intervals.",
	},
	{
		title: "Get external validation",
		description: "Know when your service is unhealthy from outside your infrastructure.",
	},
];

const faqItems = [
	{
		question: "What should my health endpoint return?",
		answer: "Return 200 OK when healthy. Include dependency checks if needed. Keep it fast.",
	},
	{
		question: "How is this different from K8s probes?",
		answer:
			"K8s probes run from inside the cluster. Uptime checks from outside, catching network and DNS issues.",
	},
	{
		question: "What's a good check interval?",
		answer: "1-5 minutes for critical services. Match or exceed your K8s probe intervals.",
	},
	{
		question: "Should I check dependencies in /health?",
		answer:
			"For liveness: no, just check the service itself. For readiness: yes, check critical dependencies.",
	},
	{
		question: "Can I monitor private cluster endpoints?",
		answer: "Only if exposed externally. Consider a dedicated health endpoint for external checks.",
	},
	{
		question: "What about /healthz vs /health?",
		answer:
			"Both work. /healthz is Kubernetes convention, /health is more general. We support any path.",
	},
];

export default function HealthcheckPage() {
	let parentData = useRouteLoaderData<typeof landingLoader>("routes/_landing");
	let isSignedIn = parentData?.isSignedIn ?? false;

	return (
		<>
			<LandingHero
				isSignedIn={isSignedIn}
				badge="Health Checks"
				title={
					<>
						Monitor your <strong className="text-primary-600 dark:text-primary-400">/health</strong>{" "}
						endpoints
					</>
				}
				description="Purpose-built for Kubernetes readiness probes, Docker health checks, and standard /health endpoints."
				highlights={["Kubernetes ready", "Docker compatible", "Standard patterns"]}
			/>

			<LandingTrustIndicators indicators={trustIndicators} />

			<LandingFeatures
				title="Everything you need for health check monitoring"
				description="Monitor health endpoints with purpose-built tooling for container orchestration."
				features={features}
			/>

			<LandingHowItWorks
				title="Get started in minutes"
				description="Set up external health monitoring for your services."
				steps={howItWorksSteps}
			/>

			<LandingFAQ
				title="Frequently asked questions"
				description="Common questions about health check monitoring."
				items={faqItems}
			/>

			<LandingFinalCTA
				isSignedIn={isSignedIn}
				title="External validation for your services"
				description="Complement internal probes with external health checks. Know when your services are truly reachable."
			/>
		</>
	);
}
