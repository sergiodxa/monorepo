import { Badge, Card } from "@pkg/ui";
import {
	AlertTriangleIcon,
	CheckIcon,
	DollarSignIcon,
	GlobeIcon,
	MinusIcon,
	SparklesIcon,
	UsersIcon,
	XIcon,
} from "lucide-react";
import { useRouteLoaderData } from "react-router";

import { LandingFAQ, LandingFinalCTA, LandingHero } from "~/components/landing";

import type { Route } from "./+types/_landing.vs.statuscake";
import type { loader as landingLoader } from "./_landing";

export function meta({ data }: Route.MetaArgs) {
	return data.meta;
}

export function loader() {
	return {
		meta: [
			{ title: "Uptime vs StatusCake | Compare Uptime Monitoring Tools" },
			{
				name: "description",
				content:
					"Compare Uptime and StatusCake side by side. Modern monitoring with a fresh approach. See features, pricing, and find out which is right for you.",
			},
		],
	};
}

interface ComparisonRow {
	feature: string;
	uptime: string | boolean;
	statuscake: string | boolean;
	uptimeNote?: string;
	statuscakeNote?: string;
}

let comparisonData: ComparisonRow[] = [
	{ feature: "Starting price", uptime: "$5/mo", statuscake: "$20/mo" },
	{
		feature: "Free tier",
		uptime: "Manual pings",
		statuscake: "10 monitors",
	},
	{ feature: "Pricing model", uptime: "Usage-based", statuscake: "Tiered" },
	{ feature: "Check intervals", uptime: "1-60 minutes", statuscake: "1-5 minutes" },
	{ feature: "Status pages", uptime: true, statuscake: true },
	{ feature: "SSL monitoring", uptime: true, statuscake: true },
	{ feature: "DNS monitoring", uptime: true, statuscake: true },
	{
		feature: "Page speed",
		uptime: false,
		statuscake: true,
		uptimeNote: "Not included",
		statuscakeNote: "Included",
	},
	{
		feature: "Server monitoring",
		uptime: false,
		statuscake: true,
		uptimeNote: "Not included",
		statuscakeNote: "Included",
	},
	{
		feature: "Team collaboration",
		uptime: "Unlimited",
		statuscake: "Limited",
		statuscakeNote: "Limited by plan",
	},
	{ feature: "UI/UX", uptime: "Modern", statuscake: "Traditional" },
	{
		feature: "Data retention",
		uptime: "365 days",
		statuscake: "Varies",
		statuscakeNote: "Varies by plan",
	},
];

function ComparisonCell({ value, note }: { value: string | boolean; note?: string }) {
	if (typeof value === "boolean") {
		return (
			<span className="flex items-center justify-center gap-2">
				{value ? (
					<CheckIcon className="size-5 text-success-500" />
				) : (
					<XIcon className="size-5 text-neutral-400" />
				)}
				{note && <span className="text-sm text-neutral-500 dark:text-neutral-400">{note}</span>}
			</span>
		);
	}
	if (value === "Limited" || value === "Varies") {
		return (
			<span className="flex items-center justify-center gap-2 text-warning-600 dark:text-warning-400">
				<MinusIcon className="size-5" />
				<span>{note ?? value}</span>
			</span>
		);
	}
	return <span>{value}</span>;
}

