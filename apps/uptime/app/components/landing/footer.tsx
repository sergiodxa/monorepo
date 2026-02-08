import { Separator } from "@pkg/ui";
import { href, Link } from "react-router";

import Logo from "~/components/logo";

export function LandingFooter() {
	return (
		<footer className="border-t border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
			<div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
				<div className="flex flex-col items-center gap-8 sm:flex-row sm:items-start sm:justify-between">
					<div className="text-center sm:text-left">
						<Link to={href("/")} className="inline-flex items-center gap-2 no-underline">
							<Logo className="size-9 text-primary-500" />
							<span className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
								Uptime
							</span>
						</Link>
						<p className="mt-4 max-w-xs text-neutral-600 dark:text-neutral-400">
							Simple, reliable monitoring for your websites and APIs.
						</p>
					</div>

					<nav className="flex flex-wrap justify-center gap-6 sm:justify-end">
						<a
							href="/#features"
							className="text-sm text-neutral-600 transition hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
						>
							Features
						</a>
						<a
							href="/#pricing"
							className="text-sm text-neutral-600 transition hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
						>
							Pricing
						</a>
						<a
							href="/#faq"
							className="text-sm text-neutral-600 transition hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
						>
							FAQ
						</a>
					</nav>
				</div>

				<Separator className="my-8" />

				<p className="text-center text-sm text-neutral-500 dark:text-neutral-400">
					© {new Date().getFullYear()} Uptime by Sergio Xalambrí. All rights reserved.
				</p>
			</div>
		</footer>
	);
}
