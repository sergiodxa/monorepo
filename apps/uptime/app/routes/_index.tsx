import { cn } from "@pkg/cn";
import { Accordion, Badge, Card, Separator } from "@pkg/ui";
import {
	ActivityIcon,
	ArrowRightIcon,
	BellIcon,
	CheckIcon,
	ChevronDownIcon,
	CreditCardIcon,
	GlobeIcon,
	PlusIcon,
	ShieldCheckIcon,
	XIcon,
	ZapIcon,
} from "lucide-react";
import { useState } from "react";
import { Label, Slider, SliderOutput, SliderThumb, SliderTrack } from "react-aria-components";
import { Trans, useTranslation } from "react-i18next";
import { href, Link } from "react-router";

import screenshotDark from "~/assets/screenshot-dark.webp";
import screenshotLight from "~/assets/screenshot-light.webp";
import Logo from "~/components/logo";
import { i18next } from "~/middleware/i18next";
import { getSession } from "~/middleware/session";

import type { Route } from "./+types/_index";

export const meta: Route.MetaFunction = ({ data }) => data?.meta ?? [];

export const links: Route.LinksFunction = () => [
	{
		rel: "preload",
		href: screenshotLight,
		as: "image",
		media: "(prefers-color-scheme: light)",
	},
	{
		rel: "preload",
		href: screenshotDark,
		as: "image",
		media: "(prefers-color-scheme: dark)",
	},
];

export async function loader({ request, context }: Route.LoaderArgs) {
	let { t } = i18next(context);
	let session = getSession();

	return {
		isSignedIn: session.has("id"),
		initialMonitors: [{ id: crypto.randomUUID(), frequency: 10 }],

		meta: [
			{ title: t("landing.meta.title") },
			{ name: "description", content: t("landing.meta.description") },
			{ name: "og:title", content: t("landing.meta.title") },
			{ name: "og:description", content: t("landing.meta.description") },
			{ name: "og:type", content: "website" },
			{ name: "og:url", content: request.url },
			{ name: "twitter:card", content: "summary" },
		] satisfies Route.MetaDescriptors,
	};
}

export default function Landing({ loaderData }: Route.ComponentProps) {
	return (
		<div className="min-h-screen bg-white dark:bg-neutral-950">
			<Header isSignedIn={loaderData.isSignedIn} />
			<main>
				<Hero isSignedIn={loaderData.isSignedIn} />
				<TrustIndicators />
				<Features />
				<Pricing initialMonitors={loaderData.initialMonitors} />
				<FAQ />
			</main>
			<Footer />
		</div>
	);
}

function Header(props: { isSignedIn: boolean }) {
	let { t } = useTranslation("translation", { keyPrefix: "landing.header" });

	return (
		<header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/80 backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-950/80">
			<div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
				<div className="flex items-center gap-8">
					<Link to={href("/")} className="flex items-center gap-2 no-underline">
						<Logo className="size-9 text-primary-500" />
						<span className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
							{t("title")}
						</span>
					</Link>

					<nav className="hidden items-center gap-6 md:flex">
						<a
							href="#features"
							className="text-sm font-medium text-neutral-600 transition hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
						>
							{t("nav.features")}
						</a>
						<a
							href="#pricing"
							className="text-sm font-medium text-neutral-600 transition hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
						>
							{t("nav.pricing")}
						</a>
						<a
							href="#faq"
							className="text-sm font-medium text-neutral-600 transition hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
						>
							FAQ
						</a>
					</nav>
				</div>

				<Link
					to={props.isSignedIn ? href("/app") : href("/auth")}
					reloadDocument={!props.isSignedIn}
					className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-primary-700 hover:shadow-md"
				>
					{props.isSignedIn ? t("nav.cta.in") : t("nav.cta.out")}
					<ArrowRightIcon className="size-4" />
				</Link>
			</div>
		</header>
	);
}

