/**
 * Shared chrome for the `/docs` site: a searchable sidebar grouping every doc by
 * section, a topbar with a breadcrumb trail and a dashboard call to action, and the
 * article content column. Every doc page composes its content into this layout.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { ArrowRightIcon, MenuIcon } from "@pkg/lucide-remix";
import { css, Fragment } from "remix/ui";

import type { DocSection } from "~/app/services/docs";

import DocsNav from "~/resources/components/docs-nav";
import AuthCta from "~/resources/components/marketing/auth-cta";

/** Neutral scale shades used on this page, hue 145. */
const neutral = {
	50: "oklch(0.98 0.005 145)",
	100: "oklch(0.96 0.005 145)",
	200: "oklch(0.91 0.008 145)",
	400: "oklch(0.73 0.01 145)",
	500: "oklch(0.62 0.01 145)",
	600: "oklch(0.52 0.01 145)",
	800: "oklch(0.32 0.006 145)",
	900: "oklch(0.24 0.005 145)",
	950: "oklch(0.16 0.004 145)",
};

/**
 * The hamburger button that opens the sidebar on mobile via the native Command
 * Invoker API (`commandfor`/`command="toggle-popover"`). Hidden at ≥768px.
 */
const sidebarToggle = css({
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	width: 32,
	height: 32,
	padding: 0,
	borderRadius: 6,
	border: "none",
	background: "transparent",
	color: "inherit",
	cursor: "pointer",
	flexShrink: 0,
	"&:hover": { background: neutral[100] },
	"@media (min-width: 768px)": { display: "none" },
	"@media (prefers-color-scheme: dark)": { "&:hover": { background: neutral[800] } },
});

/** The sidebar's title, e.g. "Documentation". */
const sidebarTitleCss = css({
	fontWeight: 700,
	fontSize: "1.0625rem",
	margin: "0 20px",
	color: neutral[900],
	"@media (prefers-color-scheme: dark)": { color: neutral[50] },
});

/** The sidebar's subtitle, e.g. "Guides and reference". */
const sidebarDescriptionCss = css({
	fontSize: "0.8125rem",
	margin: "4px 20px 20px",
	color: neutral[500],
	"@media (prefers-color-scheme: dark)": { color: neutral[400] },
});

/** The topbar row: nav toggle + breadcrumb on the left, the dashboard CTA on the right. */
const topbar = css({
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: 16,
	padding: "12px 20px",
	borderBottom: `1px solid ${neutral[200]}`,
	"@media (prefers-color-scheme: dark)": { borderColor: neutral[800] },
});

const topbarLeft = css({ display: "flex", alignItems: "center", gap: 12, minWidth: 0 });

/** The small, muted `docs > overview`-style breadcrumb trail. */
const breadcrumbTrail = css({
	display: "flex",
	alignItems: "center",
	gap: 4,
	fontSize: "0.8125rem",
	color: neutral[500],
	overflow: "hidden",
	textOverflow: "ellipsis",
	whiteSpace: "nowrap",
	"@media (prefers-color-scheme: dark)": { color: neutral[400] },
});

/** A linked (non-current) breadcrumb segment. */
const breadcrumbLink = css({
	color: "inherit",
	textDecoration: "none",
	"&:hover": { textDecoration: "underline" },
});

/** The current, non-linked breadcrumb segment. */
const breadcrumbCurrent = css({
	color: neutral[900],
	fontWeight: 500,
	"@media (prefers-color-scheme: dark)": { color: neutral[50] },
});

/** The `›` glyph separating breadcrumb segments. */
const breadcrumbSeparator = css({ flexShrink: 0 });

namespace DocsLayout {
	export interface Props {
		sections: DocSection[];
		/** Current doc's `/docs/...` path, compared against each nav link to mark it active. */
		activePath?: string;
		/** The `docs > overview`-style breadcrumb trail; the last item renders as plain (non-linked) text. */
		breadcrumbs?: Array<{ label: string; href?: string }>;
		isSignedIn: boolean;
		dashboardLabel: string;
		startLabel: string;
		sidebarTitle: string;
		sidebarDescription: string;
		searchPlaceholder: string;
		toggleNavLabel: string;
		children: RemixNode;
	}
}

