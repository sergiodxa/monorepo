/**
 * Marketing feature route for the content monitoring landing page. It composes the
 * shared hero, trust indicators, feature grid, how-it-works steps, and FAQ with copy
 * about keyword presence/absence checks, defacement detection, and full-HTML response
 * inspection. It exists as an SEO page promoting keyword/content monitoring.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import {
	AlertTriangleIcon,
	CheckCircleIcon,
	FileSearchIcon,
	FileTextIcon,
	SearchIcon,
	ShieldAlertIcon,
	TextIcon,
	XCircleIcon,
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

import type { Route } from "./+types/_landing.features.content-monitoring";
import type { loader as landingLoader } from "./_landing";

export const meta: Route.MetaFunction = ({ loaderData }) => loaderData?.meta ?? [];

export async function loader({ request, context }: Route.LoaderArgs) {
	let { t } = i18next(context);

	return {
		meta: generateMeta({
			title: t("landing.features.content-monitoring.meta.title"),
			description: t("landing.features.content-monitoring.meta.description"),
			url: request.url,
			jsonLd: getSoftwareApplicationSchema({
				name: "Uptime Content Monitoring",
				description:
					"Monitor your pages for specific content changes. Get alerted when keywords appear or disappear, detect defacements, and ensure critical content is present.",
			}),
		}),
	};
}

export default function FeaturesContentMonitoringPage() {
	let parentData = useRouteLoaderData<typeof landingLoader>("routes/_landing");
	let isSignedIn = parentData?.isSignedIn ?? false;

	return (
		<>
			<LandingHero
				isSignedIn={isSignedIn}
				badge="Content Monitoring"
				title={
					<>
						Know when your content{" "}
						<strong className="text-primary-600 dark:text-primary-400">changes unexpectedly</strong>
					</>
				}
				description="Monitor pages for specific keywords and content. Get alerted when critical text appears, disappears, or changes."
				highlights={["Keyword detection", "Content validation", "Change alerts"]}
			/>

			<LandingTrustIndicators
				indicators={[
					{
						icon: <SearchIcon className="size-6" />,
						value: "Keyword",
						label: "Detection",
					},
					{
						icon: <CheckCircleIcon className="size-6" />,
						value: "Content",
						label: "Validation",
					},
					{
						icon: <AlertTriangleIcon className="size-6" />,
						value: "Change",
						label: "Alerts",
					},
					{
						icon: <ShieldAlertIcon className="size-6" />,
						value: "Defacement",
						label: "Detection",
					},
				]}
			/>

			<LandingFeatures
				badge="Deep Dive"
				title="Beyond uptime: monitor what matters"
				description="Ensure your pages contain the right content, not just a 200 OK."
				features={[
					{
						title: "Keyword presence",
						description:
							"Alert when specific text must be present. Ensure critical content like prices, contact info, or disclaimers exist.",
						icon: <CheckCircleIcon className="size-6" />,
					},
					{
						title: "Keyword absence",
						description:
							"Alert when specific text should NOT appear. Detect error messages, debug output, or unwanted content.",
						icon: <XCircleIcon className="size-6" />,
					},
					{
						title: "Defacement detection",
						description:
							"Catch website defacements and hacks. Alert when unexpected content appears on your pages.",
						icon: <ShieldAlertIcon className="size-6" />,
					},
					{
						title: "Multiple keywords",
						description:
							"Check for multiple keywords in a single monitor. All must pass for the check to succeed.",
						icon: <FileSearchIcon className="size-6" />,
					},
					{
						title: "Case sensitivity options",
						description:
							"Choose case-sensitive or case-insensitive matching. Flexible text matching for your needs.",
						icon: <TextIcon className="size-6" />,
					},
					{
						title: "Full response inspection",
						description:
							"Inspect HTML source, not just visible text. Catch issues hidden in markup or scripts.",
						icon: <FileTextIcon className="size-6" />,
					},
				]}
			/>

			<LandingHowItWorks
				title="Set up content monitoring"
				description="Add keyword checks to any HTTP monitor in three steps."
				steps={[
					{
						title: "Add keywords",
						description:
							"Enter the text you want to monitor for. Choose whether it should be present or absent.",
					},
					{
						title: "Configure matching",
						description:
							"Set case sensitivity and matching options. Add multiple keywords if needed.",
					},
					{
						title: "Enable monitoring",
						description:
							"Content checks run with every monitor check. Get alerted when conditions fail.",
					},
				]}
			/>

			<LandingFAQ
				title="Frequently asked questions"
				description="Common questions about content monitoring."
				items={[
					{
						question: "What's the difference from regular HTTP monitoring?",
						answer:
							"HTTP monitoring checks if the page loads. Content monitoring verifies what's ON the page is correct.",
					},
					{
						question: "Can I check for multiple keywords?",
						answer:
							"Yes, add multiple keywords to a single monitor. Configure each as 'must contain' or 'must not contain'.",
					},
					{
						question: "Does it check visible text or HTML source?",
						answer:
							"Content monitoring inspects the full HTML response, including hidden elements and comments.",
					},
					{
						question: "How quickly do I get notified of content changes?",
						answer:
							"As soon as a check runs and fails. Alert timing depends on your configured check interval.",
					},
					{
						question: "Can I use regular expressions?",
						answer:
							"Currently we support exact text matching. Regular expression support is on our roadmap.",
					},
					{
						question: "What are common use cases?",
						answer:
							"Checking for error messages, ensuring pricing is displayed, detecting defacements, validating legal text.",
					},
				]}
			/>

			<LandingFinalCTA
				isSignedIn={isSignedIn}
				title="Monitor more than just uptime"
				description="Add keyword checks to your monitors. Know when content changes unexpectedly."
			/>
		</>
	);
}
