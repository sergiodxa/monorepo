/**
 * Shared chrome for the public marketing site: a sticky top nav (brand, feature/docs
 * links, sign-in or dashboard call to action) and a multi-column footer. Every
 * `/features/:slug`, `/for/:slug`, `/use-cases/:slug`, `/vs/:slug`, `/privacy`,
 * `/terms`, `/docs`, and the homepage compose their content into this layout. It
 * exists so those 40+ public pages share one header/footer instead of repeating
 * the chrome per page.
 *
 * Every piece of copy — the brand mark, nav labels, CTA labels, footer columns, and
 * the copyright line — arrives as a plain, already-translated prop, the same
 * convention `AppShell` uses for its own `heading`/`breadcrumbs` props: this layout
 * never reads `ctx.i18next` itself. {@link buildMarketingChrome} centralizes the
 * `t()` calls building those props (and the `routes`-derived hrefs alongside them)
 * so every calling controller (home, the marketing/legal pages) shares one
 * definition instead of repeating the same dozens of `t()` calls seven times over.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TFunction } from "i18next";
import type { Handle, RemixNode } from "remix/ui";

import { NavLink } from "@pkg/r3-ui";
import { css } from "remix/ui";

import AuthCta from "~/resources/components/marketing/auth-cta";
import { fontSans } from "~/resources/theme";
import routes from "~/routes/web";

/** Page-level flex column filling the viewport height. */
const page = css({ display: "flex", flexDirection: "column", minHeight: "100vh" });

namespace MarketingLayout {
	export interface Props {
		isSignedIn: boolean;
		/** Brand mark shown at the header's leading edge, linking home (`landing.header.title`). */
		brandLabel: string;
		/** Header nav links, already translated and pointed at their `routes.*` hrefs. */
		navLinks: Array<{ href: string; label: string }>;
		/** Label for the header CTA's signed-in state (`landing.header.nav.cta.in`). */
		dashboardLabel: string;
		/** Label for the header CTA's signed-out state (`landing.header.nav.cta.out`). */
		startLabel: string;
		/** Footer columns, already translated and pointed at their `routes.*` hrefs. */
		footerColumns: FooterColumn[];
		/** Fully formatted copyright line (`landing.footer.copyright`, year already interpolated). */
		copyrightLine: string;
		children: RemixNode;
	}
}

export interface FooterColumn {
	title: string;
	links: Array<{ label: string; href: string }>;
}

/**
 * One entry per footer grid cell. Most cells hold a single column; the last
 * one bundles Documentation and Legal together into a single cell instead of
 * each getting its own.
 */
type FooterCell =
	| { kind: "column"; column: FooterColumn }
	| { kind: "combined"; columns: FooterColumn[] };

/** Splits {@link MarketingLayout.Props.footerColumns} into the footer's grid cells — the last two columns share one cell, every other gets its own. */
function buildFooterGrid(footerColumns: FooterColumn[]): FooterCell[] {
	return [
		...footerColumns.slice(0, 4).map((column): FooterCell => ({ kind: "column", column })),
		{ kind: "combined", columns: footerColumns.slice(4) },
	];
}

/**
 * Builds every translated, already-`t()`-resolved prop {@link MarketingLayout}
 * needs, from a controller's own `ctx.i18next.t`. Centralized here (rather than
 * repeated across every marketing/legal controller) since the nav/footer link
 * structure — which labels pair with which `routes.*` href — belongs to this
 * layout's own chrome, not to any one page's content.
 *
 * @example
 * let chrome = buildMarketingChrome(ctx.i18next.t);
 * return ctx.render(
 * 	<DocumentLayout title={...}>
 * 		<MarketingLayout isSignedIn={isSignedIn} {...chrome}>
 * 			{...}
 * 		</MarketingLayout>
 * 	</DocumentLayout>,
 * );
 */
