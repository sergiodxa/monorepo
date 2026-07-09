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

import { css } from "remix/ui";

import AuthCta from "~/resources/components/marketing/auth-cta";
import routes from "~/routes/web";

/** Neutral scale shades used on this page, hue 145. */
const neutral = {
	50: "oklch(0.98 0.005 145)",
	200: "oklch(0.91 0.008 145)",
	400: "oklch(0.73 0.01 145)",
	500: "oklch(0.62 0.01 145)",
	600: "oklch(0.52 0.01 145)",
	800: "oklch(0.32 0.006 145)",
	900: "oklch(0.24 0.005 145)",
	950: "oklch(0.16 0.004 145)",
};

/** Primary (brand) scale shades used on this page, hue 142. */
const primary = { 600: "oklch(0.6 0.16 142)", 400: "oklch(0.78 0.16 142)" };

/** Marketing/docs font stack — the OLD APP's `--font-sans` (Mona Sans, with system fallbacks). */
const fontSans =
	'"Mona Sans", ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"';

/** Inserts an alpha channel into an `oklch(...)` color string. */
function alpha(color: string, value: number): string {
	return color.replace(/\)$/, ` / ${value})`);
}

/** Page-level flex column filling the viewport height. */
const page = css({ display: "flex", flexDirection: "column", minHeight: "100vh" });

namespace MarketingLayout {
	export interface Props {
		isSignedIn: boolean;
		children: RemixNode;
	}
}

interface FooterColumn {
	title: string;
	links: Array<{ label: string; href: string }>;
}

/**
 * One entry per footer grid cell. Most cells hold a single column; the last
 * one bundles Documentation+Legal together, matching the OLD APP's 5-column
 * footer grid (`sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5`) where those two
 * groups share a single cell instead of getting one each.
 */
type FooterCell =
	| { kind: "column"; column: FooterColumn }
	| { kind: "combined"; columns: FooterColumn[] };