function Hero(props: { isSignedIn: boolean }) {
	let { t } = useTranslation("translation", { keyPrefix: "landing.hero" });

	return (
		<section className="relative overflow-hidden bg-gradient-to-b from-primary-50 to-white py-16 sm:py-24 lg:py-32 dark:from-primary-950/20 dark:to-neutral-950">
			{/* Background decoration */}
			<div aria-hidden className="absolute inset-0 overflow-hidden">
				<div className="absolute top-0 left-1/2 size-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-100/50 blur-3xl dark:bg-primary-900/20" />
			</div>

			<div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
				<div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
					<div className="flex flex-col items-center text-center lg:items-start lg:text-left">
						<Badge color="primary" variant="secondary" className="mb-6">
							{t("pill")}
						</Badge>

						<Trans
							parent="h1"
							t={t}
							i18nKey="title"
							className="text-4xl font-bold tracking-tight text-neutral-900 sm:text-5xl lg:text-6xl dark:text-neutral-50"
							components={{
								strong: <strong className="text-primary-600 dark:text-primary-400" />,
							}}
						/>

						<p className="mt-6 max-w-xl text-lg leading-relaxed text-neutral-600 dark:text-neutral-400">
							{t("description")}
						</p>

						<div className="mt-8 flex flex-col items-center gap-4 sm:flex-row">
							<Link
								to={props.isSignedIn ? href("/app") : href("/auth")}
								reloadDocument={!props.isSignedIn}
								className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-3 text-base font-semibold text-white shadow-lg transition hover:bg-primary-700 hover:shadow-xl"
							>
								{props.isSignedIn ? t("cta.in") : t("cta.out")}
								<ArrowRightIcon className="size-5" />
							</Link>
							<a
								href="#pricing"
								className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-6 py-3 text-base font-semibold text-neutral-700 shadow-sm transition hover:bg-neutral-50 hover:shadow-md dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
							>
								{t("cta.pricing")}
							</a>
						</div>

						<div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-neutral-500 lg:justify-start dark:text-neutral-400">
							<div className="flex items-center gap-2">
								<CheckIcon className="size-4 text-success-500" />
								<span>Free to start</span>
							</div>
							<div className="flex items-center gap-2">
								<CheckIcon className="size-4 text-success-500" />
								<span>Pay for automation</span>
							</div>
							<div className="flex items-center gap-2">
								<CheckIcon className="size-4 text-success-500" />
								<span>Cancel anytime</span>
							</div>
						</div>
					</div>

					<div className="relative">
						<div className="absolute -inset-4 rounded-2xl bg-gradient-to-tr from-primary-500/20 to-primary-300/20 blur-2xl dark:from-primary-500/10 dark:to-primary-700/10" />
						<picture className="relative block overflow-hidden rounded-xl shadow-2xl ring-1 ring-neutral-200/50 dark:ring-neutral-800/50">
							<source media="(prefers-color-scheme: dark)" srcSet={screenshotDark} />
							<source media="(prefers-color-scheme: light)" srcSet={screenshotLight} />
							<img src={screenshotLight} alt={t("screenshot.alt")} className="h-auto w-full" />
						</picture>
					</div>
				</div>
			</div>
		</section>
	);
}

function TrustIndicators() {
	return (
		<section className="border-y border-neutral-200 bg-neutral-50 py-8 dark:border-neutral-800 dark:bg-neutral-900/50">
			<div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
				<div className="grid grid-cols-2 gap-8 md:grid-cols-4">
					<div className="flex flex-col items-center gap-2 text-center">
						<div className="flex items-center gap-1 text-3xl font-bold text-neutral-900 dark:text-neutral-50">
							<ZapIcon className="size-6 text-primary-500" />
							99.9%
						</div>
						<p className="text-sm text-neutral-600 dark:text-neutral-400">Uptime SLA</p>
					</div>
					<div className="flex flex-col items-center gap-2 text-center">
						<div className="flex items-center gap-1 text-3xl font-bold text-neutral-900 dark:text-neutral-50">
							<GlobeIcon className="size-6 text-primary-500" />9
						</div>
						<p className="text-sm text-neutral-600 dark:text-neutral-400">Global Regions</p>
					</div>
					<div className="flex flex-col items-center gap-2 text-center">
						<div className="flex items-center gap-1 text-3xl font-bold text-neutral-900 dark:text-neutral-50">
							<ShieldCheckIcon className="size-6 text-primary-500" />
							365
						</div>
						<p className="text-sm text-neutral-600 dark:text-neutral-400">Days Data Retention</p>
					</div>
					<div className="flex flex-col items-center gap-2 text-center">
						<div className="flex items-center gap-1 text-3xl font-bold text-neutral-900 dark:text-neutral-50">
							<BellIcon className="size-6 text-primary-500" />
							&lt;1s
						</div>
						<p className="text-sm text-neutral-600 dark:text-neutral-400">Alert Latency</p>
					</div>
				</div>
			</div>
		</section>
	);
}

