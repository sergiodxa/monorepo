import {
	CalendarClockIcon,
	GlobeIcon,
	LockIcon,
	ShieldCheckIcon,
	ShieldIcon,
	UsersIcon,
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

import type { loader as landingLoader } from "./_landing";

export function meta() {
	return [
		{ title: "Uptime for Enterprises | Domain Auto-Provisioning" },
		{
			name: "description",
			content:
				"Enterprise uptime monitoring with domain verification, auto-provisioning, and role-based access. 99.9% SLA guaranteed.",
		},
	];
}

export default function ForEnterprisesPage() {
	let parentData = useRouteLoaderData<typeof landingLoader>("routes/_landing");
	let isSignedIn = parentData?.isSignedIn ?? false;

	return (
		<>
			<LandingHero
				isSignedIn={isSignedIn}
				badge="For Enterprises"
				title={
					<>
						Enterprise reliability,{" "}
						<strong className="text-primary-600 dark:text-primary-400">startup simplicity</strong>
					</>
				}
				description="Powerful uptime monitoring with the features large teams need: domain verification, automatic team provisioning, and role-based access."
				highlights={["Domain auto-provisioning", "Role-based access", "99.9% SLA"]}
			/>

			<LandingTrustIndicators
				indicators={[
					{
						icon: <ShieldIcon className="size-6" />,
						value: "99.9%",
						label: "SLA Guarantee",
					},
					{
						icon: <UsersIcon className="size-6" />,
						value: "Auto",
						label: "Provisioning",
					},
					{
						icon: <LockIcon className="size-6" />,
						value: "Verified",
						label: "Domains",
					},
					{
						icon: <GlobeIcon className="size-6" />,
						value: "9",
						label: "Regions",
					},
				]}
			/>

			<LandingFeatures
				title="Built for enterprises"
				description="Everything your organization needs for reliable monitoring"
				features={[
					{
						icon: <UsersIcon className="size-6" />,
						title: "Domain auto-provisioning",
						description:
							"Verify your company domain and automatically add team members who sign up with matching emails.",
					},
					{
						icon: <ShieldIcon className="size-6" />,
						title: "Role-based access",
						description:
							"Assign Owner, Admin, or Member roles. Control who can modify monitors and settings.",
					},
					{
						icon: <LockIcon className="size-6" />,
						title: "Verified domains",
						description:
							"Add and verify your company domains via DNS TXT records for enhanced security.",
					},
					{
						icon: <GlobeIcon className="size-6" />,
						title: "Audit-ready",
						description:
							"365 days of historical data. Track every check and alert for compliance needs.",
					},
					{
						icon: <CalendarClockIcon className="size-6" />,
						title: "Maintenance windows",
						description: "Schedule maintenance periods to suppress alerts during planned downtime.",
					},
					{
						icon: <ShieldCheckIcon className="size-6" />,
						title: "SSL & DNS monitoring",
						description:
							"Monitor SSL certificate expiry and DNS records. Prevent security-related outages.",
					},
				]}
			/>

			<LandingHowItWorks
				title="Get started in minutes"
				description="Three simple steps to enterprise monitoring"
				steps={[
					{
						title: "Verify your domain",
						description: "Add a DNS TXT record to verify ownership of your company domain.",
					},
					{
						title: "Auto-provision users",
						description:
							"Anyone signing up with your domain email is automatically added to your team.",
					},
					{
						title: "Assign roles",
						description: "Set appropriate permissions for each team member.",
					},
				]}
			/>

			<LandingFAQ
				title="Questions? We've got answers"
				description="Everything you need to know about Uptime for enterprises"
				items={[
					{
						question: "How does domain auto-provisioning work?",
						answer:
							"Verify your domain via DNS, then anyone who signs up with that email domain is automatically added to your team.",
					},
					{
						question: "What roles are available?",
						answer:
							"Owner (full access), Admin (manage monitors and members), and Member (view only). More granular permissions coming soon.",
					},
					{
						question: "Do you offer an SLA?",
						answer: "Yes, we guarantee 99.9% uptime for our monitoring infrastructure.",
					},
					{
						question: "Is SOC 2 compliance available?",
						answer:
							"We're working toward SOC 2 certification. Contact us for our current security documentation.",
					},
					{
						question: "Can we get dedicated support?",
						answer: "Enterprise support packages are available. Contact us for details.",
					},
					{
						question: "Is there volume pricing?",
						answer:
							"Our usage-based model naturally provides volume discounts. Contact us for custom arrangements.",
					},
				]}
			/>

			<LandingFinalCTA
				isSignedIn={isSignedIn}
				title="Enterprise monitoring, simplified"
				description="Join enterprises that trust Uptime for reliable, scalable monitoring."
			/>
		</>
	);
}
