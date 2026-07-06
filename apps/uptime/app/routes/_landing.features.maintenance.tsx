/**
 * Marketing landing page for the maintenance windows feature. Its loader builds
 * localized SEO meta including SoftwareApplication JSON-LD, and the component
 * composes the shared landing sections with copy about scheduling planned
 * downtime, suppressing alerts, recurring windows, and keeping metrics accurate.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import {
	BellOffIcon,
	CalendarIcon,
	PauseIcon,
	RefreshCwIcon,
	RepeatIcon,
	ShieldIcon,
	TimerIcon,
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

import type { Route } from "./+types/_landing.features.maintenance";
import type { loader as landingLoader } from "./_landing";

export const meta: Route.MetaFunction = ({ data }) => data?.meta ?? [];

export async function loader({ request, context }: Route.LoaderArgs) {
	let { t } = i18next(context);

	return {
		meta: generateMeta({
			title: t("landing.features.maintenance.meta.title"),
			description: t("landing.features.maintenance.meta.description"),
			url: request.url,
			jsonLd: getSoftwareApplicationSchema({
				name: "Uptime Maintenance Windows",
				description:
					"Schedule maintenance windows to pause alerts during planned downtime. Avoid false alarms and keep your uptime metrics accurate.",
			}),
		}),
	};
}

export default function FeaturesMaintenancePage() {
	let parentData = useRouteLoaderData<typeof landingLoader>("routes/_landing");
	let isSignedIn = parentData?.isSignedIn ?? false;

	return (
		<>
			<LandingHero
				isSignedIn={isSignedIn}
				badge="Maintenance Windows"
				title={
					<>
						Schedule downtime{" "}
						<strong className="text-primary-600 dark:text-primary-400">without the noise</strong>
					</>
				}
				description="Plan maintenance windows in advance. Pause alerts during scheduled downtime and keep your uptime metrics clean."
				highlights={["Scheduled windows", "Alert suppression", "Accurate metrics"]}
			/>

			<LandingTrustIndicators
				indicators={[
					{
						icon: <CalendarIcon className="size-6" />,
						value: "Scheduled",
						label: "Maintenance",
					},
					{
						icon: <BellOffIcon className="size-6" />,
						value: "Alert",
						label: "Suppression",
					},
					{
						icon: <RepeatIcon className="size-6" />,
						value: "Recurring",
						label: "Windows",
					},
					{
						icon: <ShieldIcon className="size-6" />,
						value: "Clean",
						label: "Metrics",
					},
				]}
			/>

			<LandingFeatures
				badge="Deep Dive"
				title="Professional maintenance management"
				description="Take control of planned downtime with flexible maintenance windows."
				features={[
					{
						title: "Scheduled windows",
						description:
							"Schedule maintenance in advance. Set start time, duration, and affected monitors.",
						icon: <CalendarIcon className="size-6" />,
					},
					{
						title: "Alert suppression",
						description:
							"Automatically pause alerts during maintenance. No false alarms for planned work.",
						icon: <BellOffIcon className="size-6" />,
					},
					{
						title: "Recurring schedules",
						description:
							"Set up weekly or monthly maintenance windows. Perfect for regular update cycles.",
						icon: <RepeatIcon className="size-6" />,
					},
					{
						title: "Status page updates",
						description:
							"Automatically update your status page during maintenance. Keep users informed.",
						icon: <RefreshCwIcon className="size-6" />,
					},
					{
						title: "Flexible duration",
						description:
							"Set precise start and end times. Extend windows on the fly if maintenance runs long.",
						icon: <TimerIcon className="size-6" />,
					},
					{
						title: "Monitor grouping",
						description:
							"Apply maintenance windows to individual monitors or groups. Fine-grained control.",
						icon: <PauseIcon className="size-6" />,
					},
				]}
			/>

			<LandingHowItWorks
				title="Schedule maintenance easily"
				description="Set up maintenance windows in three simple steps."
				steps={[
					{
						title: "Create window",
						description: "Click 'New Maintenance Window' and set the start time and duration.",
					},
					{
						title: "Select monitors",
						description:
							"Choose which monitors should be affected. Select individuals or entire groups.",
					},
					{
						title: "Save and forget",
						description: "The window activates automatically. Alerts pause and resume on schedule.",
					},
				]}
			/>

			<LandingFAQ
				title="Frequently asked questions"
				description="Common questions about maintenance windows."
				items={[
					{
						question: "Do monitors stop checking during maintenance?",
						answer:
							"Monitors continue checking but alerts are suppressed. You still see the data in your dashboard.",
					},
					{
						question: "Does maintenance affect my uptime percentage?",
						answer:
							"Maintenance windows are excluded from uptime calculations, keeping your metrics accurate.",
					},
					{
						question: "Can I set recurring maintenance windows?",
						answer:
							"Yes, schedule daily, weekly, or monthly recurring windows for regular maintenance cycles.",
					},
					{
						question: "What if maintenance runs longer than planned?",
						answer: "Extend the window duration from your dashboard while maintenance is active.",
					},
					{
						question: "Are users notified about scheduled maintenance?",
						answer:
							"If you have a status page, it can automatically display scheduled maintenance to users.",
					},
					{
						question: "Can I cancel a scheduled maintenance window?",
						answer:
							"Yes, delete or modify any scheduled window before it starts. Active windows can be ended early.",
					},
				]}
			/>

			<LandingFinalCTA
				isSignedIn={isSignedIn}
				title="Take control of your maintenance"
				description="Schedule maintenance windows and eliminate false alarms. Set up in seconds."
			/>
		</>
	);
}
