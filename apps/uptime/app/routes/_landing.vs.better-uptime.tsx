import { Badge, Card } from "@pkg/ui";
import {
	ArrowRightIcon,
	CheckIcon,
	DollarSignIcon,
	GlobeIcon,
	MinusIcon,
	TargetIcon,
	UsersIcon,
	XIcon,
	ZapIcon,
} from "lucide-react";
import { href, Link, useRouteLoaderData } from "react-router";

import { LandingFinalCTA } from "~/components/landing";

import type { Route } from "./+types/_landing.vs.better-uptime";
import type { loader as landingLoader } from "./_landing";

export function meta({ data }: Route.MetaArgs) {
	return data.meta;
}

export function loader() {
	return {
		meta: [
			{ title: "Uptime vs Better Uptime | Feature Comparison" },
			{
				name: "description",
				content:
					"Compare Uptime vs Better Uptime (BetterStack). See how our focused monitoring solution compares to their full observability platform. Starting at $5/mo vs $29/mo.",
			},
		],
	};
}

const comparisonData = [
	{ feature: "Starting price", uptime: "$5/mo", betterUptime: "$29/mo" },
	{ feature: "Free tier", uptime: "Manual pings", betterUptime: "10 monitors" },
	{ feature: "Pricing model", uptime: "Usage-based", betterUptime: "Per-responder" },
	{ feature: "Uptime monitoring", uptime: true, betterUptime: true },
	{ feature: "Status pages", uptime: true, betterUptime: true },
	{ feature: "Incident management", uptime: "Basic", betterUptime: "Advanced" },
	{ feature: "On-call scheduling", uptime: false, betterUptime: true },
	{ feature: "Log management", uptime: false, betterUptime: true },
	{ feature: "Traces/APM", uptime: false, betterUptime: true },
	{ feature: "SSL monitoring", uptime: true, betterUptime: true },
	{ feature: "Team collaboration", uptime: "Unlimited", betterUptime: "Per-seat pricing" },
	{ feature: "Global regions", uptime: "9", betterUptime: "Multiple" },
];

function ComparisonValue({ value }: { value: boolean | string }) {
	if (value === true) {
		return <CheckIcon className="mx-auto size-5 text-success-600 dark:text-success-400" />;
	}
	if (value === false) {
		return <XIcon className="mx-auto size-5 text-neutral-400 dark:text-neutral-600" />;
	}
	return <span>{value}</span>;
}