function ComparisonTable() {
	return (
		<section className="scroll-mt-20 py-16 sm:py-24 lg:py-32">
			<div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
				<div className="mx-auto max-w-2xl text-center">
					<Badge color="primary" variant="secondary" className="mb-4">
						Comparison
					</Badge>
					<h2 className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl dark:text-neutral-50">
						Feature by feature
					</h2>
					<p className="mt-4 text-lg text-neutral-600 dark:text-neutral-400">
						See how Uptime and StatusCake stack up across key features.
					</p>
				</div>

				<div className="mt-12 overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
					<table className="w-full">
						<thead>
							<tr className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-800/50">
								<th className="px-6 py-4 text-left text-sm font-semibold text-neutral-900 dark:text-neutral-50">
									Feature
								</th>
								<th className="px-6 py-4 text-center text-sm font-semibold text-primary-600 dark:text-primary-400">
									Uptime
								</th>
								<th className="px-6 py-4 text-center text-sm font-semibold text-neutral-600 dark:text-neutral-400">
									StatusCake
								</th>
							</tr>
						</thead>
						<tbody>
							{comparisonData.map((row, index) => (
								<tr
									key={row.feature}
									className={
										index !== comparisonData.length - 1
											? "border-b border-neutral-200 dark:border-neutral-800"
											: ""
									}
								>
									<td className="px-6 py-4 text-sm font-medium text-neutral-900 dark:text-neutral-50">
										{row.feature}
									</td>
									<td className="px-6 py-4 text-center text-sm text-neutral-600 dark:text-neutral-400">
										<ComparisonCell value={row.uptime} note={row.uptimeNote} />
									</td>
									<td className="px-6 py-4 text-center text-sm text-neutral-600 dark:text-neutral-400">
										<ComparisonCell value={row.statuscake} note={row.statuscakeNote} />
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>
		</section>
	);
}

function WhyChooseUptime() {
	let reasons = [
		{
			icon: <SparklesIcon className="size-6" />,
			title: "Modern, intuitive interface",
			description:
				"Clean, fast dashboard built for developers. Visual heatmaps, streamlined workflows, and a UI that gets out of your way.",
		},
		{
			icon: <DollarSignIcon className="size-6" />,
			title: "4x more affordable entry",
			description:
				"Start at just $5/mo compared to StatusCake's $20/mo. Usage-based pricing means you only pay for what you use.",
		},
		{
			icon: <CheckIcon className="size-6" />,
			title: "Longer data retention included",
			description:
				"365 days of data retention included on all plans. StatusCake's retention varies by plan tier.",
		},
		{
			icon: <UsersIcon className="size-6" />,
			title: "Unlimited team members",
			description:
				"Invite your whole team at no extra cost. No per-seat pricing or team limits based on your plan.",
		},
	];

	return (
		<section className="scroll-mt-20 bg-neutral-50 py-16 sm:py-24 lg:py-32 dark:bg-neutral-900/50">
			<div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
				<div className="mx-auto max-w-2xl text-center">
					<Badge color="success" variant="secondary" className="mb-4">
						Why Uptime
					</Badge>
					<h2 className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl dark:text-neutral-50">
						Why choose Uptime
					</h2>
					<p className="mt-4 text-lg text-neutral-600 dark:text-neutral-400">
						A fresh approach to uptime monitoring that doesn't break the bank.
					</p>
				</div>

				<div className="mt-12 grid gap-6 md:grid-cols-2">
					{reasons.map((reason) => (
						<Card key={reason.title} className="transition-shadow hover:shadow-lg">
							<Card.Header>
								<div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-success-100 text-success-600 dark:bg-success-900/50 dark:text-success-400">
									{reason.icon}
								</div>
								<Card.Title className="text-xl">{reason.title}</Card.Title>
							</Card.Header>
							<Card.Content className="pt-0">
								<p className="text-neutral-600 dark:text-neutral-400">{reason.description}</p>
							</Card.Content>
						</Card>
					))}
				</div>
			</div>
		</section>
	);
}

function WhenStatusCakeBetter() {
	let reasons = [
		{
			title: "If you need page speed monitoring",
			description:
				"StatusCake offers page speed monitoring to track load times and performance metrics. Uptime focuses on uptime monitoring and doesn't include page speed analysis.",
		},
		{
			title: "If you need server resource monitoring",
			description:
				"StatusCake provides server monitoring to track CPU, memory, and disk usage. If you need infrastructure-level monitoring alongside uptime checks, StatusCake has you covered.",
		},
		{
			title: "If you prefer a traditional UI",
			description:
				"StatusCake has a more traditional, feature-dense interface. If you prefer that style over modern minimalist design, StatusCake might feel more familiar.",
		},
	];

	return (
		<section className="scroll-mt-20 py-16 sm:py-24 lg:py-32">
			<div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
				<div className="mx-auto max-w-2xl text-center">
					<Badge color="warning" variant="secondary" className="mb-4">
						Honest Take
					</Badge>
					<h2 className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl dark:text-neutral-50">
						When StatusCake might be better
					</h2>
					<p className="mt-4 text-lg text-neutral-600 dark:text-neutral-400">
						We believe in being transparent. Here's when StatusCake could be the right choice.
					</p>
				</div>

				<div className="mt-12 space-y-6">
					{reasons.map((reason) => (
						<div
							key={reason.title}
							className="flex gap-4 rounded-xl border border-warning-200 bg-warning-50 p-6 dark:border-warning-800/50 dark:bg-warning-900/20"
						>
							<AlertTriangleIcon className="size-6 shrink-0 text-warning-600 dark:text-warning-400" />
							<div>
								<h3 className="font-semibold text-neutral-900 dark:text-neutral-50">
									{reason.title}
								</h3>
								<p className="mt-2 text-neutral-600 dark:text-neutral-400">{reason.description}</p>
							</div>
						</div>
					))}
				</div>
			</div>
		</section>
	);
}

function PricingComparison() {
	let comparisons = [
		{
			scenario: "10 monitors, 5-minute intervals",
			statuscake: "$20/mo",
			uptime: "~$7/mo",
			savings: "65%",
		},
		{
			scenario: "25 monitors, mixed intervals",
			statuscake: "$20/mo",
			uptime: "~$12/mo",
			savings: "40%",
		},
		{
			scenario: "50 monitors, 1-minute intervals",
			statuscake: "$66/mo",
			uptime: "~$25/mo",
			savings: "62%",
		},
	];

	return (
		<section className="scroll-mt-20 bg-neutral-50 py-16 sm:py-24 lg:py-32 dark:bg-neutral-900/50">
			<div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
				<div className="mx-auto max-w-2xl text-center">
					<Badge color="primary" variant="secondary" className="mb-4">
						Pricing
					</Badge>
					<h2 className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl dark:text-neutral-50">
						Real cost comparison
					</h2>
					<p className="mt-4 text-lg text-neutral-600 dark:text-neutral-400">
						See how much you could save with Uptime for typical monitoring setups.
					</p>
				</div>

				<div className="mt-12 overflow-hidden rounded-xl border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
					<table className="w-full">
						<thead>
							<tr className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-800/50">
								<th className="px-6 py-4 text-left text-sm font-semibold text-neutral-900 dark:text-neutral-50">
									Use Case
								</th>
								<th className="px-6 py-4 text-center text-sm font-semibold text-neutral-600 dark:text-neutral-400">
									StatusCake
								</th>
								<th className="px-6 py-4 text-center text-sm font-semibold text-primary-600 dark:text-primary-400">
									Uptime
								</th>
								<th className="px-6 py-4 text-center text-sm font-semibold text-success-600 dark:text-success-400">
									Savings
								</th>
							</tr>
						</thead>
						<tbody>
							{comparisons.map((row, index) => (
								<tr
									key={row.scenario}
									className={
										index !== comparisons.length - 1
											? "border-b border-neutral-200 dark:border-neutral-800"
											: ""
									}
								>
									<td className="px-6 py-4 text-sm font-medium text-neutral-900 dark:text-neutral-50">
										{row.scenario}
									</td>
									<td className="px-6 py-4 text-center text-sm text-neutral-600 dark:text-neutral-400">
										{row.statuscake}
									</td>
									<td className="px-6 py-4 text-center text-sm font-semibold text-primary-600 dark:text-primary-400">
										{row.uptime}
									</td>
									<td className="px-6 py-4 text-center text-sm font-semibold text-success-600 dark:text-success-400">
										{row.savings}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>

				<p className="mt-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
					* Estimates based on typical usage patterns. Actual costs may vary based on check
					frequency and additional features.
				</p>
			</div>
		</section>
	);
}

function MigrationCTA({ isSignedIn }: { isSignedIn: boolean }) {
	return (
		<section className="scroll-mt-20 py-16 sm:py-24 lg:py-32">
			<div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
				<div className="overflow-hidden rounded-2xl bg-gradient-to-r from-primary-600 to-primary-700 p-8 text-center shadow-xl sm:p-12">
					<div className="mx-auto flex size-16 items-center justify-center rounded-full bg-white/10">
						<GlobeIcon className="size-8 text-white" />
					</div>
					<h2 className="mt-6 text-2xl font-bold text-white sm:text-3xl">
						Ready to switch from StatusCake?
					</h2>
					<p className="mx-auto mt-4 max-w-2xl text-lg text-primary-100">
						Migration is simple. Set up your monitors in minutes and start saving immediately.
						Cancel StatusCake once you're satisfied.
					</p>
					<div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
						<a
							href={isSignedIn ? "/app" : "/auth"}
							className="inline-flex items-center gap-2 rounded-lg bg-white px-8 py-4 text-lg font-semibold text-primary-600 shadow-lg transition hover:bg-primary-50"
						>
							Start Free Migration
						</a>
						<a
							href="/#pricing"
							className="inline-flex items-center gap-2 rounded-lg border border-white/30 px-8 py-4 text-lg font-semibold text-white transition hover:bg-white/10"
						>
							View Full Pricing
						</a>
					</div>
				</div>
			</div>
		</section>
	);
}

export default function VsStatusCakePage() {
	let parentData = useRouteLoaderData<typeof landingLoader>("routes/_landing");
	let isSignedIn = parentData?.isSignedIn ?? false;

	return (
		<>
			<LandingHero
				isSignedIn={isSignedIn}
				badge="Uptime vs StatusCake"
				title={
					<>
						Modern monitoring.{" "}
						<strong className="text-primary-600 dark:text-primary-400">Fresh approach.</strong>
					</>
				}
				description="Modern monitoring with a fresh approach. See how Uptime compares to StatusCake."
				ctaOut="Try Uptime Free"
				secondaryCta={{ label: "See Comparison", href: "#comparison" }}
				highlights={["Starting at $5/mo", "365 days retention", "Unlimited team members"]}
			/>

			<div id="comparison">
				<ComparisonTable />
			</div>

			<WhyChooseUptime />

			<WhenStatusCakeBetter />

			<PricingComparison />

			<MigrationCTA isSignedIn={isSignedIn} />

			<LandingFAQ
				badge="FAQ"
				title="Common questions"
				description="Answers to frequently asked questions about switching from StatusCake."
				items={[
					{
						question: "How does Uptime's pricing compare to StatusCake?",
						answer:
							"Uptime starts at $5/mo with usage-based pricing, while StatusCake starts at $20/mo with tiered pricing. For most uptime monitoring use cases, Uptime costs 40-65% less than StatusCake.",
					},
					{
						question: "Does StatusCake have a better free tier?",
						answer:
							"StatusCake's free tier includes 10 monitors with 5-minute intervals. Uptime's free tier allows unlimited manual pings but requires a paid plan for automated monitoring. If you only need basic free monitoring, StatusCake's free tier is more generous.",
					},
					{
						question: "Can I migrate my monitors from StatusCake?",
						answer:
							"Yes! While we don't have an automated import tool, setting up monitors in Uptime takes just minutes. Simply create new monitors with the same URLs and settings.",
					},
					{
						question: "What about page speed monitoring?",
						answer:
							"Uptime focuses on uptime monitoring and doesn't include page speed analysis. If you need page speed monitoring, StatusCake includes this feature in their plans.",
					},
					{
						question: "Does Uptime have server monitoring?",
						answer:
							"No, Uptime focuses on HTTP/HTTPS, SSL, and DNS monitoring. StatusCake offers server resource monitoring (CPU, memory, disk). If you need infrastructure monitoring, StatusCake or a dedicated tool may be better.",
					},
					{
						question: "How do check intervals compare?",
						answer:
							"Uptime offers intervals from 1-60 minutes, giving you flexibility to reduce costs for less critical monitors. StatusCake offers 1-5 minute intervals on paid plans.",
					},
					{
						question: "Are team seats really unlimited with Uptime?",
						answer:
							"Yes! Invite your entire team at no extra cost. StatusCake limits team members based on your plan tier.",
					},
					{
						question: "What about data retention?",
						answer:
							"Uptime includes 365 days of data retention on all plans. StatusCake's retention varies by plan tier, with lower tiers having shorter retention periods.",
					},
				]}
			/>

			<LandingFinalCTA
				isSignedIn={isSignedIn}
				title="Ready to try modern monitoring?"
				description="Join developers who switched to Uptime for a cleaner interface and better value."
				ctaOut="Start Free Trial"
			/>
		</>
	);
}