function Features() {
	let { t } = useTranslation("translation", {
		keyPrefix: "landing.features",
	});

	let list = [
		{
			title: t("list.first.title"),
			description: t("list.first.description"),
			icon: <ActivityIcon className="size-6" />,
		},
		{
			title: t("list.second.title"),
			description: t("list.second.description"),
			icon: <BellIcon className="size-6" />,
		},
		{
			title: t("list.third.title"),
			description: t("list.third.description"),
			icon: <CreditCardIcon className="size-6" />,
		},
	] as const;

	return (
		<section id="features" className="scroll-mt-20 py-16 sm:py-24 lg:py-32">
			<div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
				<div className="mx-auto max-w-2xl text-center">
					<Badge color="primary" variant="secondary" className="mb-4">
						Features
					</Badge>
					<h2 className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl dark:text-neutral-50">
						{t("title")}
					</h2>
					<p className="mt-4 text-lg text-neutral-600 dark:text-neutral-400">{t("description")}</p>
				</div>

				<div className="mt-16 grid gap-8 md:grid-cols-3">
					{list.map((item) => (
						<Card key={item.title} className="transition-shadow hover:shadow-lg">
							<Card.Header>
								<div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-primary-100 text-primary-600 dark:bg-primary-900/50 dark:text-primary-400">
									{item.icon}
								</div>
								<Card.Title className="text-xl">{item.title}</Card.Title>
							</Card.Header>
							<Card.Content className="pt-0">
								<p className="text-neutral-600 dark:text-neutral-400">{item.description}</p>
							</Card.Content>
						</Card>
					))}
				</div>
			</div>
		</section>
	);
}

function Pricing(props: {
	initialMonitors: Array<{
		id: `${string}-${string}-${string}-${string}-${string}`;
		frequency: number;
	}>;
}) {
	let { t } = useTranslation("translation", { keyPrefix: "landing.pricing" });

	return (
		<section
			id="pricing"
			className="scroll-mt-20 bg-neutral-50 py-16 sm:py-24 lg:py-32 dark:bg-neutral-900/50"
		>
			<div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
				<div className="mx-auto max-w-2xl text-center">
					<Badge color="primary" variant="secondary" className="mb-4">
						Pricing
					</Badge>
					<h2 className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl dark:text-neutral-50">
						{t("title")}
					</h2>
					<p className="mt-4 text-lg text-neutral-600 dark:text-neutral-400">{t("description")}</p>
				</div>

				<div className="mt-16">
					<Calculator {...props} />
				</div>
			</div>
		</section>
	);
}