export function buildMarketingChrome(
	t: TFunction,
): Omit<MarketingLayout.Props, "isSignedIn" | "children"> {
	let footerColumns: FooterColumn[] = [
		{
			title: t("landing.footer.sections.features.title"),
			links: [
				{ label: t("landing.footer.sections.features.monitors"), slug: "monitors" },
				{ label: t("landing.footer.sections.features.alerts"), slug: "alerts" },
				{ label: t("landing.footer.sections.features.statusPages"), slug: "status-pages" },
				{ label: t("landing.footer.sections.features.ssl"), slug: "ssl" },
				{ label: t("landing.footer.sections.features.dns"), slug: "dns" },
				{ label: t("landing.footer.sections.features.cronJobs"), slug: "cron-jobs" },
				{
					label: t("landing.footer.sections.features.contentMonitoring"),
					slug: "content-monitoring",
				},
				{ label: t("landing.footer.sections.features.maintenance"), slug: "maintenance" },
				{ label: t("landing.footer.sections.features.integrations"), slug: "integrations" },
				{ label: t("landing.footer.sections.features.teams"), slug: "teams" },
				{ label: t("landing.footer.sections.features.analytics"), slug: "analytics" },
				{ label: t("landing.footer.sections.features.api"), slug: "api" },
			].map((link) => ({
				label: link.label,
				href: routes.marketing.feature.href({ slug: link.slug }),
			})),
		},
		{
			title: t("landing.footer.sections.useCases.title"),
			links: [
				{
					label: t("landing.footer.sections.useCases.websiteMonitoring"),
					slug: "website-monitoring",
				},
				{ label: t("landing.footer.sections.useCases.apiMonitoring"), slug: "api-monitoring" },
				{ label: t("landing.footer.sections.useCases.saas"), slug: "saas" },
				{ label: t("landing.footer.sections.useCases.ecommerce"), slug: "ecommerce" },
				{ label: t("landing.footer.sections.useCases.cronJobs"), slug: "cron-jobs" },
				{ label: t("landing.footer.sections.useCases.microservices"), slug: "microservices" },
				{ label: t("landing.footer.sections.useCases.healthChecks"), slug: "healthcheck" },
			].map((link) => ({
				label: link.label,
				href: routes.marketing.useCase.href({ slug: link.slug }),
			})),
		},
		{
			title: t("landing.footer.sections.solutions.title"),
			links: [
				{ label: t("landing.footer.sections.solutions.indieHackers"), slug: "indie-hackers" },
				{ label: t("landing.footer.sections.solutions.soloDevs"), slug: "solo-devs" },
				{ label: t("landing.footer.sections.solutions.startups"), slug: "startups" },
				{ label: t("landing.footer.sections.solutions.agencies"), slug: "agencies" },
				{ label: t("landing.footer.sections.solutions.enterprises"), slug: "enterprises" },
				{ label: t("landing.footer.sections.solutions.devops"), slug: "devops" },
			].map((link) => ({
				label: link.label,
				href: routes.marketing.audience.href({ slug: link.slug }),
			})),
		},
		{
			title: t("landing.footer.sections.compare.title"),
			links: [
				{ label: t("landing.footer.sections.compare.uptimerobot"), slug: "uptimerobot" },
				{ label: t("landing.footer.sections.compare.pingdom"), slug: "pingdom" },
				{ label: t("landing.footer.sections.compare.betterUptime"), slug: "better-uptime" },
				{ label: t("landing.footer.sections.compare.healthchecks"), slug: "healthchecks" },
				{ label: t("landing.footer.sections.compare.cronitor"), slug: "cronitor" },
				{ label: t("landing.footer.sections.compare.checkly"), slug: "checkly" },
				{ label: t("landing.footer.sections.compare.statuscake"), slug: "statuscake" },
				{ label: t("landing.footer.sections.compare.datadog"), slug: "datadog" },
				{ label: t("landing.footer.sections.compare.site24x7"), slug: "site24x7" },
				{ label: t("landing.footer.sections.compare.ohdear"), slug: "ohdear" },
			].map((link) => ({
				label: link.label,
				href: routes.marketing.comparison.href({ slug: link.slug }),
			})),
		},
		{
			title: t("landing.footer.sections.docs.title"),
			links: [
				{ label: t("landing.footer.sections.docs.overview"), href: routes.docs.index.href() },
				{ label: t("landing.footer.sections.docs.quickstart"), href: "/docs/quickstart" },
				{ label: t("landing.footer.sections.docs.apiReference"), href: "/docs/api/overview" },
			],
		},
		{
			title: t("landing.footer.sections.legal.title"),
			links: [
				{ label: t("landing.footer.sections.legal.terms"), href: routes.legal.terms.href() },
				{ label: t("landing.footer.sections.legal.privacy"), href: routes.legal.privacy.href() },
			],
		},
	];

	let navLinks = [
		{
			href: routes.marketing.feature.href({ slug: "monitors" }),
			label: t("landing.header.nav.features"),
		},
		{
			href: routes.marketing.comparison.href({ slug: "uptimerobot" }),
			label: t("landing.header.nav.compare"),
		},
		{ href: `${routes.home.href()}#pricing`, label: t("landing.header.nav.pricing") },
		{ href: routes.docs.index.href(), label: t("landing.header.nav.docs") },
	];

	return {
		brandLabel: t("landing.header.title"),
		navLinks,
		dashboardLabel: t("landing.header.nav.cta.in"),
		startLabel: t("landing.header.nav.cta.out"),
		footerColumns,
		copyrightLine: t("landing.footer.copyright", { year: new Date().getFullYear() }),
	};
}

