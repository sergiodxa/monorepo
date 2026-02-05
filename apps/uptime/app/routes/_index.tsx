import { cn } from "@pkg/cn";
import { ActivityIcon, BellIcon, CreditCardIcon, PlusIcon, XIcon } from "lucide-react";
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
		<>
			<Header isSignedIn={loaderData.isSignedIn} />
			<Hero isSignedIn={loaderData.isSignedIn} />
			<Features />
			<Pricing initialMonitors={loaderData.initialMonitors} />
			<FAQ />
			<Footer />
		</>
	);
}

function Header(props: { isSignedIn: boolean }) {
	let { t } = useTranslation("translation", { keyPrefix: "landing.header" });

	return (
		<header className="bg-white/80 sticky top-0 z-50 border-b border-neutral-300 backdrop-blur-sm dark:bg-neutral-900/80">
			<div className="mx-auto flex h-16 max-w-5xl items-center gap-8 max-lg:px-6">
				<div className="flex items-center gap-1 text-primary-500">
					<Logo className="size-10" />
					<h1 className="text-xl/none font-bold">{t("title")}</h1>
				</div>

				<nav className="ml-auto flex items-center gap-4 max-lg:hidden">
					<a
						className="text-primary-900 underline dark:text-primary-500 dark:hover:text-primary-400"
						href="#features"
					>
						{t("nav.features")}
					</a>
					<a
						className="text-primary-900 underline dark:text-primary-500 dark:hover:text-primary-400"
						href="#pricing"
					>
						{t("nav.pricing")}
					</a>
				</nav>

				<Link
					to={props.isSignedIn ? href("/app") : href("/auth")}
					reloadDocument={!props.isSignedIn}
					className="rounded-lg bg-primary-600 px-5 py-2 font-medium text-primary-50 shadow-sm transition hover:bg-primary-700 hover:shadow max-lg:ml-auto"
				>
					{props.isSignedIn ? t("nav.cta.in") : t("nav.cta.out")}
				</Link>
			</div>
		</header>
	);
}

