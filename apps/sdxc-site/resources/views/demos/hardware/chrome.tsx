/**
 * Strata's own header and footer: the wordmark, the page's sections and the preorder call
 * in a bar that collapses to a sheet on phones, and a footer of section links that closes
 * the page with the demo disclaimer.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { hover } from "@sdxc/u/state";
import { leading, text } from "@sdxc/u/typography";
import { DialogDismiss } from "@sdxc/ui";
import { SiteFooter as Footer, SiteHeader as Header } from "@sdxc/ui/landing";

import { PREORDER } from "~/resources/views/demos/hardware/preorder-data";

/** The header's sections, in the order the page reaches them. */
const NAV: Header.Link[] = [
	{ label: "Design", href: "#design" },
	{ label: "Finishes", href: "#finishes" },
	{ label: "Specs", href: "#specs" },
	{ label: "Compare", href: "#compare" },
	{ label: "Reviews", href: "#reviews" },
];

/** The footer's columns, each a title over links to this page's sections. */
const FOOTER_COLUMNS: Footer.Column[] = [
	{
		title: "Strata Two",
		links: [
			{ label: "Design", href: "#design" },
			{ label: "Materials", href: "#materials" },
			{ label: "Finishes", href: "#finishes" },
			{ label: "Tech specs", href: "#specs" },
		],
	},
	{
		title: "Buying",
		links: [
			{ label: "Preorder", href: "#preorder" },
			{ label: "In the box", href: "#box" },
			{ label: "Compared with One", href: "#compare" },
			{ label: "Shipping and refunds", href: "#faq" },
		],
	},
	{
		title: "About",
		links: [
			{ label: "Press reviews", href: "#reviews" },
			{ label: "Questions", href: "#faq" },
		],
	},
];

/**
 * The Strata wordmark: three stacked bars, the board's layers, beside the name.
 *
 * @returns The render function producing the mark.
 */
export function Wordmark() {
	return () => (
		<span
			mix={[
				raw({
					display: "inline-flex",
					alignItems: "center",
					gap: "0.5rem",
					fontWeight: "650",
					fontSize: "1.0625rem",
					letterSpacing: "-0.01em",
					color: "var(--ui-neutral-fg-emphasis)",
				}),
			]}
		>
			<svg viewBox="0 0 20 16" aria-hidden="true" mix={[raw({ inlineSize: "1.25rem" })]}>
				<rect x="0" y="0" width="20" height="3.5" rx="1" fill="currentColor" />
				<rect x="2" y="6.25" width="16" height="3.5" rx="1" fill="currentColor" opacity="0.6" />
				<rect x="4" y="12.5" width="12" height="3.5" rx="1" fill="currentColor" opacity="0.35" />
			</svg>
			Strata
		</span>
	);
}

/**
 * The bar: the wordmark, five section links from the `lg` container up, and the preorder
 * call with the price at every width. The sheet closes as soon as a link is followed.
 *
 * @returns The render function producing the header.
 */
export function StrataHeader() {
	return () => (
		<Header
			id="strata-header"
			collapseAt="lg"
			navLabel="Sections"
			brand={
				<a href="#top" aria-label="Strata, back to top" mix={[raw({ textDecoration: "none" })]}>
					<Wordmark />
				</a>
			}
			items={NAV}
			cta={{ label: `Preorder · ${PREORDER.price}`, href: "#preorder" }}
			sheet={<DialogDismiss />}
		/>
	);
}

/**
 * The footer: the wordmark and what Strata makes beside three link columns, and the legal
 * line naming the page a demo.
 *
 * @returns The render function producing the footer.
 */
export function StrataFooter() {
	return () => (
		<Footer
			brand={
				<a href="#top" aria-label="Strata, back to top" mix={[raw({ textDecoration: "none" })]}>
					<Wordmark />
				</a>
			}
			tagline="Keyboards milled in small batches, each one numbered on the floor of its case."
			columns={FOOTER_COLUMNS}
			legal={
				<>
					<p mix={[text("sm"), leading("normal")]}>
						© 2026 Strata Instruments. A demo landing; Strata Two is not a real keyboard.
					</p>
					<a href="#faq" mix={[fg("neutral"), hover(fg("neutral.emphasis"))]}>
						Warranty
					</a>
				</>
			}
		/>
	);
}
