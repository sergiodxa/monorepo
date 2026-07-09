/**
 * Shared chrome for the `/docs` site: a sidebar grouping every doc by section (no
 * client-side search — a plain, always-visible link list is enough for this app's
 * doc count) plus the article content column. Both the docs index and individual
 * doc pages compose their content into this layout.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/ui";

import { css } from "remix/ui";

import type { DocSection } from "~/app/services/docs";

import routes from "~/routes/web";

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

/** Primary (brand) scale shades used on this page, hue 142. */
const primary = { 600: "oklch(0.6 0.16 142)", 400: "oklch(0.78 0.16 142)" };

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
	"&:hover": { background: neutral[100] },
	"@media (min-width: 768px)": { display: "none" },
	"@media (prefers-color-scheme: dark)": { "&:hover": { background: neutral[800] } },
});

/** Marketing/docs brand mark, measured 20px. */
const marketingBrand = css({
	fontWeight: 700,
	fontSize: "1.25rem",
	textDecoration: "none",
	color: neutral[900],
	"@media (prefers-color-scheme: dark)": { color: neutral[50] },
});

/** One link inside a footer/sidebar column. */
const marketingFooterLink = css({
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
});

namespace DocsLayout {
	export interface Props {
		sections: DocSection[];
		children: RemixNode;
	}
}

export default function DocsLayout(handle: Handle<DocsLayout.Props>) {
	return () => {
		let { sections, children } = handle.props;

		return (
			<div mix={[css({ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 })]}>
				{/* Mobile-only topbar holding the sidebar's hamburger toggle, hidden at ≥768px. */}
				<div
					mix={[
						css({
							display: "flex",
							alignItems: "center",
							padding: "12px 20px",
							borderBottom: `1px solid ${neutral[200]}`,
							"@media (min-width: 768px)": { display: "none" },
							"@media (prefers-color-scheme: dark)": { borderColor: neutral[800] },
						}),
					]}
				>
					<button
						type="button"
						commandfor="docs-sidebar"
						command="toggle-popover"
						aria-label="Toggle navigation"
						mix={[sidebarToggle]}
					>
						<svg viewBox="0 0 20 20" width={18} height={18} fill="none" aria-hidden="true">
							<path
								d="M3 5h14M3 10h14M3 15h14"
								stroke="currentColor"
								strokeWidth={1.5}
								strokeLinecap="round"
							/>
						</svg>
					</button>
				</div>

				<div
					mix={[
						css({
							display: "flex",
							flex: 1,
							minHeight: 0,
							maxWidth: 1024,
							margin: "0 auto",
							width: "100%",
						}),
					]}
				>
					{/*
					 * Fully hidden below 768px and replaced by a slide-in native
					 * popover drawer triggered by the hamburger above, matching the
					 * OLD APP's docs sidebar (a `Sheet`-based mobile drawer). At
					 * ≥768px this resets to a normal static column (`!important`
					 * beats the UA `[popover]:not(:popover-open) { display: none }`).
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
								padding: "32px 20px",
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
									width: 240,
									maxHeight: "none",
									flexShrink: 0,
									boxShadow: "none",
								},
								"@media (prefers-color-scheme: dark)": {
									background: neutral[950],
									borderColor: neutral[800],
								},
							}),
						]}
					>
						<a href={routes.docs.index.href()} mix={[marketingBrand]}>
							Documentation
						</a>

						{sections.map((section) => (
							<div key={section.title}>
								<p
									mix={[
										css({
											fontSize: "0.75rem",
											fontWeight: 700,
											textTransform: "uppercase",
											letterSpacing: "0.03em",
											color: neutral[500],
											margin: "20px 0 8px",
											"@media (prefers-color-scheme: dark)": { color: neutral[400] },
										}),
									]}
								>
									{section.title}
								</p>
								{section.docs.map((doc) => (
									<a key={doc.path} href={doc.path} mix={[marketingFooterLink]}>
										{doc.frontmatter.title}
									</a>
								))}
							</div>
						))}
					</aside>

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
		);
	};
}
