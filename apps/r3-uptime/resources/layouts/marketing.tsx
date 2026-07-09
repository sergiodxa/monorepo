/**
 * Shared chrome for the public marketing site: a sticky top nav (brand, feature/docs
 * links, sign-in or dashboard call to action) and a multi-column footer mirroring the
 * OLD APP's `LandingHeader`/`LandingFooter` structure. Every `/features/:slug`,
 * `/for/:slug`, `/use-cases/:slug`, `/vs/:slug`, `/privacy`, `/terms`, `/docs`, and
 * the homepage compose their content into this layout. It exists so those 40+ public
 * pages share one header/footer instead of repeating the chrome per page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import * as s from "~/resources/styles";
import routes from "~/routes/web";

namespace MarketingLayout {
	export interface Props {
		isSignedIn: boolean;
		children: RemixNode;
	}
}

const FOOTER_COLUMNS: Array<{ title: string; links: Array<{ label: string; href: string }> }> = [
	{
		title: "Features",
		links: [
			{ label: "HTTP Monitors", slug: "monitors" },
			{ label: "Alerts", slug: "alerts" },
			{ label: "Status Pages", slug: "status-pages" },
			{ label: "SSL Monitoring", slug: "ssl" },
			{ label: "DNS Monitoring", slug: "dns" },
			{ label: "Cron Job Monitoring", slug: "cron-jobs" },
			{ label: "Content Monitoring", slug: "content-monitoring" },
			{ label: "Maintenance Windows", slug: "maintenance" },
			{ label: "Integrations", slug: "integrations" },
			{ label: "Teams", slug: "teams" },
			{ label: "Analytics", slug: "analytics" },
			{ label: "API Access", slug: "api" },
		].map((link) => ({
			label: link.label,
			href: routes.marketing.feature.href({ slug: link.slug }),
		})),
	},
	{
		title: "Use Cases",
		links: [
			{ label: "Website Monitoring", slug: "website-monitoring" },
			{ label: "API Monitoring", slug: "api-monitoring" },
			{ label: "SaaS Applications", slug: "saas" },
			{ label: "E-commerce", slug: "ecommerce" },
			{ label: "Cron Job Monitoring", slug: "cron-jobs" },
			{ label: "Microservices", slug: "microservices" },
			{ label: "Health Checks", slug: "healthcheck" },
		].map((link) => ({
			label: link.label,
			href: routes.marketing.useCase.href({ slug: link.slug }),
		})),
	},
	{
		title: "Solutions",
		links: [
			{ label: "For Indie Hackers", slug: "indie-hackers" },
			{ label: "For Solo Developers", slug: "solo-devs" },
			{ label: "For Startups", slug: "startups" },
			{ label: "For Agencies", slug: "agencies" },
			{ label: "For Enterprises", slug: "enterprises" },
			{ label: "For DevOps", slug: "devops" },
		].map((link) => ({
			label: link.label,
			href: routes.marketing.audience.href({ slug: link.slug }),
		})),
	},
	{
		title: "Compare",
		links: [
			{ label: "vs UptimeRobot", slug: "uptimerobot" },
			{ label: "vs Pingdom", slug: "pingdom" },
			{ label: "vs Better Uptime", slug: "better-uptime" },
			{ label: "vs Healthchecks.io", slug: "healthchecks" },
			{ label: "vs Cronitor", slug: "cronitor" },
			{ label: "vs Checkly", slug: "checkly" },
			{ label: "vs StatusCake", slug: "statuscake" },
			{ label: "vs Datadog", slug: "datadog" },
			{ label: "vs Site24x7", slug: "site24x7" },
			{ label: "vs Oh Dear", slug: "ohdear" },
		].map((link) => ({
			label: link.label,
			href: routes.marketing.comparison.href({ slug: link.slug }),
		})),
	},
	{
		title: "Documentation",
		links: [
			{ label: "Overview", href: routes.docs.index.href() },
			{ label: "Quick Start", href: "/docs/quickstart" },
			{ label: "API Reference", href: "/docs/api/overview" },
		],
	},
	{
		title: "Legal",
		links: [
			{ label: "Terms of Service", href: routes.legal.terms.href() },
			{ label: "Privacy Policy", href: routes.legal.privacy.href() },
		],
	},
];

export default function MarketingLayout(handle: Handle<MarketingLayout.Props>) {
	return () => {
		let { isSignedIn, children } = handle.props;

		return (
			<div mix={[s.page, s.marketingFont]}>
				<header mix={[s.marketingHeader]}>
					<a href={routes.home.href()} mix={[s.marketingBrand]}>
						Uptime
					</a>

					<nav mix={[s.marketingNav]}>
						<a
							href={routes.marketing.feature.href({ slug: "monitors" })}
							mix={[s.marketingNavLink]}
						>
							Features
						</a>
						<a
							href={routes.marketing.comparison.href({ slug: "uptimerobot" })}
							mix={[s.marketingNavLink]}
						>
							Compare
						</a>
						<a href={`${routes.home.href()}#pricing`} mix={[s.marketingNavLink]}>
							Pricing
						</a>
						<a href={routes.docs.index.href()} mix={[s.marketingNavLink]}>
							Docs
						</a>

						{isSignedIn ? (
							<a href={routes.app.index.href()} mix={[s.buttonPrimary]}>
								Dashboard
							</a>
						) : (
							<form method="post" action={routes.auth.action.href()}>
								<button type="submit" mix={[s.buttonPrimary]}>
									Start Monitoring
								</button>
							</form>
						)}
					</nav>
				</header>

				<main>{children}</main>

				<footer mix={[s.marketingFooter]}>
					<div mix={[s.marketingFooterGrid]}>
						{FOOTER_COLUMNS.map((column) => (
							<div key={column.title}>
								<p mix={[s.marketingFooterHeading]}>{column.title}</p>
								{column.links.map((link) => (
									<a key={link.href} href={link.href} mix={[s.marketingFooterLink]}>
										{link.label}
									</a>
								))}
							</div>
						))}
					</div>

					<div mix={[s.marketingFooterBottom]}>
						© {new Date().getFullYear()} Uptime by Sergio Xalambrí. All rights reserved.
					</div>
				</footer>
			</div>
		);
	};
}
