/**
 * Shared chrome for the `/docs` site: a searchable sidebar grouping every doc by
 * section, a topbar with a breadcrumb trail and a dashboard call to action, and the
 * article content column. Every doc page composes its content into this layout.
 *
 * Mirrors `resources/layouts/app-shell.tsx`'s own migration: the mobile drawer's
 * popover-attributed `<aside>` and its hamburger toggle stay a custom composition
 * (like `app-shell.tsx`'s `<nav popover>`, `@pkg/r3-ui`'s own `Sidebar` assumes a
 * persistent `<aside>` beside an `Inset` plus a separate `Dialog`-based
 * `MobileNav` tree for narrow viewports, which doesn't fit this single-drawer
 * layout) — but the pieces `@pkg/r3-ui` does have real, Provider-free components
 * for are swapped in: `Sidebar.Header`/`Sidebar.Content` for the drawer's own
 * structure, `Breadcrumbs` for the trail, and `Typeset` for the article's
 * typography.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { ArrowRightIcon, MenuIcon } from "@pkg/lucide-remix";
import { Breadcrumbs, Sidebar, Typeset } from "@pkg/r3-ui";
import { css } from "remix/ui";

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
	margin: 0,
	color: neutral[900],
	"@media (prefers-color-scheme: dark)": { color: neutral[50] },
});

/** The sidebar's subtitle, e.g. "Guides and reference". */
const sidebarDescriptionCss = css({
	fontSize: "0.8125rem",
	margin: "4px 0 0",
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
								padding: 0,
								border: "none",
								borderRight: `1px solid ${neutral[200]}`,
								background: "#ffffff",
								boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)",
								"&::backdrop": { background: "rgba(0, 0, 0, 0.4)" },
								display: "flex",
								flexDirection: "column",
								minHeight: 0,
								"@media (min-width: 768px)": {
									display: "flex !important",
									position: "static",
									top: "auto",
									left: "auto",
									bottom: "auto",
									width: 256,
									/**
									 * The native Popover API's UA stylesheet sets `height:
									 * fit-content` on every `[popover]` element regardless of open
									 * state (only `display` is gated behind `:popover-open`) — an
									 * explicit, author-stylesheet `height` is required to beat it,
									 * since stretch alignment from the flex row above only takes
									 * over once `height` itself resolves to `auto`.
									 */
									height: "auto",
									maxHeight: "none",
									flexShrink: 0,
									boxShadow: "none",
								},
								"@media (prefers-color-scheme: dark)": {
									background: neutral[900],
									borderColor: neutral[800],
								},
							}),
						]}
					>
						<Sidebar.Header
							mix={[
								css({
									flexDirection: "column",
									alignItems: "flex-start",
									blockSize: "auto",
									paddingBlock: "1.25rem",
								}),
							]}
						>
							<p mix={[sidebarTitleCss]}>{sidebarTitle}</p>
							<p mix={[sidebarDescriptionCss]}>{sidebarDescription}</p>
						</Sidebar.Header>

						<Sidebar.Content>
							<DocsNav
								sections={navSections}
								activePath={activePath}
								searchPlaceholder={searchPlaceholder}
							/>
						</Sidebar.Content>
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
									<Breadcrumbs aria-label="Breadcrumb">
										<Breadcrumbs.List>
											{breadcrumbs.map((crumb, index) => (
												<Breadcrumbs.Item key={`${crumb.label}-${index}`}>
													{crumb.href ? (
														<Breadcrumbs.Link href={crumb.href}>{crumb.label}</Breadcrumbs.Link>
													) : (
														<span>{crumb.label}</span>
													)}
												</Breadcrumbs.Item>
											))}
										</Breadcrumbs.List>
									</Breadcrumbs>
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
							<Typeset mix={[css({ maxWidth: "896px", margin: "0 auto" })]}>{children}</Typeset>
						</div>
					</div>
				</div>
			</div>
		);
	};
}
