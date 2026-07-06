/**
 * LandingHero component: the top hero section for marketing pages. It renders a
 * badge, title, description, primary and secondary CTAs (dashboard vs sign-up by
 * sign-in state), a highlights list, and a light/dark dashboard screenshot. It
 * exists as a reusable, configurable header shared across the landing pages.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { ReactNode } from "react";

import { Badge } from "@pkg/ui";
import { ArrowRightIcon, CheckIcon } from "lucide-react";
import { href, Link } from "react-router";

import screenshotDark from "~/assets/screenshot-dark.webp";
import screenshotLight from "~/assets/screenshot-light.webp";

interface LandingHeroProps {
	isSignedIn: boolean;
	badge: string;
	title: ReactNode;
	description: string;
	ctaIn?: string;
	ctaOut?: string;
	secondaryCta?: {
		label: string;
		href: string;
	};
	highlights?: string[];
	screenshotAlt?: string;
}

export function LandingHero({
	isSignedIn,
	badge,
	title,
	description,
	ctaIn = "Open Dashboard",
	ctaOut = "Start Monitoring",
	secondaryCta = { label: "View Pricing", href: "/#pricing" },
	highlights = ["Free to start", "Pay for automation", "Cancel anytime"],
	screenshotAlt = "Screenshot of Uptime dashboard",
}: LandingHeroProps) {
	return (
		<section className="relative overflow-hidden bg-gradient-to-b from-primary-50 to-white py-16 sm:py-24 lg:py-32 dark:from-primary-950/20 dark:to-neutral-950">
			<div aria-hidden className="absolute inset-0 overflow-hidden">
				<div className="absolute top-0 left-1/2 size-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-100/50 blur-3xl dark:bg-primary-900/20" />
			</div>

			<div className="relative mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
				<div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
					<div className="flex flex-col items-center text-center lg:items-start lg:text-left">
						<Badge color="primary" variant="secondary" className="mb-6">
							{badge}
						</Badge>

						<h1 className="text-4xl font-bold tracking-tight text-neutral-900 sm:text-5xl lg:text-6xl dark:text-neutral-50">
							{title}
						</h1>

						<p className="mt-6 max-w-xl text-lg leading-relaxed text-neutral-600 dark:text-neutral-400">
							{description}
						</p>

						<div className="mt-8 flex flex-col items-center gap-4 sm:flex-row">
							<Link
								to={isSignedIn ? href("/app") : href("/auth")}
								reloadDocument={!isSignedIn}
								className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-3 text-base font-semibold text-white shadow-lg transition hover:bg-primary-700 hover:shadow-xl"
							>
								{isSignedIn ? ctaIn : ctaOut}
								<ArrowRightIcon className="size-5" />
							</Link>
							<a
								href={secondaryCta.href}
								className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-6 py-3 text-base font-semibold text-neutral-700 shadow-sm transition hover:bg-neutral-50 hover:shadow-md dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
							>
								{secondaryCta.label}
							</a>
						</div>

						{highlights.length > 0 && (
							<div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-neutral-500 lg:justify-start dark:text-neutral-400">
								{highlights.map((highlight) => (
									<div key={highlight} className="flex items-center gap-2">
										<CheckIcon className="size-4 text-success-500" />
										<span>{highlight}</span>
									</div>
								))}
							</div>
						)}
					</div>

					<div className="relative">
						<div className="absolute -inset-4 rounded-2xl bg-gradient-to-tr from-primary-500/20 to-primary-300/20 blur-2xl dark:from-primary-500/10 dark:to-primary-700/10" />
						<picture className="relative block overflow-hidden rounded-xl shadow-2xl ring-1 ring-neutral-200/50 dark:ring-neutral-800/50">
							<source media="(prefers-color-scheme: dark)" srcSet={screenshotDark} />
							<source media="(prefers-color-scheme: light)" srcSet={screenshotLight} />
							<img src={screenshotLight} alt={screenshotAlt} className="h-auto w-full" />
						</picture>
					</div>
				</div>
			</div>
		</section>
	);
}
