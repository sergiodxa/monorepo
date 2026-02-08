import { GlobeIcon, ShieldIcon, UserPlusIcon, UsersIcon } from "lucide-react";
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
		{ title: "Team Collaboration | Uptime Teams" },
		{
			name: "description",
			content:
				"Collaborate on uptime monitoring with unlimited team members. Role-based access and domain auto-provisioning included.",
		},
	];
}

export default function FeaturesTeamsPage() {
	let parentData = useRouteLoaderData<typeof landingLoader>("routes/_landing");
	let isSignedIn = parentData?.isSignedIn ?? false;

	return (
		<>
			<LandingHero
				isSignedIn={isSignedIn}
				badge="Teams"
				title={
					<>
						Monitor together,{" "}
						<strong className="text-primary-600 dark:text-primary-400">respond faster</strong>
					</>
				}
				description="Collaborate with your team on uptime monitoring. Shared dashboards, role-based access, and domain auto-provisioning."
				highlights={["Unlimited members", "Role-based access", "Domain verification"]}
			/>

			<LandingTrustIndicators
				indicators={[
					{
						icon: <UsersIcon className="size-6" />,
						value: "Unlimited",
						label: "Team Members",
					},
					{
						icon: <ShieldIcon className="size-6" />,
						value: "3",
						label: "Role Levels",
					},
					{
						icon: <GlobeIcon className="size-6" />,
						value: "Domain",
						label: "Verification",
					},
					{
						icon: <UserPlusIcon className="size-6" />,
						value: "Auto",
						label: "Provisioning",
					},
				]}
			/>

			<LandingFeatures
				title="Everything you need for team monitoring"
				description="Collaborate effectively with your entire team"
				features={[
					{
						icon: <UsersIcon className="size-6" />,
						title: "Unlimited members",
						description:
							"Invite your entire team at no extra cost. Team size doesn't affect pricing.",
					},
					{
						icon: <ShieldIcon className="size-6" />,
						title: "Role-based access",
						description: "Owner, Admin, and Member roles with appropriate permissions for each.",
					},
					{
						icon: <GlobeIcon className="size-6" />,
						title: "Domain verification",
						description: "Verify your company domain via DNS to enable auto-provisioning.",
					},
					{
						icon: <UserPlusIcon className="size-6" />,
						title: "Auto-provisioning",
						description:
							"Users signing up with your verified domain are automatically added to your team.",
					},
					{
						icon: <UsersIcon className="size-6" />,
						title: "Shared dashboards",
						description:
							"Everyone sees the same monitors and alerts. No silos or duplicated effort.",
					},
					{
						icon: <UserPlusIcon className="size-6" />,
						title: "Team invitations",
						description:
							"Invite specific users via email. Invitations expire after 7 days for security.",
					},
				]}
			/>

			<LandingHowItWorks
				title="Get your team started"
				description="Set up team monitoring in three easy steps"
				steps={[
					{
						title: "Create your team",
						description:
							"Every account starts with a personal team. Create additional teams as needed.",
					},
					{
						title: "Invite members",
						description: "Send email invitations or verify a domain for automatic provisioning.",
					},
					{
						title: "Assign roles",
						description: "Set Owner, Admin, or Member roles based on responsibility.",
					},
				]}
			/>

			<LandingFAQ
				title="Questions about teams"
				description="Everything you need to know about team collaboration"
				items={[
					{
						question: "How many team members can I have?",
						answer: "Unlimited. Team size doesn't affect your pricing—only pings used.",
					},
					{
						question: "What can each role do?",
						answer:
							"Owners have full access. Admins can manage monitors and members. Members can view.",
					},
					{
						question: "How does domain verification work?",
						answer: "Add a DNS TXT record with a verification code. We'll check it automatically.",
					},
					{
						question: "What is auto-provisioning?",
						answer:
							"Once your domain is verified, anyone signing up with that email domain joins your team automatically.",
					},
					{
						question: "Can I be on multiple teams?",
						answer:
							"Yes. Switch between teams from the sidebar. Each team has separate monitors and billing.",
					},
					{
						question: "How do invitations work?",
						answer: "Invited users receive an email with a link. Invitations expire after 7 days.",
					},
				]}
			/>

			<LandingFinalCTA
				isSignedIn={isSignedIn}
				title="Build your monitoring team"
				description="Invite your team and start monitoring together. No per-seat pricing."
			/>
		</>
	);
}
