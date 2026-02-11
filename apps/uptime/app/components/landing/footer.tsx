import { useTranslation } from "react-i18next";
import { href, Link } from "react-router";

import Logo from "~/components/logo";

export function LandingFooter() {
	let { t } = useTranslation("translation", { keyPrefix: "landing.footer" });

	return (
		<footer className="border-t border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
			<div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
				<div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-7">
					{/* Brand */}
					<div className="sm:col-span-2 lg:col-span-1">
						<Link to={href("/")} className="inline-flex items-center gap-2 no-underline">
							<Logo className="size-9 text-primary-500" />
							<span className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
								{t("name")}
							</span>
						</Link>
						<p className="mt-4 max-w-xs text-sm text-neutral-600 dark:text-neutral-400">
							{t("description")}
						</p>
					</div>

					{/* Features Column 1 */}
					<div>
						<h3 className="mb-4 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
							{t("sections.features.title")}
						</h3>
						<ul className="space-y-3">
							<li>
								<Link
									to={href("/features/monitors")}
									className="text-sm text-neutral-600 transition hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
								>
									{t("sections.features.monitors")}
								</Link>
							</li>
							<li>
								<Link
									to={href("/features/alerts")}
									className="text-sm text-neutral-600 transition hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
								>
									{t("sections.features.alerts")}
								</Link>
							</li>
							<li>
								<Link
									to={href("/features/status-pages")}
									className="text-sm text-neutral-600 transition hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
								>
									{t("sections.features.statusPages")}
								</Link>
							</li>
							<li>
								<Link
									to={href("/features/ssl")}
									className="text-sm text-neutral-600 transition hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
								>
									{t("sections.features.ssl")}
								</Link>
							</li>
							<li>
								<Link
									to={href("/features/dns")}
									className="text-sm text-neutral-600 transition hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
								>
									{t("sections.features.dns")}
								</Link>
							</li>
							<li>
								<Link
									to={href("/features/content-monitoring")}
									className="text-sm text-neutral-600 transition hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
								>
									{t("sections.features.contentMonitoring")}
								</Link>
							</li>
						</ul>
					</div>

					{/* Features Column 2 */}
					<div>
						<h3 className="mb-4 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
							&nbsp;
						</h3>
						<ul className="space-y-3">
							<li>
								<Link
									to={href("/features/maintenance")}
									className="text-sm text-neutral-600 transition hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
								>
									{t("sections.features.maintenance")}
								</Link>
							</li>
							<li>
								<Link
									to={href("/features/integrations")}
									className="text-sm text-neutral-600 transition hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
								>
									{t("sections.features.integrations")}
								</Link>
							</li>
							<li>
								<Link
									to={href("/features/teams")}
									className="text-sm text-neutral-600 transition hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
								>
									{t("sections.features.teams")}
								</Link>
							</li>
							<li>
								<Link
									to={href("/features/analytics")}
									className="text-sm text-neutral-600 transition hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
								>
									{t("sections.features.analytics")}
								</Link>
							</li>
							<li>
								<Link
									to={href("/features/api")}
									className="text-sm text-neutral-600 transition hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
								>
									{t("sections.features.api")}
								</Link>
							</li>
						</ul>
					</div>

					{/* Use Cases */}
					<div>
						<h3 className="mb-4 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
							{t("sections.useCases.title")}
						</h3>
						<ul className="space-y-3">
							<li>
								<Link
									to={href("/use-cases/website-monitoring")}
									className="text-sm text-neutral-600 transition hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
								>
									{t("sections.useCases.websiteMonitoring")}
								</Link>
							</li>
							<li>
								<Link
									to={href("/use-cases/api-monitoring")}
									className="text-sm text-neutral-600 transition hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
								>
									{t("sections.useCases.apiMonitoring")}
								</Link>
							</li>
							<li>
								<Link
									to={href("/use-cases/saas")}
									className="text-sm text-neutral-600 transition hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
								>
									{t("sections.useCases.saas")}
								</Link>
							</li>
							<li>
								<Link
									to={href("/use-cases/microservices")}
									className="text-sm text-neutral-600 transition hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
								>
									{t("sections.useCases.microservices")}
								</Link>
							</li>
							<li>
								<Link
									to={href("/use-cases/healthcheck")}
									className="text-sm text-neutral-600 transition hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
								>
									{t("sections.useCases.healthChecks")}
								</Link>
							</li>
						</ul>
					</div>

					{/* Solutions */}
					<div>
						<h3 className="mb-4 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
							{t("sections.solutions.title")}
						</h3>
						<ul className="space-y-3">
							<li>
								<Link
									to={href("/for/indie-hackers")}
									className="text-sm text-neutral-600 transition hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
								>
									{t("sections.solutions.indieHackers")}
								</Link>
							</li>
							<li>
								<Link
									to={href("/for/solo-devs")}
									className="text-sm text-neutral-600 transition hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
								>
									{t("sections.solutions.soloDevs")}
								</Link>
							</li>
							<li>
								<Link
									to={href("/for/startups")}
									className="text-sm text-neutral-600 transition hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
								>
									{t("sections.solutions.startups")}
								</Link>
							</li>
							<li>
								<Link
									to={href("/for/agencies")}
									className="text-sm text-neutral-600 transition hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
								>
									{t("sections.solutions.agencies")}
								</Link>
							</li>
							<li>
								<Link
									to={href("/for/enterprises")}
									className="text-sm text-neutral-600 transition hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
								>
									{t("sections.solutions.enterprises")}
								</Link>
							</li>
						</ul>
					</div>

					{/* Compare */}
					<div>
						<h3 className="mb-4 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
							{t("sections.compare.title")}
						</h3>
						<ul className="space-y-3">
							<li>
								<Link
									to="/vs/uptimerobot"
									className="text-sm text-neutral-600 transition hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
								>
									{t("sections.compare.uptimerobot")}
								</Link>
							</li>
							<li>
								<Link
									to="/vs/pingdom"
									className="text-sm text-neutral-600 transition hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
								>
									{t("sections.compare.pingdom")}
								</Link>
							</li>
							<li>
								<Link
									to="/vs/better-uptime"
									className="text-sm text-neutral-600 transition hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
								>
									{t("sections.compare.betterUptime")}
								</Link>
							</li>
							<li>
								<Link
									to="/vs/checkly"
									className="text-sm text-neutral-600 transition hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
								>
									{t("sections.compare.checkly")}
								</Link>
							</li>
							<li>
								<Link
									to="/vs/statuscake"
									className="text-sm text-neutral-600 transition hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
								>
									{t("sections.compare.statuscake")}
								</Link>
							</li>
						</ul>
					</div>

					{/* Legal */}
					<div>
						<h3 className="mb-4 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
							{t("sections.legal.title")}
						</h3>
						<ul className="space-y-3">
							<li>
								<Link
									to="/terms"
									className="text-sm text-neutral-600 transition hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
								>
									{t("sections.legal.terms")}
								</Link>
							</li>
							<li>
								<Link
									to="/privacy"
									className="text-sm text-neutral-600 transition hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
								>
									{t("sections.legal.privacy")}
								</Link>
							</li>
						</ul>
					</div>
				</div>

				<p className="mt-12 text-center text-sm text-neutral-500 dark:text-neutral-400">
					{t("copyright", { year: new Date().getFullYear() })}
				</p>
			</div>
		</footer>
	);
}
