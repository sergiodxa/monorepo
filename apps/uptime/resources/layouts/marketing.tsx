/**
 * Shared header nav and footer chrome that every public marketing page
 * composes its content into: features, comparisons, use cases, docs, and
 * legal pages all share this one layout.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { TFunction } from "@sdxc/i18n";
import type { Handle, RemixNode } from "remix/ui";

import { bg, borderEdge, colorMix, fg } from "@sdxc/u/color";
import { backdropBlur } from "@sdxc/u/effects";
import {
	block,
	gap,
	grid,
	gridTemplate,
	hidden,
	hstack,
	inline,
	insTop,
	shrink,
	sticky,
	vstack,
} from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { bs, is, m, maxIs, mbe, minBs, p } from "@sdxc/u/size";
import { z } from "@sdxc/u/stacking";
import { hover } from "@sdxc/u/state";
import { font, fontSize, textAlign, textDecoration, weight } from "@sdxc/u/typography";
import { NavLink } from "@sdxc/ui";

import AuthCta from "~/resources/components/marketing/auth-cta";
import routes from "~/routes/web";

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

/**
 * The Uptime brand glyph: four `<path d>` values authored against a
 * 10240-unit grid and flipped into the `<svg>`'s 1024×1024 viewBox by the
 * shared `matrix(.1 0 0 -.1 0 1024)`, kept as data beside its one call site.
 */
const BRAND_MARK_PATHS = [
	"M2970 8530c-318-68-583-290-705-592-69-170-65-32-65-2155-1-1736 1-1927 15-1998 69-335 305-609 622-724 43-16 113-36 156-46l77-17v-332c0-303 2-334 19-366 26-49 62-72 119-78 66-6 99 10 317 153 99 65 349 229 555 364l375 246 1380 5c1369 6 1381 6 1460 27 187 50 337 135 466 263 142 142 233 309 274 503 22 102 22 3891 1 3994-70 332-301 600-614 713-175 63-53 60-2311 59-1948 0-2060-1-2141-19zm4313-337c216-82 369-241 422-439 15-53 16-245 16-1969-1-1685-3-1918-16-1970-60-227-241-406-471-465-75-19-116-20-1444-20-1143 0-1374-2-1407-14-22-8-73-35-114-61-258-166-847-550-860-561-8-8-19-14-22-14-4 0-7 123-7 273 0 252-1 274-20 304-28 47-64 61-176 69-210 14-339 69-470 199-64 63-90 98-123 165-76 155-71 11-71 2090 0 2064-4 1937 66 2078 84 172 245 301 433 347 47 11 409 13 2131 12l2075-2 58-22z",
	"M6344 7715c-200-43-373-211-419-406-64-275 84-550 350-648 83-31 211-38 295-17 243 61 410 258 427 501 18 265-173 515-436 571-80 17-137 17-217-1zM3540 7018c-56-29-82-73-82-138 0-58 24-105 69-136 25-17 54-22 145-28 717-44 1334-312 1832-795 339-329 591-744 710-1166 55-198 82-374 94-612 9-165 14-181 75-227 41-30 123-32 171-4 71 41 80 69 77 237-7 529-168 1043-471 1504-250 381-602 719-995 954-421 253-950 412-1425 429-149 6-157 5-200-18z",
	"M3567 6085c-77-27-114-88-104-172 3-25 13-57 24-71 42-56 61-62 224-78 195-18 284-35 434-85 540-180 955-583 1135-1105 51-148 77-275 89-440 12-151 14-158 55-202 72-77 217-59 260 32 29 62 17 310-25 501-86 396-280 739-581 1030-344 333-746 526-1231 590-143 18-229 19-280 0z",
	"M3537 5136c-48-18-62-29-81-70-24-50-20-112 9-161 29-50 75-75 138-75 65 0 184-25 282-58 241-83 424-259 501-482 21-58 42-205 44-302 0-4 15-24 32-44 94-107 253-75 288 57 14 50-3 225-31 333-86 328-340 605-673 735-182 71-412 101-509 67z",
];

export interface FooterColumn {
	title: string;
	links: Array<{ label: string; href: string }>;
}