export default function VsBetterUptimePage() {
	let parentData = useRouteLoaderData<typeof landingLoader>("routes/_landing");
	let isSignedIn = parentData?.isSignedIn ?? false;

	return (
		<>
			{/* Hero Section */}
			<section className="relative overflow-hidden bg-gradient-to-b from-primary-50 to-white py-16 sm:py-24 lg:py-32 dark:from-primary-950/20 dark:to-neutral-950">
				<div aria-hidden className="absolute inset-0 overflow-hidden">
					<div className="absolute top-0 left-1/2 size-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-100/50 blur-3xl dark:bg-primary-900/20" />
				</div>

				<div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
					<Badge color="primary" variant="secondary" className="mb-6">
						Comparison
					</Badge>

					<h1 className="text-4xl font-bold tracking-tight text-neutral-900 sm:text-5xl lg:text-6xl dark:text-neutral-50">
						Uptime vs Better Uptime
					</h1>

					<p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-neutral-600 dark:text-neutral-400">
						Focused monitoring without the complexity. See how Uptime compares to Better Uptime
						(BetterStack) and find the right fit for your needs.
					</p>

					<div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
						<Link
							to={isSignedIn ? href("/app") : href("/auth")}
							reloadDocument={!isSignedIn}
							className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-3 text-base font-semibold text-white shadow-lg transition hover:bg-primary-700 hover:shadow-xl"
						>
							{isSignedIn ? "Open Dashboard" : "Try Uptime Free"}
							<ArrowRightIcon className="size-5" />
						</Link>
						<a
							href="/#pricing"
							className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-6 py-3 text-base font-semibold text-neutral-700 shadow-sm transition hover:bg-neutral-50 hover:shadow-md dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
						>
							View Pricing
						</a>
					</div>
				</div>
			</section>

			{/* Feature Comparison Table */}
			<section className="py-16 sm:py-24">
				<div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
					<div className="mx-auto max-w-2xl text-center">
						<Badge color="primary" variant="secondary" className="mb-4">
							Feature Comparison
						</Badge>
						<h2 className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl dark:text-neutral-50">
							Side-by-side comparison
						</h2>
						<p className="mt-4 text-lg text-neutral-600 dark:text-neutral-400">
							Compare features, pricing, and capabilities between Uptime and Better Uptime.
						</p>
					</div>

					<div className="mt-12 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
						<table className="w-full">
							<thead>
								<tr className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900/50">
									<th className="px-6 py-4 text-left text-sm font-semibold text-neutral-900 dark:text-neutral-100">
										Feature
									</th>
									<th className="px-6 py-4 text-center text-sm font-semibold text-primary-600 dark:text-primary-400">
										Uptime
									</th>
									<th className="px-6 py-4 text-center text-sm font-semibold text-neutral-600 dark:text-neutral-400">
										Better Uptime
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
								{comparisonData.map((row) => (
									<tr
										key={row.feature}
										className="transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
									>
										<td className="px-6 py-4 text-sm font-medium text-neutral-900 dark:text-neutral-100">
											{row.feature}
										</td>
										<td className="px-6 py-4 text-center text-sm text-neutral-600 dark:text-neutral-400">
											<ComparisonValue value={row.uptime} />
										</td>
										<td className="px-6 py-4 text-center text-sm text-neutral-600 dark:text-neutral-400">
											<ComparisonValue value={row.betterUptime} />
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			</section>

			{/* Why Choose Uptime */}
			<section className="bg-neutral-50 py-16 sm:py-24 dark:bg-neutral-900/50">
				<div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
					<div className="mx-auto max-w-2xl text-center">
						<Badge color="success" variant="secondary" className="mb-4">
							Why Uptime
						</Badge>
						<h2 className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl dark:text-neutral-50">
							Why choose Uptime?
						</h2>
						<p className="mt-4 text-lg text-neutral-600 dark:text-neutral-400">
							We focus on doing one thing exceptionally well: uptime monitoring.
						</p>
					</div>

					<div className="mt-12 grid gap-8 md:grid-cols-2">
						<Card className="transition-shadow hover:shadow-lg">
							<Card.Header>
								<div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-success-100 text-success-600 dark:bg-success-900/50 dark:text-success-400">
									<TargetIcon className="size-6" />
								</div>
								<Card.Title className="text-xl">Focused on monitoring</Card.Title>
							</Card.Header>
							<Card.Content className="pt-0">
								<p className="text-neutral-600 dark:text-neutral-400">
									We do one thing and do it well. No feature bloat, no complexity—just reliable
									uptime monitoring that works.
								</p>
							</Card.Content>
						</Card>

						<Card className="transition-shadow hover:shadow-lg">
							<Card.Header>
								<div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-success-100 text-success-600 dark:bg-success-900/50 dark:text-success-400">
									<DollarSignIcon className="size-6" />
								</div>
								<Card.Title className="text-xl">6x more affordable</Card.Title>
							</Card.Header>
							<Card.Content className="pt-0">
								<p className="text-neutral-600 dark:text-neutral-400">
									Start at $5/mo instead of $29/mo. Our usage-based pricing means you only pay for
									what you actually use.
								</p>
							</Card.Content>
						</Card>

						<Card className="transition-shadow hover:shadow-lg">
							<Card.Header>
								<div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-success-100 text-success-600 dark:bg-success-900/50 dark:text-success-400">
									<UsersIcon className="size-6" />
								</div>
								<Card.Title className="text-xl">No per-seat pricing</Card.Title>
							</Card.Header>
							<Card.Content className="pt-0">
								<p className="text-neutral-600 dark:text-neutral-400">
									Invite your entire team without worrying about escalating costs. Unlimited team
									members included.
								</p>
							</Card.Content>
						</Card>

						<Card className="transition-shadow hover:shadow-lg">
							<Card.Header>
								<div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-success-100 text-success-600 dark:bg-success-900/50 dark:text-success-400">
									<ZapIcon className="size-6" />
								</div>
								<Card.Title className="text-xl">Simple to use</Card.Title>
							</Card.Header>
							<Card.Content className="pt-0">
								<p className="text-neutral-600 dark:text-neutral-400">
									Set up a monitor in under 2 minutes. No complex configuration or DevOps expertise
									required.
								</p>
							</Card.Content>
						</Card>
					</div>
				</div>
			</section>

			{/* When Better Uptime Might Be Better */}
			<section className="py-16 sm:py-24">
				<div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
					<div className="mx-auto max-w-2xl text-center">
						<Badge color="neutral" variant="secondary" className="mb-4">
							Honest Assessment
						</Badge>
						<h2 className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl dark:text-neutral-50">
							When Better Uptime might be better
						</h2>
						<p className="mt-4 text-lg text-neutral-600 dark:text-neutral-400">
							We believe in being upfront. Here's when their platform might be a better fit.
						</p>
					</div>

					<div className="mt-12 space-y-4">
						{[
							{
								title: "You need a full observability platform",
								description:
									"If you need logs, traces, and APM in one place, Better Uptime's broader BetterStack platform offers these features.",
							},
							{
								title: "You need advanced on-call scheduling",
								description:
									"Better Uptime includes sophisticated on-call scheduling and escalation policies that we don't offer.",
							},
							{
								title: "You want one platform for everything",
								description:
									"If consolidating all your monitoring, logging, and incident management tools is a priority, their all-in-one approach may suit you better.",
							},
						].map((item) => (
							<div
								key={item.title}
								className="rounded-lg border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-900"
							>
								<div className="flex items-start gap-4">
									<div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
										<MinusIcon className="size-4 text-neutral-500" />
									</div>
									<div>
										<h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
											{item.title}
										</h3>
										<p className="mt-1 text-neutral-600 dark:text-neutral-400">
											{item.description}
										</p>
									</div>
								</div>
							</div>
						))}
					</div>
				</div>
			</section>

			{/* Positioning Section */}
			<section className="bg-primary-50 py-16 sm:py-24 dark:bg-primary-950/20">
				<div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
					<h2 className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl dark:text-neutral-50">
						Perfect for teams that already have their stack
					</h2>
					<p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-600 dark:text-neutral-400">
						If you just need monitoring—not a full observability platform—Uptime is the focused,
						affordable choice. Great for teams that already use Datadog, Grafana, or other tools for
						logging and APM.
					</p>

					<div className="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-4 text-sm text-neutral-500 dark:text-neutral-400">
						<div className="flex items-center gap-2">
							<CheckIcon className="size-5 text-success-500" />
							<span>Works alongside your existing tools</span>
						</div>
						<div className="flex items-center gap-2">
							<CheckIcon className="size-5 text-success-500" />
							<span>No vendor lock-in</span>
						</div>
						<div className="flex items-center gap-2">
							<CheckIcon className="size-5 text-success-500" />
							<span>API-first design</span>
						</div>
					</div>
				</div>
			</section>

			{/* Pricing Comparison */}
			<section className="py-16 sm:py-24">
				<div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
					<div className="mx-auto max-w-2xl text-center">
						<Badge color="primary" variant="secondary" className="mb-4">
							Pricing
						</Badge>
						<h2 className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl dark:text-neutral-50">
							Simple, transparent pricing
						</h2>
						<p className="mt-4 text-lg text-neutral-600 dark:text-neutral-400">
							See how the costs compare for typical usage scenarios.
						</p>
					</div>

					<div className="mt-12 grid gap-8 md:grid-cols-2">
						{/* Uptime Pricing Card */}
						<div className="relative overflow-hidden rounded-2xl border-2 border-primary-500 bg-white p-8 shadow-xl dark:bg-neutral-900">
							<div className="absolute top-0 right-0 rounded-bl-lg bg-primary-500 px-3 py-1 text-xs font-semibold text-white">
								Recommended
							</div>
							<div className="text-center">
								<h3 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
									Uptime
								</h3>
								<div className="mt-4">
									<span className="text-5xl font-bold text-primary-600 dark:text-primary-400">
										$5
									</span>
									<span className="text-neutral-600 dark:text-neutral-400">/month</span>
								</div>
								<p className="mt-2 text-sm text-neutral-500 dark:text-neutral-500">
									Includes 5,000 pings
								</p>
							</div>
							<ul className="mt-8 space-y-3">
								{[
									"Unlimited monitors",
									"Unlimited team members",
									"9 global regions",
									"Usage-based pricing",
									"Status pages included",
									"API access",
								].map((feature) => (
									<li key={feature} className="flex items-center gap-3">
										<CheckIcon className="size-5 shrink-0 text-success-500" />
										<span className="text-neutral-600 dark:text-neutral-400">{feature}</span>
									</li>
								))}
							</ul>
						</div>

						{/* Better Uptime Pricing Card */}
						<div className="rounded-2xl border border-neutral-200 bg-white p-8 shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
							<div className="text-center">
								<h3 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
									Better Uptime
								</h3>
								<div className="mt-4">
									<span className="text-5xl font-bold text-neutral-600 dark:text-neutral-400">
										$29
									</span>
									<span className="text-neutral-600 dark:text-neutral-400">/month</span>
								</div>
								<p className="mt-2 text-sm text-neutral-500 dark:text-neutral-500">
									Per team member (responder)
								</p>
							</div>
							<ul className="mt-8 space-y-3">
								{[
									"Unlimited monitors",
									"On-call scheduling",
									"Incident management",
									"Status pages",
									"Log management (separate)",
									"APM (separate)",
								].map((feature) => (
									<li key={feature} className="flex items-center gap-3">
										<CheckIcon className="size-5 shrink-0 text-neutral-400" />
										<span className="text-neutral-600 dark:text-neutral-400">{feature}</span>
									</li>
								))}
							</ul>
						</div>
					</div>
				</div>
			</section>

			{/* Migration CTA */}
			<section className="border-t border-neutral-200 bg-neutral-50 py-16 sm:py-24 dark:border-neutral-800 dark:bg-neutral-900/50">
				<div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
					<GlobeIcon className="mx-auto size-12 text-primary-500" />
					<h2 className="mt-6 text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl dark:text-neutral-50">
						Ready to make the switch?
					</h2>
					<p className="mx-auto mt-4 max-w-2xl text-lg text-neutral-600 dark:text-neutral-400">
						Migrate from Better Uptime in minutes. Our simple setup means you can be up and running
						with all your monitors in no time.
					</p>
					<div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
						<Link
							to={isSignedIn ? href("/app") : href("/auth")}
							reloadDocument={!isSignedIn}
							className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-8 py-4 text-lg font-semibold text-white shadow-lg transition hover:bg-primary-700 hover:shadow-xl"
						>
							{isSignedIn ? "Open Dashboard" : "Start Your Migration"}
							<ArrowRightIcon className="size-5" />
						</Link>
					</div>
					<p className="mt-4 text-sm text-neutral-500 dark:text-neutral-400">
						No credit card required to start. Free manual pings included.
					</p>
				</div>
			</section>

			{/* Final CTA */}
			<LandingFinalCTA
				isSignedIn={isSignedIn}
				title="Focused monitoring, fair pricing"
				description="Join teams who chose simplicity over complexity. Start monitoring in under 2 minutes."
				ctaOut="Get Started Free"
			/>
		</>
	);
}
