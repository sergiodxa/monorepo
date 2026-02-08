import { Badge } from "@pkg/ui";
import { ArrowRightIcon, CheckIcon } from "lucide-react";
import { href, Link } from "react-router";

interface CompareHeroProps {
	competitor: string;
	tagline: string;
	description: string;
	isSignedIn: boolean;
}

export function CompareHero({ competitor, tagline, description, isSignedIn }: CompareHeroProps) {
	return (
		<section className="relative overflow-hidden bg-gradient-to-b from-primary-50 to-white py-16 sm:py-24 lg:py-32 dark:from-primary-950/20 dark:to-neutral-950">
			<div aria-hidden className="absolute inset-0 overflow-hidden">
				<div className="absolute top-0 left-1/2 size-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-100/50 blur-3xl dark:bg-primary-900/20" />
			</div>

			<div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
				<Badge color="primary" variant="secondary" className="mb-6">
					Comparison
				</Badge>

				<h1 className="text-4xl font-bold tracking-tight text-neutral-900 sm:text-5xl lg:text-6xl dark:text-neutral-50">
					Uptime vs {competitor}
				</h1>

				<p className="mt-4 text-xl font-medium text-primary-600 sm:text-2xl dark:text-primary-400">
					{tagline}
				</p>

				<p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-neutral-600 dark:text-neutral-400">
					{description}
				</p>

				<div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
					<Link
						to={isSignedIn ? href("/app") : href("/auth")}
						reloadDocument={!isSignedIn}
						className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-6 py-3 text-base font-semibold text-white shadow-lg transition hover:bg-primary-700 hover:shadow-xl"
					>
						{isSignedIn ? "Open Dashboard" : "Try Free"}
						<ArrowRightIcon className="size-5" />
					</Link>
					<a
						href="#comparison"
						className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-6 py-3 text-base font-semibold text-neutral-700 shadow-sm transition hover:bg-neutral-50 hover:shadow-md dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-300 dark:hover:bg-neutral-800"
					>
						See Comparison
					</a>
				</div>

				<div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-neutral-500 dark:text-neutral-400">
					<div className="flex items-center gap-2">
						<CheckIcon className="size-4 text-success-500" />
						<span>Free to start</span>
					</div>
					<div className="flex items-center gap-2">
						<CheckIcon className="size-4 text-success-500" />
						<span>No credit card required</span>
					</div>
					<div className="flex items-center gap-2">
						<CheckIcon className="size-4 text-success-500" />
						<span>Cancel anytime</span>
					</div>
				</div>
			</div>
		</section>
	);
}
