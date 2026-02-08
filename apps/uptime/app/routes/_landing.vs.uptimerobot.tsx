import { Badge, Card } from "@pkg/ui";
import {
	ArrowRightIcon,
	CheckIcon,
	DollarSignIcon,
	GlobeIcon,
	SparklesIcon,
	UsersIcon,
	XIcon,
	ZapIcon,
} from "lucide-react";
import { href, Link, useRouteLoaderData } from "react-router";

import { LandingFAQ, LandingFinalCTA, LandingHero } from "~/components/landing";

import type { Route } from "./+types/_landing.vs.uptimerobot";
import type { loader as landingLoader } from "./_landing";

export function meta({ data }: Route.MetaArgs) {
	return data.meta;
}

export function loader() {
	return {
		meta: [
			{ title: "Uptime vs UptimeRobot | Modern Usage-Based Monitoring" },
			{
				name: "description",
				content:
					"Compare Uptime and UptimeRobot. Discover why transparent, usage-based pricing and modern features make Uptime the better choice for your monitoring needs.",
			},
		],
	};
}

interface ComparisonRow {
	feature: string;
	uptime: string | boolean;
	uptimeRobot: string | boolean;
	highlight?: boolean;
}

let comparisonData: ComparisonRow[] = [
	{
		feature: "Free tier",
		uptime: "Manual pings only",
		uptimeRobot: "50 monitors, 5-min intervals",
	},
	{
		feature: "Pricing model",
		uptime: "Usage-based ($5 + $0.001/ping)",
		uptimeRobot: "Tiered ($7-$54/mo)",
		highlight: true,
	},
	{
		feature: "Check intervals",
		uptime: "1-60 minutes",
		uptimeRobot: "5 min (free), 1 min (paid)",
	},
	{
		feature: "Global regions",
		uptime: "9 regions",
		uptimeRobot: "Limited regions",
		highlight: true,
	},
	{
		feature: "Status pages",
		uptime: "Included",
		uptimeRobot: "Basic free, custom paid",
	},
	{
		feature: "SSL monitoring",
		uptime: "Included",
		uptimeRobot: "Paid plans only",
	},
	{
		feature: "DNS monitoring",
		uptime: "Included",
		uptimeRobot: "Available",
	},
	{
		feature: "Keyword monitoring",
		uptime: "Included",
		uptimeRobot: "Available",
	},
	{
		feature: "Slack/Discord",
		uptime: "Native integration",
		uptimeRobot: "Via webhooks",
	},
	{
		feature: "Team collaboration",
		uptime: "Unlimited members",
		uptimeRobot: "Limited by plan",
		highlight: true,
	},
	{
		feature: "Data retention",
		uptime: "365 days",
		uptimeRobot: "90 days (free)",
		highlight: true,
	},
];

