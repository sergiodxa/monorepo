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
import { neutral } from "~/resources/theme";

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
	fontWeight: 600,
	fontSize: "1.125rem",
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
	padding: "12px 24px",
	background: "oklch(0.98 0.005 145 / 0.5)",
	borderBottom: `1px solid ${neutral[200]}`,
	"@media (prefers-color-scheme: dark)": {
		background: "oklch(0.24 0.005 145 / 0.5)",
		borderColor: neutral[800],
	},
});

const topbarLeft = css({ display: "flex", alignItems: "center", gap: 12, minWidth: 0 });

/** The small, muted `docs > overview`-style breadcrumb trail. */
const breadcrumbTrail = css({
	display: "flex",
	alignItems: "center",
	gap: 4,
	fontSize: "0.8125rem",
	color: neutral[500],
	minWidth: 0,
	"@media (prefers-color-scheme: dark)": { color: neutral[400] },
});

/**
 * A linked (non-current) breadcrumb segment. Allowed to shrink and truncate
 * with its own ellipsis so the trailing, current segment never loses space to
 * it on narrow viewports.
 */
const breadcrumbLink = css({
	color: "inherit",
	textDecoration: "none",
	minWidth: 0,
	overflow: "hidden",
	textOverflow: "ellipsis",
	whiteSpace: "nowrap",
	"&:hover": { textDecoration: "underline" },
});

/**
 * A middle segment that has no page of its own to link to (e.g. an `api` or
 * `resources` grouping crumb). Rendered as plain, non-linked text, but still
 * allowed to shrink and truncate like {@link breadcrumbLink} — only the
 * trailing, current segment is exempt from shrinking.
 */
const breadcrumbMuted = css({
	minWidth: 0,
	overflow: "hidden",
	textOverflow: "ellipsis",
	whiteSpace: "nowrap",
});

/** The current, non-linked breadcrumb segment. Never shrinks, so it stays visible. */
const breadcrumbCurrent = css({
	color: neutral[900],
	fontWeight: 500,
	flexShrink: 0,
	overflow: "hidden",
	textOverflow: "ellipsis",
	whiteSpace: "nowrap",
	maxWidth: "40vw",
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
			<div
				mix={[
					css({
						display: "flex",
						flexDirection: "column",
						height: "100dvh",
						overflow: "hidden",
					}),
				]}
			>
				<div
					mix={[
						css({
							display: "flex",
							flex: 1,
							minHeight: 0,
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
									width: 256,
									maxHeight: "none",
									flexShrink: 0,
									boxShadow: "none",
									overflowY: "auto",
								},
								"@media (prefers-color-scheme: dark)": {
									background: neutral[900],
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

					<div
						mix={[
							css({ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, minHeight: 0 }),
						]}
					>
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
												) : index === breadcrumbs.length - 1 ? (
													<span aria-current="page" mix={[breadcrumbCurrent]}>
														{crumb.label}
													</span>
												) : (
													<span mix={[breadcrumbMuted]}>{crumb.label}</span>
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
								size="docs"
								icon={<ArrowRightIcon size={16} strokeWidth={1.5} />}
							/>
						</div>

						<div
							mix={[
								css({
									flex: 1,
									minWidth: 0,
									minHeight: 0,
									overflowY: "auto",
									padding: "32px 24px 80px",
								}),
							]}
						>
							<div
								mix={[
									css({
										maxWidth: "896px",
										margin: "0 auto",
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
			</div>
		);
	};
}
