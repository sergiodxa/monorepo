import { Badge, Card } from "@pkg/ui";
import {
	AlertTriangleIcon,
	CheckIcon,
	DollarSignIcon,
	GlobeIcon,
	MinusIcon,
	SparklesIcon,
	XIcon,
	ZapIcon,
} from "lucide-react";
import { useRouteLoaderData } from "react-router";

import { LandingFAQ, LandingFinalCTA, LandingHero } from "~/components/landing";

import type { Route } from "./+types/_landing.vs.pingdom";
import type { loader as landingLoader } from "./_landing";

export function meta({ data }: Route.MetaArgs) {
	return data.meta;
}

export function loader() {
	return {
		meta: [
			{ title: "Uptime vs Pingdom | Compare Uptime Monitoring Tools" },
			{
				name: "description",
				content:
					"Compare Uptime and Pingdom side by side. Enterprise-grade monitoring without the enterprise price tag. See features, pricing, and find out which is right for you.",
			},
		],
	};
}

interface ComparisonRow {
	feature: string;
	uptime: string | boolean;
	pingdom: string | boolean;
	uptimeNote?: string;
	pingdomNote?: string;
}

let comparisonData: ComparisonRow[] = [
	{ feature: "Starting price", uptime: "$5/mo", pingdom: "$15/mo" },
	{ feature: "Pricing model", uptime: "Usage-based", pingdom: "Per-check tiers" },
	{ feature: "Check intervals", uptime: "1-60 minutes", pingdom: "1 minute" },
	{
		feature: "Status pages",
		uptime: true,
		pingdom: false,
		uptimeNote: "Included",
		pingdomNote: "Separate product",
	},
	{ feature: "SSL monitoring", uptime: true, pingdom: true },
	{
		feature: "DNS monitoring",
		uptime: true,
		pingdom: "Limited",
		uptimeNote: "Included",
		pingdomNote: "Limited",
	},
	{ feature: "Keyword monitoring", uptime: true, pingdom: true },
	{
		feature: "Real User Monitoring",
		uptime: false,
		pingdom: true,
		uptimeNote: "Not included",
		pingdomNote: "Available (extra $)",
	},
	{
		feature: "Transaction monitoring",
		uptime: false,
		pingdom: true,
		uptimeNote: "Not included",
		pingdomNote: "Available (extra $)",
	},
	{ feature: "Team seats", uptime: "Unlimited", pingdom: "Unlimited" },
	{ feature: "Global regions", uptime: "9", pingdom: "100+" },
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
	if (value === "Limited") {
		return (
			<span className="flex items-center justify-center gap-2 text-warning-600 dark:text-warning-400">
				<MinusIcon className="size-5" />
				<span>{value}</span>
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
						See how Uptime and Pingdom stack up across key features.
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
									Pingdom
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
										<ComparisonCell value={row.pingdom} note={row.pingdomNote} />
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
			icon: <DollarSignIcon className="size-6" />,
			title: "10x more affordable for most use cases",
			description:
				"Our usage-based pricing means you only pay for what you use. No wasted money on unused tiers.",
		},
		{
			icon: <CheckIcon className="size-6" />,
			title: "No hidden fees or add-on products",
			description:
				"Status pages included. No separate products to buy. Everything you need in one place.",
		},
		{
			icon: <SparklesIcon className="size-6" />,
			title: "Simple, transparent pricing",
			description:
				"$5/mo base includes 5,000 pings. Additional pings at $0.001 each. No complicated tiers.",
		},
		{
			icon: <ZapIcon className="size-6" />,
			title: "Modern interface built for developers",
			description:
				"Clean, fast dashboard with visual heatmaps, API access, and webhook integrations.",
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
						Uptime delivers enterprise-grade monitoring at a fraction of the cost.
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

function WhenPingdomBetter() {
	let reasons = [
		{
			title: "If you need Real User Monitoring (RUM)",
			description:
				"Pingdom offers Real User Monitoring to track actual user experience metrics. Uptime focuses on synthetic monitoring only.",
		},
		{
			title: "If you need 100+ probe locations",
			description:
				"Pingdom has over 100 probe locations globally. Uptime currently offers 9 regions, which covers most use cases but may not be enough for highly distributed applications.",
		},
		{
			title: "If you need complex transaction monitoring",
			description:
				"Pingdom offers transaction monitoring for multi-step user flows. If you need to monitor login sequences or checkout processes, Pingdom may be a better fit.",
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
						When Pingdom might be better
					</h2>
					<p className="mt-4 text-lg text-neutral-600 dark:text-neutral-400">
						We believe in being transparent. Here's when Pingdom could be the right choice.
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
			scenario: "10 monitors, basic uptime checks",
			pingdom: "$15/mo",
			uptime: "~$7/mo",
			savings: "53%",
		},
		{
			scenario: "25 monitors, 5-minute intervals",
			pingdom: "$29/mo",
			uptime: "~$12/mo",
			savings: "59%",
		},
		{
			scenario: "50 monitors, mixed intervals",
			pingdom: "$89/mo",
			uptime: "~$20/mo",
			savings: "78%",
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
									Pingdom
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
										{row.pingdom}
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
						Ready to switch from Pingdom?
					</h2>
					<p className="mx-auto mt-4 max-w-2xl text-lg text-primary-100">
						Migration is simple. Set up your monitors in minutes and start saving immediately.
						Cancel Pingdom once you're satisfied.
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

export default function VsPingdomPage() {
	let parentData = useRouteLoaderData<typeof landingLoader>("routes/_landing");
	let isSignedIn = parentData?.isSignedIn ?? false;

	return (
		<>
			<LandingHero
				isSignedIn={isSignedIn}
				badge="Uptime vs Pingdom"
				title={
					<>
						Enterprise monitoring.{" "}
						<strong className="text-primary-600 dark:text-primary-400">Startup pricing.</strong>
					</>
				}
				description="Enterprise-grade monitoring without the enterprise price tag. See how Uptime compares to Pingdom."
				ctaOut="Try Uptime Free"
				secondaryCta={{ label: "See Comparison", href: "#comparison" }}
				highlights={["Starting at $5/mo", "Status pages included", "No credit card required"]}
			/>

			<div id="comparison">
				<ComparisonTable />
			</div>

			<WhyChooseUptime />

			<WhenPingdomBetter />

			<PricingComparison />

			<MigrationCTA isSignedIn={isSignedIn} />

			<LandingFAQ
				badge="FAQ"
				title="Common questions"
				description="Answers to frequently asked questions about switching from Pingdom."
				items={[
					{
						question: "How does Uptime's pricing compare to Pingdom?",
						answer:
							"Uptime starts at $5/mo with usage-based pricing, while Pingdom starts at $15/mo with tier-based pricing. For most use cases, Uptime costs 50-80% less than Pingdom.",
					},
					{
						question: "Can I migrate my monitors from Pingdom?",
						answer:
							"Yes! While we don't have an automated import tool, setting up monitors in Uptime takes just minutes. Simply create new monitors with the same URLs and settings.",
					},
					{
						question: "Does Uptime have as many probe locations as Pingdom?",
						answer:
							"No, Pingdom has 100+ locations while Uptime has 9 global regions. For most applications, 9 regions provide sufficient coverage, but if you need extensive geographic distribution, Pingdom may be better.",
					},
					{
						question: "What about Real User Monitoring (RUM)?",
						answer:
							"Uptime focuses on synthetic monitoring and doesn't offer RUM. If you need to track actual user experience metrics, Pingdom's RUM feature (available at extra cost) might be what you need.",
					},
					{
						question: "Are status pages included with Uptime?",
						answer:
							"Yes! Status pages are included at no extra cost. With Pingdom, status pages are a separate product (Pingdom Public Status Page) that costs additional money.",
					},
					{
						question: "How do check intervals compare?",
						answer:
							"Both Uptime and Pingdom support 1-minute check intervals. Uptime also offers flexibility with intervals up to 60 minutes, which can help reduce costs for less critical monitors.",
					},
					{
						question: "Is there a free trial?",
						answer:
							"Uptime offers free manual checks without a credit card. You can test the platform and only need to subscribe when you want automated, scheduled monitoring.",
					},
					{
						question: "What if I need features Uptime doesn't have?",
						answer:
							"We're transparent about our limitations. If you need RUM, transaction monitoring, or 100+ probe locations, Pingdom may be a better fit for your needs. We'd rather you choose the right tool than be unhappy.",
					},
				]}
			/>

			<LandingFinalCTA
				isSignedIn={isSignedIn}
				title="Ready to save on monitoring?"
				description="Join thousands of developers who switched to Uptime for better value without compromising on reliability."
				ctaOut="Start Free Trial"
			/>
		</>
	);
}