function Hero(props: { isSignedIn: boolean }) {
	let { t } = useTranslation("translation", { keyPrefix: "landing.hero" });

	return (
		<div id="hero" className="mx-auto max-w-5xl">
			<div className="my-10 grid gap-x-4 gap-y-8 max-lg:px-6 lg:my-20 lg:grid-cols-2">
				<div className="flex flex-col items-center gap-4 text-balance max-lg:text-center lg:items-start">
					<Trans
						parent="h2"
						t={t}
						i18nKey="title"
						className="text-4xl leading-none font-bold md:text-5xl lg:text-6xl"
						components={{
							strong: <strong className="text-primary-500 max-lg:hidden" />,
						}}
					/>

					<p className="max-w-lg text-lg text-neutral-600 dark:text-neutral-400">
						{t("description")}
					</p>

					<Link
						to={props.isSignedIn ? href("/app") : href("/auth")}
						reloadDocument={!props.isSignedIn}
						className="rounded-lg bg-primary-600 px-8 py-3 text-lg font-medium text-primary-50 shadow-md transition hover:bg-primary-700 hover:shadow-lg max-lg:mt-4"
					>
						{props.isSignedIn ? t("cta.in") : t("cta.out")}
					</Link>
				</div>

				<div className="relative flex items-center justify-center overflow-hidden rounded-xl">
					<picture>
						<source media="(prefers-color-scheme: dark)" srcSet={screenshotDark} />
						<source media="(prefers-color-scheme: light)" srcSet={screenshotLight} />
						<img
							src={screenshotLight}
							alt={t("screenshot.alt")}
							className="h-auto w-full object-cover drop-shadow-sm drop-shadow-primary-300 dark:drop-shadow-primary-900"
						/>
					</picture>
				</div>
			</div>
		</div>
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
			icon: <ActivityIcon className="size-8" />,
		},
		{
			title: t("list.second.title"),
			description: t("list.second.description"),
			icon: <BellIcon className="size-8" />,
		},
		{
			title: t("list.third.title"),
			description: t("list.third.description"),
			icon: <CreditCardIcon className="size-8" />,
		},
	] as const;

	return (
		<section
			id="features"
			className="mx-auto my-10 flex max-w-5xl scroll-mt-20 flex-col gap-16 max-lg:px-6 lg:my-20"
		>
			<header className="flex flex-col items-center gap-4">
				<h2 className="text-center text-3xl font-bold">{t("title")}</h2>
				<p className="mx-auto max-w-2xl text-center text-balance text-neutral-600 dark:text-neutral-400">
					{t("description")}
				</p>
			</header>

			<div className="grid gap-8 md:grid-cols-3">
				{list.map((item) => (
					<div
						key={item.title}
						className="flex flex-col items-start gap-3 rounded-xl bg-neutral-50 shadow-sm transition hover:shadow-md lg:p-8 dark:bg-neutral-950/30"
					>
						<figure
							aria-hidden
							className="mb-3 flex items-center justify-center rounded-full bg-primary-100 p-4 text-primary-800 dark:bg-primary-500 dark:text-primary-950"
						>
							{item.icon}
						</figure>

						<h3 className="w-full text-xl font-semibold">{item.title}</h3>

						<p className="text-neutral-600 dark:text-neutral-400">{t("list.first.description")}</p>
					</div>
				))}
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
			className="mx-auto my-10 flex w-full max-w-5xl scroll-mt-20 flex-col gap-16 max-lg:px-6 lg:my-20"
		>
			<header className="flex flex-col items-center gap-4">
				<h2 className="text-center text-3xl font-bold">{t("title")}</h2>
				<p className="mx-auto max-w-2xl text-center text-balance text-neutral-600 dark:text-neutral-400">
					{t("description")}
				</p>
			</header>

			<Calculator {...props} />
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
		<section
			id="faq"
			className="mx-auto my-10 flex max-w-5xl scroll-mt-20 flex-col gap-16 max-lg:px-6 lg:my-20"
		>
			<header className="flex flex-col items-center gap-4">
				<h2 className="text-center text-3xl font-bold">{t("title")}</h2>
				<p className="mx-auto max-w-2xl text-center text-balance text-neutral-600 dark:text-neutral-400">
					{t("description")}
				</p>
			</header>

			<dl className="mx-auto grid gap-6 sm:grid-cols-2">
				<div className="mx-auto flex flex-col gap-6 max-sm:max-w-prose">
					{firstHalf.map((item) => (
						<div key={item.q} className="flex flex-col gap-3">
							<dt className="text-xl font-semibold">{item.q}</dt>
							<dd className="whitespace-pre-line text-neutral-600 dark:text-neutral-400">
								{item.a}
							</dd>
						</div>
					))}
				</div>

				<div className="mx-auto flex flex-col gap-6 max-sm:max-w-prose">
					{secondHalf.map((item) => (
						<div key={item.q} className="flex flex-col gap-3">
							<dt className="text-xl font-semibold">{item.q}</dt>
							<dd className="whitespace-pre-line text-neutral-600 dark:text-neutral-400">
								{item.a}
							</dd>
						</div>
					))}
				</div>
			</dl>
		</section>
	);
}