const FOOTER_COLUMNS: FooterColumn[] = [
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

const FOOTER_GRID: FooterCell[] = [
	...FOOTER_COLUMNS.slice(0, 4).map((column): FooterCell => ({ kind: "column", column })),
	{ kind: "combined", columns: FOOTER_COLUMNS.slice(4) },
];

const HEADER_NAV_LINKS = [
	{ href: routes.marketing.feature.href({ slug: "monitors" }), label: "Features" },
	{ href: routes.marketing.comparison.href({ slug: "uptimerobot" }), label: "Compare" },
	{ href: `${routes.home.href()}#pricing`, label: "Pricing" },
	{ href: routes.docs.index.href(), label: "Docs" },
];

export default function MarketingLayout(handle: Handle<MarketingLayout.Props>) {
	return () => {
		let { isSignedIn, children } = handle.props;

		return (
			<div mix={[page, css({ fontFamily: fontSans })]}>
				<header
					mix={[
						css({
							position: "sticky",
							top: 0,
							zIndex: 10,
							display: "flex",
							alignItems: "center",
							justifyContent: "space-between",
							gap: 16,
							padding: "14px 24px",
							borderBottom: `1px solid ${neutral[200]}`,
							background: "rgba(255, 255, 255, 0.8)",
							backdropFilter: "blur(12px)",
							"@media (prefers-color-scheme: dark)": {
								borderColor: neutral[800],
								background: alpha(neutral[950], 0.8),
							},
						}),
					]}
				>
					<a
						href={routes.home.href()}
						mix={[
							css({
								fontWeight: 700,
								fontSize: "1.25rem",
								textDecoration: "none",
								color: neutral[900],
								"@media (prefers-color-scheme: dark)": { color: neutral[50] },
							}),
						]}
					>
						Uptime
					</a>

					<nav mix={[css({ display: "flex", alignItems: "center", gap: 20 })]}>
						{/*
						 * The OLD APP hides these nav links entirely below `md` —
						 * no hamburger/drawer here, only the logo and CTA remain
						 * visible on mobile.
						 */}
						{HEADER_NAV_LINKS.map((link) => (
							<a
								key={link.href}
								href={link.href}
								mix={[
									css({
										fontSize: "0.875rem",
										color: neutral[600],
										textDecoration: "none",
										"&:hover": { color: primary[600] },
										"@media (prefers-color-scheme: dark)": {
											color: neutral[400],
											"&:hover": { color: primary[400] },
										},
									}),
									css({
										display: "none",
										"@media (min-width: 768px)": { display: "inline" },
									}),
								]}
							>
								{link.label}
							</a>
						))}

						<AuthCta isSignedIn={isSignedIn} dashboardLabel="Dashboard" size="sm" />
					</nav>
				</header>

				<main>{children}</main>

				<footer
					mix={[
						css({
							borderTop: `1px solid ${neutral[200]}`,
							background: "#ffffff",
							padding: "48px 24px 24px",
							"@media (prefers-color-scheme: dark)": {
								borderColor: neutral[800],
								background: neutral[950],
							},
						}),
					]}
				>
					<div
						mix={[
							css({
								display: "grid",
								gap: 32,
								gridTemplateColumns: "1fr",
								maxWidth: 1152,
								margin: "0 auto 32px",
								"@media (min-width: 640px)": { gridTemplateColumns: "repeat(2, 1fr)" },
								"@media (min-width: 768px)": { gridTemplateColumns: "repeat(3, 1fr)" },
								"@media (min-width: 1024px)": { gridTemplateColumns: "repeat(5, 1fr)" },
							}),
						]}
					>
						{FOOTER_GRID.map((cell) =>
							cell.kind === "column" ? (
								<div key={cell.column.title}>
									<p
										mix={[
											css({
												fontSize: "0.875rem",
												fontWeight: 600,
												color: neutral[900],
												marginBottom: 16,
												"@media (prefers-color-scheme: dark)": { color: neutral[50] },
											}),
										]}
									>
										{cell.column.title}
									</p>
									{cell.column.links.map((link) => (
										<a
											key={link.href}
											href={link.href}
											mix={[
												css({
													display: "block",
													fontSize: "0.875rem",
													color: neutral[600],
													textDecoration: "none",
													marginBottom: 8,
													"&:hover": { color: primary[600] },
													"@media (prefers-color-scheme: dark)": {
														color: neutral[400],
														"&:hover": { color: primary[400] },
													},
												}),
											]}
										>
											{link.label}
										</a>
									))}
								</div>
							) : (
								// Bundles Documentation+Legal into one grid cell, matching
								// the OLD APP's 5th footer column (`flex flex-col gap-8`).
								<div
									key="docs-legal"
									mix={[css({ display: "flex", flexDirection: "column", gap: 32 })]}
								>
									{cell.columns.map((column) => (
										<div key={column.title}>
											<p
												mix={[
													css({
														fontSize: "0.875rem",
														fontWeight: 600,
														color: neutral[900],
														marginBottom: 16,
														"@media (prefers-color-scheme: dark)": { color: neutral[50] },
													}),
												]}
											>
												{column.title}
											</p>
											{column.links.map((link) => (
												<a
													key={link.href}
													href={link.href}
													mix={[
														css({
															display: "block",
															fontSize: "0.875rem",
															color: neutral[600],
															textDecoration: "none",
															marginBottom: 8,
															"&:hover": { color: primary[600] },
															"@media (prefers-color-scheme: dark)": {
																color: neutral[400],
																"&:hover": { color: primary[400] },
															},
														}),
													]}
												>
													{link.label}
												</a>
											))}
										</div>
									))}
								</div>
							),
						)}
					</div>

					<div
						mix={[
							css({
								maxWidth: 1152,
								margin: "0 auto",
								marginTop: 24,
								textAlign: "center",
								fontSize: "0.8125rem",
								color: neutral[500],
								"@media (prefers-color-scheme: dark)": { color: neutral[400] },
							}),
						]}
					>
						© {new Date().getFullYear()} Uptime by Sergio Xalambrí. All rights reserved.
					</div>
				</footer>
			</div>
		);
	};
}