/**
 * One entry per footer grid cell. Most cells hold a single column; the last
 * bundles Documentation and Legal together into one shared cell.
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
 * needs, from a controller's own `ctx.i18next.t`. Centralizes the nav/footer
 * link structure — which labels pair with which `routes.*` href — as this layout's own chrome.
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
				{ label: t("landing.footer.sections.features.flowMonitors"), slug: "flows" },
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
				{
					label: t("landing.footer.sections.useCases.loginFlows"),
					slug: "login-flow-monitoring",
				},
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
				/**
				 * Grouped with the legal pages: like them, it is a standing statement
				 * about how the service is run, and a reader looking for accountability
				 * checks this corner of a footer first.
				 */
				{ label: t("trust.footerLink"), href: routes.trust.href() },
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

/**
 * Renders the sticky header nav and multi-column footer around `children`;
 * the header's CTA switches on {@link MarketingLayout.Props.isSignedIn}, and
 * the brand mark stays `aria-hidden` so its link's accessible name is just the wordmark.
 */
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
			<div mix={[vstack(), minBs("100vh"), font("sans")]}>
				<header
					mix={[
						sticky(),
						insTop(0),
						z(10),
						hstack({ align: "center", justify: "between", gap: "16px" }),
						p("14px", "24px"),
						borderEdge("bottom", { color: "neutral", width: 1 }),
						bg(
							colorMix("oklab", { color: "var(--ui-neutral-bg-tint)", weight: 80 }, "transparent"),
						),
						backdropBlur(),
					]}
				>
					<a
						href={routes.home.href()}
						mix={[
							hstack({ align: "center", gap: "8px" }),
							weight(700),
							fontSize("1.25rem"),
							textDecoration("none"),
							fg("neutral.emphasis"),
						]}
					>
						<svg
							viewBox="0 0 1024 1024"
							width={36}
							height={36}
							fill="currentColor"
							aria-hidden="true"
							mix={[fg("brand"), is("36px"), bs("36px"), shrink(0)]}
						>
							<g transform="matrix(.1 0 0 -.1 0 1024)">
								{BRAND_MARK_PATHS.map((d) => (
									<path key={d} d={d} />
								))}
							</g>
						</svg>

						{brandLabel}
					</a>

					<nav mix={[hstack({ align: "center", gap: "20px" })]}>
						{navLinks.map((link) => (
							<NavLink
								key={link.href}
								href={link.href}
								hasBackground
								mix={[
									hidden(),
									fontSize("sm"),
									fg("neutral"),
									hover(fg("brand")),
									media("(min-width: 768px)", inline()),
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
						borderEdge("top", { color: "neutral", width: 1 }),
						bg("neutral.tint"),
						p("48px", "24px", "24px", "24px"),
					]}
				>
					<div
						mix={[
							grid(),
							gap("32px"),
							m(0, "auto", "32px", "auto"),
							maxIs("1152px"),
							gridTemplate({ columns: "1fr" }),
							media("(min-width: 640px)", gridTemplate({ columns: "repeat(2, 1fr)" })),
							media("(min-width: 768px)", gridTemplate({ columns: "repeat(3, 1fr)" })),
							media("(min-width: 1024px)", gridTemplate({ columns: "repeat(5, 1fr)" })),
						]}
					>
						{footerGrid.map((cell) =>
							cell.kind === "column" ? (
								<div key={cell.column.title}>
									<p mix={[fontSize("sm"), weight(600), fg("neutral.emphasis"), mbe("16px")]}>
										{cell.column.title}
									</p>
									{cell.column.links.map((link) => (
										<a
											key={link.href}
											href={link.href}
											mix={[
												block(),
												fontSize("sm"),
												fg("neutral"),
												textDecoration("none"),
												mbe("8px"),
												hover(fg("brand")),
											]}
										>
											{link.label}
										</a>
									))}
								</div>
							) : (
								<div key="docs-legal" mix={[vstack({ gap: "32px" })]}>
									{cell.columns.map((column) => (
										<div key={column.title}>
											<p mix={[fontSize("sm"), weight(600), fg("neutral.emphasis"), mbe("16px")]}>
												{column.title}
											</p>
											{column.links.map((link) => (
												<a
													key={link.href}
													href={link.href}
													mix={[
														block(),
														fontSize("sm"),
														fg("neutral"),
														textDecoration("none"),
														mbe("8px"),
														hover(fg("brand")),
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
							maxIs("1152px"),
							m("24px", "auto", 0, "auto"),
							textAlign("center"),
							fontSize("0.8125rem"),
							fg("neutral.muted"),
						]}
					>
						{copyrightLine}
					</div>
				</footer>
			</div>
		);
	};
}