function FAQ() {
	let { t } = useTranslation("translation", { keyPrefix: "landing.faq" });

	let list = [
		{ q: t("list.first.q"), a: t("list.first.a") },
		{ q: t("list.second.q"), a: t("list.second.a") },
		{ q: t("list.third.q"), a: t("list.third.a") },
		{ q: t("list.fourth.q"), a: t("list.fourth.a") },
		{ q: t("list.fifth.q"), a: t("list.fifth.a") },
		{ q: t("list.sixth.q"), a: t("list.sixth.a") },
		{ q: t("list.seventh.q"), a: t("list.seventh.a") },
		{ q: t("list.eighth.q"), a: t("list.eighth.a") },
		{ q: t("list.ninth.q"), a: t("list.ninth.a") },
		{ q: t("list.tenth.q"), a: t("list.tenth.a") },
		{ q: t("list.eleventh.q"), a: t("list.eleventh.a") },
		{ q: t("list.twelfth.q"), a: t("list.twelfth.a") },
		{ q: t("list.thirteenth.q"), a: t("list.thirteenth.a") },
		{ q: t("list.fourteenth.q"), a: t("list.fourteenth.a") },
		{ q: t("list.fifteenth.q"), a: t("list.fifteenth.a") },
		{ q: t("list.sixteenth.q"), a: t("list.sixteenth.a") },
		{ q: t("list.seventeenth.q"), a: t("list.seventeenth.a") },
		{ q: t("list.eighteenth.q"), a: t("list.eighteenth.a") },
		{ q: t("list.nineteenth.q"), a: t("list.nineteenth.a") },
	] as const;

	let halfwayIndex = Math.ceil(list.length / 2);
	let firstHalf = list.slice(0, halfwayIndex);
	let secondHalf = list.slice(halfwayIndex);

	return (
		<section id="faq" className="scroll-mt-20 py-16 sm:py-24 lg:py-32">
			<div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
				<div className="mx-auto max-w-2xl text-center">
					<Badge color="primary" variant="secondary" className="mb-4">
						FAQ
					</Badge>
					<h2 className="text-3xl font-bold tracking-tight text-neutral-900 sm:text-4xl dark:text-neutral-50">
						{t("title")}
					</h2>
					<p className="mt-4 text-lg text-neutral-600 dark:text-neutral-400">{t("description")}</p>
				</div>

				<div className="mt-16 grid gap-8 lg:grid-cols-2">
					<Accordion type="multiple" className="flex flex-col gap-4">
						{firstHalf.map((item, index) => (
							<Accordion.Item
								key={`first-${index}`}
								value={`first-${index}`}
								className="overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
							>
								<Accordion.Trigger className="flex w-full items-center justify-between px-6 py-4 text-left font-semibold text-neutral-900 transition hover:bg-neutral-50 dark:text-neutral-50 dark:hover:bg-neutral-800">
									<span className="pr-4">{item.q}</span>
									<ChevronDownIcon className="size-5 shrink-0 text-neutral-500 transition-transform [[data-state=open]>&]:rotate-180" />
								</Accordion.Trigger>
								<Accordion.Content className="overflow-hidden pb-0 transition-all">
									<div className="border-t border-neutral-200 px-6 py-4 whitespace-pre-line text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
										{item.a}
									</div>
								</Accordion.Content>
							</Accordion.Item>
						))}
					</Accordion>

					<Accordion type="multiple" className="flex flex-col gap-4">
						{secondHalf.map((item, index) => (
							<Accordion.Item
								key={`second-${index}`}
								value={`second-${index}`}
								className="overflow-hidden rounded-lg border border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900"
							>
								<Accordion.Trigger className="flex w-full items-center justify-between px-6 py-4 text-left font-semibold text-neutral-900 transition hover:bg-neutral-50 dark:text-neutral-50 dark:hover:bg-neutral-800">
									<span className="pr-4">{item.q}</span>
									<ChevronDownIcon className="size-5 shrink-0 text-neutral-500 transition-transform [[data-state=open]>&]:rotate-180" />
								</Accordion.Trigger>
								<Accordion.Content className="overflow-hidden pb-0 transition-all">
									<div className="border-t border-neutral-200 px-6 py-4 whitespace-pre-line text-neutral-600 dark:border-neutral-800 dark:text-neutral-400">
										{item.a}
									</div>
								</Accordion.Content>
							</Accordion.Item>
						))}
					</Accordion>
				</div>
			</div>
		</section>
	);
}

function Footer() {
	let { t } = useTranslation("translation", { keyPrefix: "landing.footer" });

	return (
		<footer className="border-t border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
			<div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
				<div className="flex flex-col items-center gap-8 sm:flex-row sm:items-start sm:justify-between">
					<div className="text-center sm:text-left">
						<Link to={href("/")} className="inline-flex items-center gap-2 no-underline">
							<Logo className="size-9 text-primary-500" />
							<span className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
								{t("name")}
							</span>
						</Link>
						<p className="mt-4 max-w-xs text-neutral-600 dark:text-neutral-400">
							{t("description")}
						</p>
					</div>

					<nav className="flex flex-wrap justify-center gap-6 sm:justify-end">
						<a
							href="#features"
							className="text-sm text-neutral-600 transition hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
						>
							Features
						</a>
						<a
							href="#pricing"
							className="text-sm text-neutral-600 transition hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
						>
							Pricing
						</a>
						<a
							href="#faq"
							className="text-sm text-neutral-600 transition hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
						>
							FAQ
						</a>
					</nav>
				</div>

				<Separator className="my-8" />

				<p className="text-center text-sm text-neutral-500 dark:text-neutral-400">
					{t("copyright", {
						year: new Date().getFullYear(),
					})}
				</p>
			</div>
		</footer>
	);
}