/** Renders the searchable docs sidebar, a breadcrumb + dashboard-CTA topbar, and `children` as the article column. */
export default function DocsLayout(handle: Handle<DocsLayout.Props>) {
	return () => {
		let {
			sections,
			activePath = "",
			breadcrumbs = [],
			isSignedIn,
			dashboardLabel,
			startLabel,
			sidebarTitle,
			sidebarDescription,
			searchPlaceholder,
			toggleNavLabel,
			children,
		} = handle.props;

		let navSections = sections.map((section) => ({
			title: section.title,
			docs: section.docs.map((doc) => ({ path: doc.path, title: doc.frontmatter.title })),
		}));

		return (
			<div mix={[css({ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 })]}>
				<div
					mix={[
						css({
							display: "flex",
							flex: 1,
							minHeight: 0,
							maxWidth: 1152,
							margin: "0 auto",
							width: "100%",
						}),
					]}
				>
					{/*
					 * Fully hidden below 768px and replaced by a slide-in native
					 * popover drawer triggered by the topbar's hamburger. At ≥768px
					 * this resets to a normal static column (`!important` beats
					 * the UA `[popover]:not(:popover-open) { display: none }`).
					 */}
					<aside
						id="docs-sidebar"
						popover="auto"
						mix={[
							css({
								position: "fixed",
								top: 0,
								left: 0,
								bottom: 0,
								margin: 0,
								width: "min(80vw, 288px)",
								maxHeight: "100vh",
								padding: "24px 0",
								border: "none",
								borderRight: `1px solid ${neutral[200]}`,
								background: "#ffffff",
								boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)",
								"&::backdrop": { background: "rgba(0, 0, 0, 0.4)" },
								"@media (min-width: 768px)": {
									display: "block !important",
									position: "static",
									top: "auto",
									left: "auto",
									bottom: "auto",
									width: 272,
									maxHeight: "none",
									flexShrink: 0,
									boxShadow: "none",
									overflowY: "auto",
								},
								"@media (prefers-color-scheme: dark)": {
									background: neutral[950],
									borderColor: neutral[800],
								},
							}),
						]}
					>
						<p mix={[sidebarTitleCss]}>{sidebarTitle}</p>
						<p mix={[sidebarDescriptionCss]}>{sidebarDescription}</p>

						<DocsNav
							sections={navSections}
							activePath={activePath}
							searchPlaceholder={searchPlaceholder}
						/>
					</aside>

					<div mix={[css({ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 })]}>
						<div mix={[topbar]}>
							<div mix={[topbarLeft]}>
								<button
									type="button"
									commandfor="docs-sidebar"
									command="toggle-popover"
									aria-label={toggleNavLabel}
									mix={[sidebarToggle]}
								>
									<MenuIcon size={18} strokeWidth={1.5} />
								</button>

								{breadcrumbs.length > 0 && (
									<div mix={[breadcrumbTrail]}>
										{breadcrumbs.map((crumb, index) => (
											<Fragment key={`${crumb.label}-${index}`}>
												{index > 0 && (
													<span mix={[breadcrumbSeparator]} aria-hidden="true">
														›
													</span>
												)}
												{crumb.href ? (
													<a href={crumb.href} mix={[breadcrumbLink]}>
														{crumb.label}
													</a>
												) : (
													<span aria-current="page" mix={[breadcrumbCurrent]}>
														{crumb.label}
													</span>
												)}
											</Fragment>
										))}
									</div>
								)}
							</div>

							<AuthCta
								isSignedIn={isSignedIn}
								dashboardLabel={dashboardLabel}
								startLabel={startLabel}
								size="sm"
								icon={<ArrowRightIcon size={16} strokeWidth={1.5} />}
							/>
						</div>

						<div
							mix={[
								css({
									flex: 1,
									minWidth: 0,
									padding: "32px 24px 80px",
									lineHeight: 1.75,
									"& h1": {
										fontSize: "1.875rem",
										fontWeight: 700,
										letterSpacing: "-0.025em",
										lineHeight: 1,
										margin: "0 0 16px",
										color: neutral[900],
									},
									"& h2": {
										fontSize: "1.5rem",
										fontWeight: 700,
										margin: "48px 0 24px",
										color: neutral[900],
									},
									"& h3": {
										fontSize: "1.25rem",
										fontWeight: 600,
										margin: "0 0 12px",
										color: neutral[900],
									},
									"& p": { margin: "20px 0" },
									"@media (prefers-color-scheme: dark)": {
										"& h1, & h2, & h3": { color: neutral[50] },
									},
								}),
							]}
						>
							{children}
						</div>
					</div>
				</div>
			</div>
		);
	};
}
