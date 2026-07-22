/**
 * Marketing landing page for the "For Solo Developers" audience segment. Its
 * loader builds localized SEO meta, and the component composes the shared landing
 * sections with copy pitching professional monitoring at an indie price: free
 * manual checks, affordable automation, and simple setup for side projects.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import {
	BellOffIcon,
	CalendarIcon,
	ClockIcon,
	CodeIcon,
	DatabaseIcon,
	DollarSignIcon,
	GlobeIcon,
	LayoutDashboardIcon,
	MousePointerClickIcon,
	TerminalIcon,
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

import type { Route } from "./+types/_landing.for.solo-devs";
import type { loader as landingLoader } from "./_landing";

export const meta: Route.MetaFunction = ({ loaderData }) => loaderData?.meta ?? [];

export async function loader({ request, context }: Route.LoaderArgs) {
	let { t } = i18next(context);

	return {
		meta: generateMeta({
			title: t("landing.for.soloDevs.meta.title"),
			description: t("landing.for.soloDevs.meta.description"),
			url: request.url,
		}),
	};
}

export default function ForSoloDevs() {
	let parentData = useRouteLoaderData<typeof landingLoader>("routes/_landing");
	let isSignedIn = parentData?.isSignedIn ?? false;

	return (
		<>
			<LandingHero
				isSignedIn={isSignedIn}
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
					{
						icon: <TerminalIcon className="size-6" />,
						title: "API access",
						description:
							"Automate everything via API. Integrate monitoring into your deployment workflow.",
					},
					{
						icon: <BellOffIcon className="size-6" />,
						title: "Alert cooldowns",
						description:
							"No alert spam. Smart cooldowns notify you once until the issue is resolved.",
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
							"Configure email, Slack, Discord, or webhook alerts. Get notified instantly when your service goes down.",
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
				isSignedIn={isSignedIn}
				title="Start monitoring for free"
				description="Join solo developers who keep their projects running reliably."
			/>
		</>
	);
}
