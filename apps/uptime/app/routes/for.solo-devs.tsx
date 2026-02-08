import {
	ClockIcon,
	CodeIcon,
	DatabaseIcon,
	GlobeIcon,
	MousePointerClickIcon,
	DollarSignIcon,
	LayoutDashboardIcon,
	CalendarIcon,
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

import type { Route } from "./+types/for.solo-devs";

export function meta(): Route.MetaDescriptors {
	return [
		{ title: "Uptime for Solo Developers | Free Monitoring" },
		{
			name: "description",
			content:
				"Professional uptime monitoring for solo developers. Start free, upgrade when ready. Perfect for portfolios and side projects.",
		},
	];
}

export async function loader() {
	let session = getSession();
	return { isSignedIn: session.has("id") };
}

export default function ForSoloDevs({ loaderData }: Route.ComponentProps) {
	return (
		<div className="min-h-screen bg-white dark:bg-neutral-950">
			<LandingHeader isSignedIn={loaderData.isSignedIn} />

			<LandingHero
				isSignedIn={loaderData.isSignedIn}
				badge="For Solo Developers"
				title={
					<>
						Your projects deserve monitoring{" "}
						<strong className="text-primary-600 dark:text-primary-400">too</strong>
					</>
				}
				description="Professional uptime monitoring without the enterprise price tag. Perfect for portfolios, side projects, and freelance work."
				highlights={["Free tier available", "No credit card needed", "5-minute setup"]}
			/>

			<LandingTrustIndicators
				indicators={[
					{
						icon: <CodeIcon className="size-6" />,
						value: "Free",
						label: "To Start",
					},
					{
						icon: <ClockIcon className="size-6" />,
						value: "1min",
						label: "Min Interval",
					},
					{
						icon: <DatabaseIcon className="size-6" />,
						value: "365",
						label: "Days History",
					},
					{
						icon: <GlobeIcon className="size-6" />,
						value: "9",
						label: "Regions",
					},
				]}
			/>

			<LandingFeatures
				title="Built for indie developers"
				description="Everything you need to monitor your projects, nothing you don't."
				features={[
					{
						icon: <MousePointerClickIcon className="size-6" />,
						title: "Free manual checks",
						description:
							"Test your endpoints anytime without a subscription. Perfect for development.",
					},
					{
						icon: <DollarSignIcon className="size-6" />,
						title: "Affordable automation",
						description: "When you're ready for automated checks, it's just $5/month.",
					},
					{
						icon: <LayoutDashboardIcon className="size-6" />,
						title: "Simple dashboard",
						description: "No complexity. See your service health at a glance.",
					},
					{
						icon: <CalendarIcon className="size-6" />,
						title: "Historical data",
						description: "365 days of data retention to track trends over time.",
					},
				]}
			/>

			<LandingHowItWorks
				title="Get started in minutes"
				description="No complex setup. Just add your URLs and start monitoring."
				steps={[
					{
						title: "Sign up free",
						description: "Create an account with GitHub. No credit card required.",
					},
					{
						title: "Add endpoints",
						description: "Enter URLs to monitor. Test them manually for free.",
					},
					{
						title: "Upgrade when ready",
						description: "Enable automatic monitoring when you need it.",
					},
				]}
			/>

			<LandingFAQ
				title="Common questions"
				description="Everything you need to know about monitoring as a solo developer."
				items={[
					{
						question: "What can I do for free?",
						answer:
							"Create unlimited monitors and trigger checks manually anytime. Only automatic scheduled monitoring requires a subscription.",
					},
					{
						question: "Is it worth it for a single project?",
						answer:
							"Absolutely. For $5/month, you get peace of mind that your project is always up.",
					},
					{
						question: "Can I monitor localhost?",
						answer:
							"No, only publicly accessible URLs. For local development, use manual checks after deploying.",
					},
					{
						question: "How do I get alerts?",
						answer:
							"Configure email or webhook alerts. Get notified instantly when your service goes down.",
					},
					{
						question: "Can I monitor client projects?",
						answer: "Yes! Create monitors for any URL. Great for freelance contracts.",
					},
					{
						question: "What if I stop paying?",
						answer: "Your monitors pause but data is retained. Resume anytime.",
					},
				]}
			/>

			<LandingFinalCTA
				isSignedIn={loaderData.isSignedIn}
				title="Start monitoring for free"
				description="Join solo developers who keep their projects running reliably."
			/>

			<LandingFooter />
		</div>
	);
}