function ComparisonTable() {
	return (
		<section className="py-16 sm:py-24 lg:py-32">
			<div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
				<div className="mx-auto max-w-2xl text-center">
					<Badge color="primary" variant="secondary" className="mb-4">
						Comparison
					</Badge>
					<h2 className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl dark:text-neutral-50">
						Feature-by-feature comparison
					</h2>
					<p className="mt-4 text-lg text-neutral-600 dark:text-neutral-400">
						See how Uptime stacks up against UptimeRobot across key features.
					</p>
				</div>

				<div className="mt-16 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
					<div className="overflow-x-auto">
						<table className="w-full">
							<thead>
								<tr className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-800/50">
									<th className="px-6 py-4 text-left text-sm font-semibold text-neutral-900 dark:text-neutral-50">
										Feature
									</th>
									<th className="px-6 py-4 text-left text-sm font-semibold text-primary-600 dark:text-primary-400">
										Uptime
									</th>
									<th className="px-6 py-4 text-left text-sm font-semibold text-neutral-600 dark:text-neutral-400">
										UptimeRobot
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
								{comparisonData.map((row) => (
									<tr
										key={row.feature}
										className={row.highlight ? "bg-primary-50/50 dark:bg-primary-900/10" : ""}
									>
										<td className="px-6 py-4 text-sm font-medium text-neutral-900 dark:text-neutral-50">
											{row.feature}
										</td>
										<td className="px-6 py-4 text-sm text-neutral-700 dark:text-neutral-300">
											{typeof row.uptime === "boolean" ? (
												row.uptime ? (
													<CheckIcon className="size-5 text-success-500" />
												) : (
													<XIcon className="size-5 text-neutral-400" />
												)
											) : (
												row.uptime
											)}
										</td>
										<td className="px-6 py-4 text-sm text-neutral-600 dark:text-neutral-400">
											{typeof row.uptimeRobot === "boolean" ? (
												row.uptimeRobot ? (
													<CheckIcon className="size-5 text-success-500" />
												) : (
													<XIcon className="size-5 text-neutral-400" />
												)
											) : (
												row.uptimeRobot
											)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		</section>
	);
}

function WhySwitchSection() {
	let reasons = [
		{
			icon: <DollarSignIcon className="size-6" />,
			title: "Pay only for what you use",
			description:
				"No wasted money on unused monitor slots. With usage-based pricing, you only pay for actual pings.",
		},
		{
			icon: <GlobeIcon className="size-6" />,
			title: "More global regions",
			description:
				"Monitor from 9 regions worldwide for comprehensive coverage and accurate latency data.",
		},
		{
			icon: <SparklesIcon className="size-6" />,
			title: "Modern, clean interface",
			description:
				"A streamlined dashboard built for speed. See your service health at a glance with visual heatmaps.",
		},
		{
			icon: <UsersIcon className="size-6" />,
			title: "Better team collaboration",
			description: "Unlimited team members on all plans. No per-seat charges or artificial limits.",
		},
	];

	return (
		<section className="bg-neutral-50 py-16 sm:py-24 lg:py-32 dark:bg-neutral-900/50">
			<div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
				<div className="mx-auto max-w-2xl text-center">
					<Badge color="primary" variant="secondary" className="mb-4">
						Why Switch
					</Badge>
					<h2 className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl dark:text-neutral-50">
						Why teams are switching to Uptime
					</h2>
					<p className="mt-4 text-lg text-neutral-600 dark:text-neutral-400">
						Real advantages that make a difference to your monitoring workflow.
					</p>
				</div>

				<div className="mt-16 grid gap-8 md:grid-cols-2">
					{reasons.map((reason) => (
						<Card key={reason.title} className="transition-shadow hover:shadow-lg">
							<Card.Header>
								<div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-primary-100 text-primary-600 dark:bg-primary-900/50 dark:text-primary-400">
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

function PricingComparisonSection() {
	let examples = [
		{
			scenario: "10 monitors at 5-min intervals",
			uptimeRobot: "$7/mo (Solo plan)",
			uptime: "~$6/mo",
			savings: "Save ~$12/year",
		},
		{
			scenario: "25 monitors at 5-min intervals",
			uptimeRobot: "$21/mo (Team plan)",
			uptime: "~$14/mo",
			savings: "Save ~$84/year",
		},
		{
			scenario: "50 monitors at 1-min intervals",
			uptimeRobot: "$54/mo (Enterprise plan)",
			uptime: "~$37/mo",
			savings: "Save ~$204/year",
		},
	];

	return (
		<section className="py-16 sm:py-24 lg:py-32">
			<div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
				<div className="mx-auto max-w-2xl text-center">
					<Badge color="primary" variant="secondary" className="mb-4">
						Pricing
					</Badge>
					<h2 className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl dark:text-neutral-50">
						Usage-based pricing that scales with you
					</h2>
					<p className="mt-4 text-lg text-neutral-600 dark:text-neutral-400">
						See how much you could save with transparent, per-ping pricing.
					</p>
				</div>

				<div className="mt-16 grid gap-6 md:grid-cols-3">
					{examples.map((example) => (
						<Card key={example.scenario} className="relative overflow-hidden">
							<div className="absolute top-0 right-0 left-0 h-1 bg-gradient-to-r from-primary-500 to-primary-600" />
							<Card.Header>
								<Card.Title className="text-lg">{example.scenario}</Card.Title>
							</Card.Header>
							<Card.Content className="space-y-4">
								<div className="flex items-center justify-between border-b border-neutral-200 pb-3 dark:border-neutral-700">
									<span className="text-sm text-neutral-600 dark:text-neutral-400">
										UptimeRobot
									</span>
									<span className="font-medium text-neutral-900 dark:text-neutral-100">
										{example.uptimeRobot}
									</span>
								</div>
								<div className="flex items-center justify-between border-b border-neutral-200 pb-3 dark:border-neutral-700">
									<span className="text-sm text-primary-600 dark:text-primary-400">Uptime</span>
									<span className="font-semibold text-primary-600 dark:text-primary-400">
										{example.uptime}
									</span>
								</div>
								<div className="flex items-center justify-center rounded-lg bg-success-50 py-2 dark:bg-success-900/20">
									<span className="text-sm font-semibold text-success-700 dark:text-success-400">
										{example.savings}
									</span>
								</div>
							</Card.Content>
						</Card>
					))}
				</div>

				<div className="mt-12 rounded-xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900">
					<div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
						<div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/50">
							<ZapIcon className="size-6 text-primary-600 dark:text-primary-400" />
						</div>
						<div className="flex-1">
							<h3 className="font-semibold text-neutral-900 dark:text-neutral-50">
								How we calculate
							</h3>
							<p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
								Uptime charges $5/month base + $0.001 per ping. A monitor checking every 5 minutes
								generates ~8,640 pings/month. So 10 monitors = ~86,400 pings = ~$86.40 in pings, but
								the first 5,000 are included, so ~$81.40 + $5 = ~$6/mo.
							</p>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}

function MigrationCTASection({ isSignedIn }: { isSignedIn: boolean }) {
	return (
		<section className="bg-neutral-50 py-16 sm:py-24 dark:bg-neutral-900/50">
			<div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
				<Badge color="primary" variant="secondary" className="mb-4">
					Get Started
				</Badge>
				<h2 className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl dark:text-neutral-50">
					Switch in minutes
				</h2>
				<p className="mx-auto mt-4 max-w-2xl text-lg text-neutral-600 dark:text-neutral-400">
					Setting up Uptime is fast and simple. Create your monitors and start getting alerts right
					away.
				</p>

				<div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
					<Link
						to={isSignedIn ? href("/app") : href("/auth")}
						reloadDocument={!isSignedIn}
						className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-3 text-base font-semibold text-white shadow-lg transition hover:bg-primary-700 hover:shadow-xl"
					>
						{isSignedIn ? "Open Dashboard" : "Start Free"}
						<ArrowRightIcon className="size-5" />
					</Link>
					<a
						href="/#pricing"
						className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-6 py-3 text-base font-semibold text-neutral-700 shadow-sm transition hover:bg-neutral-50 hover:shadow-md dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
					>
						View Pricing
					</a>
				</div>

				<div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-neutral-500 dark:text-neutral-400">
					<div className="flex items-center gap-2">
						<CheckIcon className="size-4 text-success-500" />
						<span>No credit card required</span>
					</div>
					<div className="flex items-center gap-2">
						<CheckIcon className="size-4 text-success-500" />
						<span>Free manual pings forever</span>
					</div>
					<div className="flex items-center gap-2">
						<CheckIcon className="size-4 text-success-500" />
						<span>Setup in under 2 minutes</span>
					</div>
				</div>
			</div>
		</section>
	);
}

export default function VsUptimeRobotPage() {
	let parentData = useRouteLoaderData<typeof landingLoader>("routes/_landing");
	let isSignedIn = parentData?.isSignedIn ?? false;

	return (
		<>
			<LandingHero
				isSignedIn={isSignedIn}
				badge="Comparison"
				title={
					<>
						Uptime vs{" "}
						<strong className="text-primary-600 dark:text-primary-400">UptimeRobot</strong>
					</>
				}
				description="A modern alternative with transparent, usage-based pricing. Pay only for what you use instead of fixed tiers."
				highlights={["Usage-based pricing", "9 global regions", "Unlimited team members"]}
				ctaOut="Try Uptime Free"
				secondaryCta={{ label: "See Comparison", href: "#comparison" }}
			/>

			<div id="comparison">
				<ComparisonTable />
			</div>

			<WhySwitchSection />

			<PricingComparisonSection />

			<MigrationCTASection isSignedIn={isSignedIn} />

			<LandingFAQ
				title="Common questions"
				description="Answers to questions about switching from UptimeRobot."
				items={[
					{
						question: "Can I import my monitors from UptimeRobot?",
						answer:
							"Currently, you'll need to manually recreate your monitors in Uptime. The setup process is quick - most users have all their monitors configured in under 10 minutes.",
					},
					{
						question: "How does usage-based pricing compare to UptimeRobot's tiers?",
						answer:
							"With UptimeRobot, you pay for a tier whether you use all the monitors or not. With Uptime, you pay $5/month base plus $0.001 per ping. For most users with 10-50 monitors, this works out cheaper than equivalent UptimeRobot tiers.",
					},
					{
						question: "What if I only need a few monitors?",
						answer:
							"If you have very few monitors and don't mind 5-minute intervals, UptimeRobot's free tier might work for you. Uptime offers free manual pings, with paid automatic monitoring starting at $5/month.",
					},
					{
						question: "Do you support the same check types?",
						answer:
							"Yes, Uptime supports HTTP/HTTPS monitoring, keyword monitoring, SSL certificate monitoring, and DNS monitoring - all the essential check types you'd use with UptimeRobot.",
					},
					{
						question: "What about status pages?",
						answer:
							"Status pages are included with Uptime at no extra cost. You can create public status pages to keep your users informed about service health.",
					},
					{
						question: "How do alerts compare?",
						answer:
							"Uptime offers native Slack and Discord integrations, plus webhook support for custom integrations. You'll receive instant notifications when monitors detect issues.",
					},
				]}
			/>

			<LandingFinalCTA
				isSignedIn={isSignedIn}
				title="Ready to make the switch?"
				description="Join teams who've moved to transparent, usage-based monitoring."
				ctaOut="Start Free Today"
			/>
		</>
	);
}
