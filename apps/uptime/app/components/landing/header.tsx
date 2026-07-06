/**
 * Renders the sticky landing page header with the logo, in-page navigation links
 * (features, pricing, FAQ, docs), and a primary call-to-action button. The CTA and
 * its target adapt to whether the visitor is signed in, so the marketing pages get
 * one consistent, localized top bar.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ArrowRightIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { href, Link } from "react-router";

import Logo from "~/components/logo";

interface LandingHeaderProps {
	isSignedIn: boolean;
}

export function LandingHeader({ isSignedIn }: LandingHeaderProps) {
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
							href="/#features"
							className="text-sm font-medium text-neutral-600 transition hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
						>
							{t("nav.features")}
						</a>
						<a
							href="/#pricing"
							className="text-sm font-medium text-neutral-600 transition hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
						>
							{t("nav.pricing")}
						</a>
						<a
							href="/#faq"
							className="text-sm font-medium text-neutral-600 transition hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
						>
							FAQ
						</a>
						<Link
							to={href("/docs")}
							className="text-sm font-medium text-neutral-600 transition hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
						>
							{t("nav.docs")}
						</Link>
					</nav>
				</div>

				<Link
					to={isSignedIn ? href("/app") : href("/auth")}
					reloadDocument={!isSignedIn}
					className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-primary-700 hover:shadow-md"
				>
					{isSignedIn ? t("nav.cta.in") : t("nav.cta.out")}
					<ArrowRightIcon className="size-4" />
				</Link>
			</div>
		</header>
	);
}
