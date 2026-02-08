import { href, Link } from "react-router";

import Logo from "~/components/logo";

export function LandingFooter() {
	return (
		<footer className="border-t border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-950">
			<div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
				<div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-7">
					{/* Brand */}
					<div className="sm:col-span-2 lg:col-span-1">
						<Link to={href("/")} className="inline-flex items-center gap-2 no-underline">
							<Logo className="size-9 text-primary-500" />
							<span className="text-xl font-bold text-neutral-900 dark:text-neutral-50">
								Uptime
							</span>
						</Link>
						<p className="mt-4 max-w-xs text-sm text-neutral-600 dark:text-neutral-400">
							Simple, reliable monitoring for your websites and APIs.
						</p>
					</div>

					{/* Product */}
					<div>
						<h3 className="mb-4 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
							Product
						</h3>
						<ul className="space-y-3">
							<li>
								<a
									href="/#features"
									className="text-sm text-neutral-600 transition hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
								>
									Features
								</a>
							</li>
							<li>
								<a
									href="/#pricing"
									className="text-sm text-neutral-600 transition hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
								>
									Pricing
								</a>
							</li>
							<li>
								<a
									href="/#faq"
									className="text-sm text-neutral-600 transition hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
								>
									FAQ
								</a>
							</li>
						</ul>
					</div>

					{/* Features */}
					<div>
						<h3 className="mb-4 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
							Features
						</h3>
						<ul className="space-y-3">
							<li>
								<Link
									to={href("/features/monitors")}
									className="text-sm text-neutral-600 transition hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
								>
									Monitors
								</Link>
							</li>
							<li>
								<Link
									to={href("/features/alerts")}
									className="text-sm text-neutral-600 transition hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
								>
									Alerts
								</Link>
							</li>
							<li>
								<Link
									to={href("/features/teams")}
									className="text-sm text-neutral-600 transition hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
								>
									Teams
								</Link>
							</li>
							<li>
								<Link
									to={href("/features/analytics")}
									className="text-sm text-neutral-600 transition hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
								>
									Analytics
								</Link>
							</li>
						</ul>
					</div>

					{/* Use Cases */}
					<div>
						<h3 className="mb-4 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
							Use Cases
						</h3>
						<ul className="space-y-3">
							<li>
								<Link
									to={href("/use-cases/website-monitoring")}
									className="text-sm text-neutral-600 transition hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
								>
									Website Monitoring
								</Link>
							</li>
							<li>
								<Link
									to={href("/use-cases/api-monitoring")}
									className="text-sm text-neutral-600 transition hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
								>
									API Monitoring
								</Link>
							</li>
							<li>
								<Link
									to={href("/use-cases/saas")}
									className="text-sm text-neutral-600 transition hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
								>
									SaaS Applications
								</Link>
							</li>
							<li>
								<Link
									to={href("/use-cases/microservices")}
									className="text-sm text-neutral-600 transition hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
								>
									Microservices
								</Link>
							</li>
							<li>
								<Link
									to={href("/use-cases/healthcheck")}
									className="text-sm text-neutral-600 transition hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
								>
									Health Checks
								</Link>
							</li>
						</ul>
					</div>

					{/* Solutions */}
					<div>
						<h3 className="mb-4 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
							Solutions
						</h3>
						<ul className="space-y-3">
							<li>
								<Link
									to={href("/for/indie-hackers")}
									className="text-sm text-neutral-600 transition hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
								>
									For Indie Hackers
								</Link>
							</li>
							<li>
								<Link
									to={href("/for/solo-devs")}
									className="text-sm text-neutral-600 transition hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
								>
									For Solo Developers
								</Link>
							</li>
							<li>
								<Link
									to={href("/for/startups")}
									className="text-sm text-neutral-600 transition hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
								>
									For Startups
								</Link>
							</li>
							<li>
								<Link
									to={href("/for/agencies")}
									className="text-sm text-neutral-600 transition hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
								>
									For Agencies
								</Link>
							</li>
							<li>
								<Link
									to={href("/for/enterprises")}
									className="text-sm text-neutral-600 transition hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
								>
									For Enterprises
								</Link>
							</li>
						</ul>
					</div>

					{/* Compare */}
					<div>
						<h3 className="mb-4 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
							Compare
						</h3>
						<ul className="space-y-3">
							<li>
								<Link
									to="/vs/uptimerobot"
									className="text-sm text-neutral-600 transition hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
								>
									vs UptimeRobot
								</Link>
							</li>
							<li>
								<Link
									to="/vs/pingdom"
									className="text-sm text-neutral-600 transition hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
								>
									vs Pingdom
								</Link>
							</li>
							<li>
								<Link
									to="/vs/better-uptime"
									className="text-sm text-neutral-600 transition hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
								>
									vs Better Uptime
								</Link>
							</li>
							<li>
								<Link
									to="/vs/checkly"
									className="text-sm text-neutral-600 transition hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
								>
									vs Checkly
								</Link>
							</li>
							<li>
								<Link
									to="/vs/statuscake"
									className="text-sm text-neutral-600 transition hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
								>
									vs StatusCake
								</Link>
							</li>
						</ul>
					</div>

					{/* Legal */}
					<div>
						<h3 className="mb-4 text-sm font-semibold text-neutral-900 dark:text-neutral-50">
							Legal
						</h3>
						<ul className="space-y-3">
							<li>
								<Link
									to="/terms"
									className="text-sm text-neutral-600 transition hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
								>
									Terms of Service
								</Link>
							</li>
							<li>
								<Link
									to="/privacy"
									className="text-sm text-neutral-600 transition hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400"
								>
									Privacy Policy
								</Link>
							</li>
						</ul>
					</div>
				</div>

				<p className="mt-12 text-center text-sm text-neutral-500 dark:text-neutral-400">
					© {new Date().getFullYear()} Uptime by Sergio Xalambrí. All rights reserved.
				</p>
			</div>
		</footer>
	);
}