function Footer() {
	let { t } = useTranslation("translation", { keyPrefix: "landing.footer" });

	return (
		<footer className="mx-auto max-w-5xl p-6 text-center lg:px-0 lg:py-10">
			<p className="text-neutral-600 dark:text-neutral-400">
				{t("copyright", {
					year: new Date().getFullYear(),
				})}
			</p>
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
		<section className="flex flex-col gap-3 rounded-xl bg-neutral-50 shadow-sm transition hover:shadow-md lg:p-8 dark:bg-neutral-950/30">
			<header className="flex flex-col gap-3">
				<div className="flex items-baseline justify-between gap-2 gap-y-4">
					<h3 className="text-2xl font-semibold tracking-tight">{t("title")}</h3>

					<button
						type="button"
						className="flex flex-shrink-0 items-center gap-2"
						onClick={() => setMonitors((c) => c.concat({ id: crypto.randomUUID(), frequency: 10 }))}
					>
						<span className="text-sm">{t("add")}</span>
						<PlusIcon className="inline size-5" />
					</button>
				</div>
				<p className="text-neutral-600 dark:text-neutral-400">{t("description")}</p>
			</header>

			<div className="flex flex-col gap-4">
				<ul
					className={cn("grid gap-3", {
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
			</div>

			<div className="grid gap-4 lg:grid-cols-2">
				<CalculatorStats pingsPerMonth={pingsPerMonth} />
				<HowPricingWorks />
			</div>
		</section>
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
		<Slider
			value={constrainedValue}
			onChange={props.onFrequencyChange}
			minValue={minValue}
			maxValue={maxValue}
			step={1} // 1 minute step
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
						className="text-red-500 hover:text-red-700 flex items-center gap-1"
					>
						<span className="sr-only">{t("delete")}</span>
						<XIcon className="inline size-4" />
					</button>
				)}
			</div>

			<SliderTrack className="relative w-full py-4">
				<div className="absolute top-3.5 left-0 h-1 w-full rounded-full bg-neutral-200">
					<div
						className="absolute top-0 left-0 h-full rounded-full bg-primary-300"
						style={{
							width: `${(constrainedValue / (maxValue - minValue)) * 100}%`,
						}}
					/>
				</div>
				<SliderThumb className="flex size-4 items-center justify-center rounded-full bg-primary-300" />
			</SliderTrack>

			<div className="flex justify-between text-sm text-neutral-500">
				<span>{t("frequency.lower")}</span>
				<span className="font-medium">
					<SliderOutput />
				</span>
				<span>{t("frequency.upper")}</span>
			</div>
		</Slider>
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
		<aside>
			<article className="flex flex-col gap-4 rounded-lg border-2 border-primary-200 bg-primary-50 p-6 shadow-sm shadow-primary-200 dark:border-primary-800 dark:bg-primary-950 dark:shadow-primary-800">
				<h3 className="text-xl font-semibold tracking-tight text-primary-900 dark:text-primary-50">
					{t("title")}
				</h3>

				<ol className="flex flex-col gap-4">
					{list.map((item) => (
						<li
							key={item.title}
							className="flex items-start gap-3 before:flex before:size-6 before:items-center before:justify-center before:rounded-full before:bg-primary-400 before:p-4 before:text-primary-950 before:tabular-nums before:content-[counter(step)] before:dark:bg-primary-600 before:dark:text-primary-50"
							style={{ counterIncrement: "step 1" }}
						>
							<div>
								<h4 className="font-semibold text-primary-900 dark:text-primary-50">
									{item.title}
								</h4>
								<p className="text-primary-700 dark:text-primary-100">{item.description}</p>
							</div>
						</li>
					))}
				</ol>
			</article>
		</aside>
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
		<dl className="flex flex-col gap-3 rounded-lg bg-neutral-100 p-4 dark:bg-neutral-800">
			<div className="flex items-center justify-between">
				<dt className="text-neutral-600 dark:text-neutral-200">{t("pingsPerMonth")}</dt>
				<dd className="font-semibold">
					{props.pingsPerMonth.toLocaleString(i18n.language, {
						minimumFractionDigits: 0,
						maximumFractionDigits: 0,
					})}
				</dd>
			</div>
			<div className="flex flex-col gap-2 border-t border-neutral-200 pt-3 dark:border-neutral-600">
				<div className="flex items-center justify-between">
					<dt className="text-neutral-600 dark:text-neutral-200">{t("baseSubscription")}</dt>
					<dd className="font-medium">
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
					<dt className="text-neutral-600 dark:text-neutral-200">{t("additionalPings")}</dt>
					<dd className="font-medium">
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
					<span />
				</div>
			</div>
			<div className="mt-auto border-t border-neutral-200 pt-3 dark:border-neutral-600">
				<div className="flex items-center justify-between text-lg font-bold">
					<span>{t("totalCost")}</span>
					<span className="text-primary-600">
						{totalCost.toLocaleString(i18n.language, {
							style: "currency",
							currency: "USD",
							minimumFractionDigits: 0,
							maximumFractionDigits: 0,
						})}
					</span>
				</div>
			</div>
		</dl>
	);
}
