import {
	CheckCircleIcon,
	EyeIcon,
	GlobeIcon,
	LayoutIcon,
	PaletteIcon,
	TrendingUpIcon,
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

import type { Route } from "./+types/_landing.features.status-pages";
import type { loader as landingLoader } from "./_landing";

export const meta: Route.MetaFunction = ({ data }) => data?.meta ?? [];

export async function loader({ request, context }: Route.LoaderArgs) {
	let { t } = i18next(context);

	return {
		meta: generateMeta({
			title: t("landing.features.status-pages.meta.title"),
			description: t("landing.features.status-pages.meta.description"),
			url: request.url,
			jsonLd: getSoftwareApplicationSchema({
				name: "Uptime Status Pages",
				description:
					"Beautiful, customizable status pages to keep your users informed. Public or private pages with real-time updates and uptime history.",
			}),
		}),
	};
}

export default function FeaturesStatusPagesPage() {
	let parentData = useRouteLoaderData<typeof landingLoader>("routes/_landing");
	let isSignedIn = parentData?.isSignedIn ?? false;

	return (
		<>
			<LandingHero
				isSignedIn={isSignedIn}
				badge="Status Pages"
				title={
					<>
						Keep your users informed with{" "}
						<strong className="text-primary-600 dark:text-primary-400">
							beautiful status pages
						</strong>
					</>
				}
				description="Professional status pages that automatically reflect your service health. Reduce support tickets and build trust with transparent communication."
				highlights={["Custom branding", "Real-time updates", "Uptime history"]}
			/>

			<LandingTrustIndicators
				indicators={[
					{
						icon: <GlobeIcon className="size-6" />,
						value: "Public",
						label: "Status Pages",
					},
					{
						icon: <PaletteIcon className="size-6" />,
						value: "Custom",
						label: "Branding",
					},
					{
						icon: <TrendingUpIcon className="size-6" />,
						value: "Real-time",
						label: "Updates",
					},
					{
						icon: <EyeIcon className="size-6" />,
						value: "24/7",
						label: "Visibility",
					},
				]}
			/>

			<LandingFeatures
				badge="Deep Dive"
				title="Everything you need for transparent status communication"
				description="Professional status pages that build trust and reduce support burden."
				features={[
					{
						title: "Custom branding",
						description:
							"Add your logo and description to match your brand identity. Professional appearance out of the box.",
						icon: <PaletteIcon className="size-6" />,
					},
					{
						title: "Real-time status",
						description:
							"Status pages update automatically based on your monitor health. No manual updates needed.",
						icon: <TrendingUpIcon className="size-6" />,
					},
					{
						title: "Monitor selection",
						description:
							"Choose which monitors to display on your status page. Customize display names and order.",
						icon: <LayoutIcon className="size-6" />,
					},
					{
						title: "Overall status banner",
						description:
							"Automatic overall status calculation. Show users at a glance if systems are operational.",
						icon: <CheckCircleIcon className="size-6" />,
					},
					{
						title: "Uptime history",
						description:
							"Display 30-day uptime heatmaps for each monitor. Build confidence with transparent reliability metrics.",
						icon: <TrendingUpIcon className="size-6" />,
					},
					{
						title: "Public or private",
						description:
							"Make your status page publicly accessible or keep it private for internal use only.",
						icon: <EyeIcon className="size-6" />,
					},
				]}
			/>

			<LandingHowItWorks
				title="Launch your status page in minutes"
				description="Get a professional status page up and running in three simple steps."
				steps={[
					{
						title: "Create your page",
						description:
							"Choose a unique slug for your status page URL. Add your logo and description.",
					},
					{
						title: "Select monitors",
						description:
							"Pick which monitors to display. Customize display names and set the order.",
					},
					{
						title: "Go live",
						description: "Publish your status page. Share the URL with customers and stakeholders.",
					},
				]}
			/>

			<LandingFAQ
				title="Frequently asked questions"
				description="Common questions about status pages."
				items={[
					{
						question: "Do status pages update automatically?",
						answer:
							"Yes, component status reflects your monitor health in real-time. No manual intervention required.",
					},
					{
						question: "Can I customize the display names?",
						answer:
							"Yes, each monitor can have a custom display name on the status page, different from its internal name.",
					},
					{
						question: "Can I make my status page private?",
						answer:
							"Yes, you can make your status page private so it's not publicly accessible. Only team members can view private pages.",
					},
					{
						question: "What uptime metrics are displayed?",
						answer:
							"Each monitor shows a 30-day uptime heatmap with daily success rates, plus current status indicators.",
					},
					{
						question: "How is overall status calculated?",
						answer:
							"The overall status banner shows operational (all up), degraded (some issues), or down (majority affected) based on your monitors.",
					},
					{
						question: "Can I add my logo?",
						answer:
							"Yes, add a logo URL and description to brand your status page with your company identity.",
					},
				]}
			/>

			<LandingFinalCTA
				isSignedIn={isSignedIn}
				title="Launch your status page today"
				description="Build trust with transparent communication. Set up your status page in under 5 minutes."
			/>
		</>
	);
}
