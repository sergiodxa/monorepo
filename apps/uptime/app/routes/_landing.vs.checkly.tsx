import { Badge, Card } from "@pkg/ui";
import {
	AlertTriangleIcon,
	CheckIcon,
	CodeIcon,
	DollarSignIcon,
	MinusIcon,
	MousePointerClickIcon,
	UsersIcon,
	XIcon,
	ZapIcon,
} from "lucide-react";
import { useRouteLoaderData } from "react-router";

import { LandingFAQ, LandingFinalCTA, LandingHero } from "~/components/landing";

import type { Route } from "./+types/_landing.vs.checkly";
import type { loader as landingLoader } from "./_landing";

export function meta({ data }: Route.MetaArgs) {
	return data.meta;
}

export function loader() {
	return {
		meta: [
			{ title: "Uptime vs Checkly | Simple Uptime Monitoring Without the Code" },
			{
				name: "description",
				content:
					"Compare Uptime and Checkly side by side. Simple uptime monitoring without the code. See features, pricing, and find out which is right for you.",
			},
		],
	};
}

interface ComparisonRow {
	feature: string;
	uptime: string | boolean;
	checkly: string | boolean;
	uptimeNote?: string;
	checklyNote?: string;
}

let comparisonData: ComparisonRow[] = [
	{ feature: "Starting price", uptime: "$5/mo", checkly: "$24/mo (Starter)" },
	{
		feature: "Free tier",
		uptime: "Manual pings",
		checkly: "10 monitors",
		uptimeNote: "No credit card",
		checklyNote: "Limited features",
	},
	{ feature: "Setup approach", uptime: "No-code UI", checkly: "Monitoring as Code" },
	{
		feature: "Playwright tests",
		uptime: false,
		checkly: true,
		uptimeNote: "Not included",
		checklyNote: "Core feature",
	},
	{
		feature: "API monitoring",
		uptime: "HTTP checks",
		checkly: "Multi-step checks",
	},
	{ feature: "Status pages", uptime: true, checkly: true },
	{ feature: "SSL monitoring", uptime: true, checkly: true },
	{
		feature: "Terraform/Pulumi",
		uptime: false,
		checkly: true,
		uptimeNote: "Not included",
		checklyNote: "Full support",
	},
	{
		feature: "Visual regression",
		uptime: false,
		checkly: true,
		uptimeNote: "Not included",
		checklyNote: "Available",
	},
	{
		feature: "Team collaboration",
		uptime: "Unlimited",
		checkly: "Per-seat",
		uptimeNote: "All plans",
		checklyNote: "Extra cost",
	},
	{ feature: "Global regions", uptime: "9", checkly: "22" },
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
	return (
		<span className="flex flex-col items-center gap-1">
			<span>{value}</span>
			{note && <span className="text-xs text-neutral-500 dark:text-neutral-400">{note}</span>}
		</span>
	);
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
						See how Uptime and Checkly stack up across key features.
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
									Checkly
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
										<ComparisonCell value={row.checkly} note={row.checklyNote} />
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
			icon: <MousePointerClickIcon className="size-6" />,
			title: "No coding required",
			description:
				"Perfect for non-developers and teams without dedicated DevOps. Set up monitoring through our intuitive UI in minutes, not hours.",
		},
		{
			icon: <DollarSignIcon className="size-6" />,
			title: "5x more affordable entry point",
			description:
				"Start at $5/mo instead of $24/mo. Our usage-based pricing means you only pay for what you actually use.",
		},
		{
			icon: <ZapIcon className="size-6" />,
			title: "Simple to set up in minutes",
			description:
				"No need to learn a new DSL or set up CI/CD pipelines. Just enter your URLs and start monitoring immediately.",
		},
		{
			icon: <UsersIcon className="size-6" />,
			title: "Unlimited team members included",
			description:
				"Invite your whole team at no extra cost. Checkly charges per seat, which adds up quickly for larger teams.",
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
						Built for teams who want monitoring without DevOps complexity.
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

function WhenChecklyBetter() {
	let reasons = [
		{
			title: "If you need Playwright browser testing",
			description:
				"Checkly's core strength is browser-based testing with Playwright. If you need to test user flows, form submissions, or complex interactions, Checkly is purpose-built for this.",
		},
		{
			title: "If you prefer monitoring-as-code approach",
			description:
				"Checkly lets you define monitors in code and version control them alongside your application. This is ideal for teams with strong DevOps practices who want infrastructure-as-code.",
		},
		{
			title: "If you need complex multi-step API checks",
			description:
				"Checkly excels at chaining API calls together, extracting values between steps, and testing complex workflows. Uptime focuses on simpler HTTP health checks.",
		},
		{
			title: "If you want Terraform/Pulumi integration",
			description:
				"Checkly has first-class support for Terraform and Pulumi providers. If you're managing infrastructure as code, Checkly integrates seamlessly into your workflow.",
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
						When Checkly might be better
					</h2>
					<p className="mt-4 text-lg text-neutral-600 dark:text-neutral-400">
						We believe in being transparent. Here's when Checkly could be the right choice.
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

function TargetAudience() {
	return (
		<section className="scroll-mt-20 bg-neutral-50 py-16 sm:py-24 lg:py-32 dark:bg-neutral-900/50">
			<div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
				<div className="overflow-hidden rounded-2xl bg-gradient-to-br from-primary-600 to-primary-700 p-8 text-center shadow-xl sm:p-12">
					<div className="mx-auto flex size-16 items-center justify-center rounded-full bg-white/10">
						<CodeIcon className="size-8 text-white" />
					</div>
					<h2 className="mt-6 text-2xl font-bold text-white sm:text-3xl">
						Built for teams who want monitoring without DevOps complexity
					</h2>
					<p className="mx-auto mt-4 max-w-2xl text-lg text-primary-100">
						Checkly is powerful but requires coding skills and DevOps expertise. Uptime is designed
						for founders, marketers, product managers, and developers who want simple, reliable
						monitoring without the learning curve.
					</p>
					<div className="mt-8 flex flex-wrap justify-center gap-4 text-sm text-primary-100">
						<span className="rounded-full bg-white/10 px-4 py-2">Indie hackers</span>
						<span className="rounded-full bg-white/10 px-4 py-2">Small teams</span>
						<span className="rounded-full bg-white/10 px-4 py-2">Non-technical founders</span>
						<span className="rounded-full bg-white/10 px-4 py-2">Agencies</span>
					</div>
				</div>
			</div>
		</section>
	);
}

function PricingComparison() {
	let comparisons = [
		{
			scenario: "10 monitors, basic uptime checks",
			checkly: "$24/mo",
			uptime: "~$7/mo",
			savings: "71%",
		},
		{
			scenario: "25 monitors, 5-minute intervals",
			checkly: "$24/mo",
			uptime: "~$12/mo",
			savings: "50%",
		},
		{
			scenario: "50 monitors, mixed intervals",
			checkly: "$45/mo",
			uptime: "~$20/mo",
			savings: "56%",
		},
		{
			scenario: "Team of 5 people",
			checkly: "+$60/mo seats",
			uptime: "$0 extra",
			savings: "100%",
		},
	];

	return (
		<section className="scroll-mt-20 py-16 sm:py-24 lg:py-32">
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
									Checkly
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
										{row.checkly}
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
					* Estimates based on typical usage patterns. Checkly pricing based on Starter plan. Actual
					costs may vary.
				</p>
			</div>
		</section>
	);
}

export default function VsChecklyPage() {
	let parentData = useRouteLoaderData<typeof landingLoader>("routes/_landing");
	let isSignedIn = parentData?.isSignedIn ?? false;

	return (
		<>
			<LandingHero
				isSignedIn={isSignedIn}
				badge="Uptime vs Checkly"
				title={
					<>
						Simple uptime monitoring.{" "}
						<strong className="text-primary-600 dark:text-primary-400">Without the code.</strong>
					</>
				}
				description="Get reliable monitoring without learning a new DSL or setting up CI/CD pipelines. See how Uptime compares to Checkly."
				ctaOut="Try Uptime Free"
				secondaryCta={{ label: "See Comparison", href: "#comparison" }}
				highlights={["Starting at $5/mo", "No coding required", "Unlimited team members"]}
			/>

			<div id="comparison">
				<ComparisonTable />
			</div>

			<WhyChooseUptime />

			<WhenChecklyBetter />

			<TargetAudience />

			<PricingComparison />

			<LandingFAQ
				badge="FAQ"
				title="Common questions"
				description="Answers to frequently asked questions about Uptime vs Checkly."
				items={[
					{
						question: "What's the main difference between Uptime and Checkly?",
						answer:
							"Checkly is a developer-focused monitoring-as-code platform with Playwright browser testing at its core. Uptime is a no-code monitoring solution focused on simple uptime checks. Choose Checkly if you need browser testing and infrastructure-as-code; choose Uptime if you want simple, affordable monitoring without coding.",
					},
					{
						question: "How does pricing compare?",
						answer:
							"Uptime starts at $5/mo with usage-based pricing, while Checkly's Starter plan is $24/mo. Additionally, Checkly charges per team seat while Uptime includes unlimited team members. For basic uptime monitoring, Uptime typically costs 50-70% less.",
					},
					{
						question: "Do I need to write code to use Uptime?",
						answer:
							"No! Uptime is designed to be completely no-code. You can set up monitors, configure alerts, and create status pages entirely through our web interface. No programming, no CLI tools, no YAML files required.",
					},
					{
						question: "Can Uptime do browser testing like Checkly?",
						answer:
							"No, Uptime focuses on HTTP-based uptime monitoring, SSL checks, and keyword monitoring. If you need Playwright browser testing, visual regression testing, or complex multi-step user flow testing, Checkly is the better choice.",
					},
					{
						question: "What if I have a team of 10 people?",
						answer:
							"With Uptime, you get unlimited team members on all plans at no extra cost. With Checkly, you'd pay for additional seats beyond their base plan allowance, which can add $10-15 per user per month.",
					},
					{
						question: "Does Uptime support Terraform or Pulumi?",
						answer:
							"No, Uptime is designed as a UI-first tool without infrastructure-as-code integration. If you manage your infrastructure with Terraform or Pulumi and want your monitoring defined alongside it, Checkly's providers would be a better fit.",
					},
					{
						question: "Which should I choose as a non-technical founder?",
						answer:
							"Uptime is designed for you. You can set up monitoring in minutes without any technical knowledge. Checkly requires JavaScript/TypeScript knowledge and familiarity with testing concepts. If your site goes down, you want to know—you don't need complex browser testing for that.",
					},
					{
						question: "Can I migrate from Checkly to Uptime?",
						answer:
							"If you're only using Checkly for basic HTTP checks, yes! You can recreate those monitors in Uptime in minutes. However, if you rely on Checkly's Playwright tests or multi-step API checks, those features don't exist in Uptime.",
					},
				]}
			/>

			<LandingFinalCTA
				isSignedIn={isSignedIn}
				title="Ready for simpler monitoring?"
				description="Join thousands of teams who chose simplicity over complexity. Start monitoring in minutes, not hours."
				ctaOut="Start Free Trial"
			/>
		</>
	);
}