function Calculator(props: {
	initialMonitors: Array<{
		id: `${string}-${string}-${string}-${string}-${string}`;
		frequency: number;
	}>;
}) {
	let { t } = useTranslation("translation", {
		keyPrefix: "landing.pricing.calculator",
	});

	let [monitors, setMonitors] = useState(props.initialMonitors);

	let pingsPerMonth = monitors.reduce(
		(total, monitor) => total + (28 * 24 * 60) / monitor.frequency,
		0,
	);

	return (
		<Card className="overflow-hidden">
			<Card.Header className="bg-gradient-to-r from-primary-50 to-primary-100/50 dark:from-primary-950/50 dark:to-primary-900/30">
				<div className="flex flex-wrap items-baseline justify-between gap-4">
					<div>
						<Card.Title className="text-2xl">{t("title")}</Card.Title>
						<Card.Description className="mt-2">{t("description")}</Card.Description>
					</div>

					<button
						type="button"
						onClick={() => setMonitors((c) => c.concat({ id: crypto.randomUUID(), frequency: 10 }))}
						className="inline-flex items-center gap-2 rounded-lg border border-primary-300 bg-white px-4 py-2 text-sm font-medium text-primary-700 shadow-sm transition hover:bg-primary-50 dark:border-primary-700 dark:bg-primary-900 dark:text-primary-300 dark:hover:bg-primary-800"
					>
						<PlusIcon className="size-4" />
						{t("add")}
					</button>
				</div>
			</Card.Header>

			<Card.Content className="space-y-6 pt-6">
				<ul
					className={cn("grid gap-4", {
						"lg:grid-cols-2": monitors.length > 1,
					})}
				>
					{monitors.map((monitor) => (
						<li key={monitor.id} className="contents">
							<CalculatorMonitor
								isLast={monitors.length === 1}
								onDelete={() => setMonitors(monitors.filter((m) => m.id !== monitor.id))}
								frequency={monitor.frequency}
								onFrequencyChange={(newFrequency) => {
									setMonitors((c) =>
										c.map((m) => (m.id === monitor.id ? { ...m, frequency: newFrequency } : m)),
									);
								}}
							/>
						</li>
					))}
				</ul>

				<Separator />

				<div className="grid gap-6 lg:grid-cols-2">
					<CalculatorStats pingsPerMonth={pingsPerMonth} />
					<HowPricingWorks />
				</div>
			</Card.Content>
		</Card>
	);
}

function CalculatorMonitor(props: {
	isLast: boolean;
	frequency: number;
	onFrequencyChange(frequency: number): void;
	onDelete(): void;
}) {
	let { t } = useTranslation("translation", {
		keyPrefix: "landing.pricing.calculator.monitor",
	});

	let maxValue = 60; // 1 day in minutes
	let minValue = 1; // 1 minute

	let constrainedValue = Math.min(maxValue, Math.max(minValue, props.frequency));

	return (
		<div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-800/50">
			<Slider
				value={constrainedValue}
				onChange={props.onFrequencyChange}
				minValue={minValue}
				maxValue={maxValue}
				step={1}
				formatOptions={{
					style: "unit",
					unit: "minute",
					unitDisplay: "narrow",
					minimumFractionDigits: 0,
					maximumFractionDigits: 0,
				}}
				className="flex w-full flex-col"
			>
				<div className="flex items-center justify-between gap-2">
					<Label className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
						{t("label")}
					</Label>
					{!props.isLast && (
						<button
							type="button"
							onClick={props.onDelete}
							className="flex items-center gap-1 text-danger-500 transition hover:text-danger-700"
						>
							<span className="sr-only">{t("delete")}</span>
							<XIcon className="size-4" />
						</button>
					)}
				</div>

				<SliderTrack className="relative w-full py-4">
					<div className="absolute top-3.5 left-0 h-1.5 w-full rounded-full bg-neutral-200 dark:bg-neutral-700">
						<div
							className="absolute top-0 left-0 h-full rounded-full bg-primary-500"
							style={{
								width: `${(constrainedValue / (maxValue - minValue)) * 100}%`,
							}}
						/>
					</div>
					<SliderThumb className="flex size-5 cursor-grab items-center justify-center rounded-full bg-primary-500 shadow-md ring-2 ring-white transition active:scale-110 active:cursor-grabbing dark:ring-neutral-900" />
				</SliderTrack>

				<div className="flex justify-between text-sm text-neutral-500 dark:text-neutral-400">
					<span>{t("frequency.lower")}</span>
					<span className="font-semibold text-primary-600 dark:text-primary-400">
						<SliderOutput />
					</span>
					<span>{t("frequency.upper")}</span>
				</div>
			</Slider>
		</div>
	);
}