/** Renders the sticky header nav and multi-column footer around `children`; the header's CTA switches on {@link MarketingLayout.Props.isSignedIn}. */
export default function MarketingLayout(handle: Handle<MarketingLayout.Props>) {
	return () => {
		let {
			isSignedIn,
			brandLabel,
			navLinks,
			dashboardLabel,
			startLabel,
			footerColumns,
			copyrightLine,
			children,
		} = handle.props;

		let footerGrid = buildFooterGrid(footerColumns);

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
							borderBottom: "1px solid var(--ui-neutral-border)",
							background: "color-mix(in oklab, var(--ui-neutral-bg-tint) 80%, transparent)",
							backdropFilter: "blur(12px)",
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
								color: "var(--ui-neutral-fg-emphasis)",
							}),
						]}
					>
						{brandLabel}
					</a>

					<nav mix={[css({ display: "flex", alignItems: "center", gap: 20 })]}>
						{/*
						 * Hidden entirely below `md` — no hamburger/drawer here,
						 * only the logo and CTA remain visible on mobile.
						 */}
						{navLinks.map((link) => (
							<NavLink
								key={link.href}
								href={link.href}
								hasBackground
								mix={[
									css({
										display: "none",
										fontSize: "0.875rem",
										color: "var(--ui-neutral-fg)",
										"&:hover": { color: "var(--ui-primary-fg)" },
										"@media (min-width: 768px)": { display: "inline" },
									}),
								]}
							>
								{link.label}
							</NavLink>
						))}

						<AuthCta
							isSignedIn={isSignedIn}
							dashboardLabel={dashboardLabel}
							startLabel={startLabel}
							size="sm"
						/>
					</nav>
				</header>

				<main>{children}</main>

				<footer
					mix={[
						css({
							borderTop: "1px solid var(--ui-neutral-border)",
							background: "var(--ui-neutral-bg-tint)",
							padding: "48px 24px 24px",
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
						{footerGrid.map((cell) =>
							cell.kind === "column" ? (
								<div key={cell.column.title}>
									<p
										mix={[
											css({
												fontSize: "0.875rem",
												fontWeight: 600,
												color: "var(--ui-neutral-fg-emphasis)",
												marginBottom: 16,
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
													color: "var(--ui-neutral-fg)",
													textDecoration: "none",
													marginBottom: 8,
													"&:hover": { color: "var(--ui-primary-fg)" },
												}),
											]}
										>
											{link.label}
										</a>
									))}
								</div>
							) : (
								/** Bundles Documentation and Legal into a single footer grid cell. */
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
														color: "var(--ui-neutral-fg-emphasis)",
														marginBottom: 16,
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
															color: "var(--ui-neutral-fg)",
															textDecoration: "none",
															marginBottom: 8,
															"&:hover": { color: "var(--ui-primary-fg)" },
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
								color: "var(--ui-neutral-fg-muted)",
							}),
						]}
					>
						{copyrightLine}
					</div>
				</footer>
			</div>
		);
	};
}
