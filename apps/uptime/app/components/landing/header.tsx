import { ArrowRightIcon } from "lucide-react";
import { href, Link } from "react-router";

import Logo from "~/components/logo";

interface LandingHeaderProps {
	isSignedIn: boolean;
	ctaIn?: string;
	ctaOut?: string;
}

export function LandingHeader({
	isSignedIn,
	ctaIn = "Open Dashboard",
	ctaOut = "Start Monitoring",
}: LandingHeaderProps) {
	return (
		<header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/80 backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-950/80">
			<div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
				<div className="flex items-center gap-8">
					<Link to={href("/")} className="flex items-center gap-2 no-underline">
						<Logo className="size-9 text-primary-500" />
						<span className="text-xl font-bold text-neutral-900 dark:text-neutral-50">Uptime</span>
					</Link>

					<nav className="hidden items-center gap-6 md:flex">
						<Link
							to={href("/")}
							className="text-sm font-medium text-neutral-600 transition hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
						>
							Home
						</Link>
						<a
							href="/#features"
							className="text-sm font-medium text-neutral-600 transition hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
						>
							Features
						</a>
						<a
							href="/#pricing"
							className="text-sm font-medium text-neutral-600 transition hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
						>
							Pricing
						</a>
					</nav>
				</div>

				<Link
					to={isSignedIn ? href("/app") : href("/auth")}
					reloadDocument={!isSignedIn}
					className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-primary-700 hover:shadow-md"
				>
					{isSignedIn ? ctaIn : ctaOut}
					<ArrowRightIcon className="size-4" />
				</Link>
			</div>
		</header>
	);
}