function HowPricingWorks() {
	let { t } = useTranslation("translation", {
		keyPrefix: "landing.pricing.howItWorks",
	});

	let list = [
		{ title: t("list.first.title"), description: t("list.first.description") },
		{
			title: t("list.second.title"),
			description: t("list.second.description"),
		},
		{ title: t("list.third.title"), description: t("list.third.description") },
	];

	return (
		<article className="flex flex-col gap-4 rounded-lg border-2 border-primary-200 bg-gradient-to-br from-primary-50 to-primary-100/50 p-6 dark:border-primary-800 dark:from-primary-950 dark:to-primary-900/50">
			<h3 className="text-xl font-semibold tracking-tight text-primary-900 dark:text-primary-50">
				{t("title")}
			</h3>

			<ol className="flex flex-col gap-4" style={{ counterReset: "step" }}>
				{list.map((item) => (
					<li
						key={item.title}
						className="flex items-start gap-3 before:flex before:size-7 before:shrink-0 before:items-center before:justify-center before:rounded-full before:bg-primary-500 before:text-sm before:font-bold before:text-white before:tabular-nums before:content-[counter(step)]"
						style={{ counterIncrement: "step 1" }}
					>
						<div>
							<h4 className="font-semibold text-primary-900 dark:text-primary-50">{item.title}</h4>
							<p className="text-sm text-primary-700 dark:text-primary-200">{item.description}</p>
						</div>
					</li>
				))}
			</ol>
		</article>
	);
}

function CalculatorStats(props: { pingsPerMonth: number }) {
	let { t, i18n } = useTranslation("translation", {
		keyPrefix: "landing.pricing.calculator.stats",
	});

	let basePrice = 5; // Base subscription price in USD
	let includedPings = 5000; // First 5000 pings included in the base price
	let costPerPing = 0.001; // $0.001 per ping after the first 5000
	let additionalPings = Math.max(0, props.pingsPerMonth - includedPings);
	let additionalPingsCost = additionalPings * costPerPing;
	let totalCost = basePrice + additionalPingsCost;

	return (
		<dl className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white p-5 dark:border-neutral-700 dark:bg-neutral-800">
			<div className="flex items-center justify-between">
				<dt className="text-neutral-600 dark:text-neutral-300">{t("pingsPerMonth")}</dt>
				<dd className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
					{props.pingsPerMonth.toLocaleString(i18n.language, {
						minimumFractionDigits: 0,
						maximumFractionDigits: 0,
					})}
				</dd>
			</div>

			<Separator />

			<div className="flex flex-col gap-2">
				<div className="flex items-center justify-between">
					<dt className="text-neutral-600 dark:text-neutral-300">{t("baseSubscription")}</dt>
					<dd className="font-semibold text-neutral-900 dark:text-neutral-50">
						{basePrice.toLocaleString(i18n.language, {
							style: "currency",
							currency: "USD",
							minimumFractionDigits: 0,
							maximumFractionDigits: 0,
						})}
					</dd>
				</div>
				<div className="flex items-center justify-between text-sm text-neutral-500 dark:text-neutral-400">
					<span className="ml-4">
						{t("includes", {
							amount: includedPings.toLocaleString(i18n.language, {
								minimumFractionDigits: 0,
								maximumFractionDigits: 0,
							}),
						})}
					</span>
				</div>
				<div className="flex items-center justify-between">
					<dt className="text-neutral-600 dark:text-neutral-300">{t("additionalPings")}</dt>
					<dd className="font-semibold text-neutral-900 dark:text-neutral-50">
						{additionalPingsCost.toLocaleString(i18n.language, {
							style: "currency",
							currency: "USD",
							minimumFractionDigits: 0,
							maximumFractionDigits: 0,
						})}
					</dd>
				</div>
				<div className="flex items-center justify-between text-sm text-neutral-500 dark:text-neutral-400">
					<span className="ml-4">
						{t("additionalPingsCost", {
							pings: additionalPings.toLocaleString(i18n.language, {
								minimumFractionDigits: 0,
								maximumFractionDigits: 0,
							}),
							costPerPing: costPerPing.toLocaleString(i18n.language, {
								style: "currency",
								currency: "USD",
								minimumFractionDigits: 0,
								maximumFractionDigits: 3,
							}),
						})}
					</span>
				</div>
			</div>

			<Separator />

			<div className="flex items-center justify-between rounded-lg bg-primary-50 p-3 dark:bg-primary-950/50">
				<span className="text-lg font-bold text-neutral-900 dark:text-neutral-50">
					{t("totalCost")}
				</span>
				<span className="text-2xl font-bold text-primary-600 dark:text-primary-400">
					{totalCost.toLocaleString(i18n.language, {
						style: "currency",
						currency: "USD",
						minimumFractionDigits: 0,
						maximumFractionDigits: 0,
					})}
				</span>
			</div>
		</dl>
	);
}
