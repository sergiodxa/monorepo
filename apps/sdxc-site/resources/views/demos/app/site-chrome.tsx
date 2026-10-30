/**
 * Rooftree's own header and footer. The header floats as a rounded bar off the page edges
 * and opens a full-screen sheet on phones that closes when a section link is followed; the
 * footer carries the badges, four link columns and the oversized wordmark that ends the page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { vstack } from "@sdxc/u/layout";
import { hover } from "@sdxc/u/state";
import { leading, text } from "@sdxc/u/typography";
import { SiteFooter as Footer, SiteHeader as Header } from "@sdxc/ui/patterns";

import { DrawerDismiss } from "~/resources/components/drawer-dismiss";
import { Wordmark } from "~/resources/views/demos/app/brand";
import { StoreBadges } from "~/resources/views/demos/app/store-badges";

/** The header's sections, in the order the page reaches them. */
const NAV: Header.Link[] = [
	{ label: "Features", href: "#features" },
	{ label: "Stories", href: "#stories" },
	{ label: "Privacy", href: "#privacy" },
	{ label: "Pricing", href: "#pricing" },
];

/** The footer's columns, each a title over links to this page's sections. */
const FOOTER_COLUMNS: Footer.Column[] = [
	{
		title: "Product",
		links: [
			{ label: "Shared lists", href: "#features" },
			{ label: "Chore rota", href: "#features" },
			{ label: "Meal planning", href: "#features" },
			{ label: "Pricing", href: "#pricing" },
		],
	},
	{
		title: "Platforms",
		links: [
			{ label: "iPhone & iPad", href: "#download" },
			{ label: "Android", href: "#download" },
			{ label: "Mac & Windows", href: "#platforms" },
			{ label: "Apple Watch", href: "#platforms" },
		],
	},
	{
		title: "Trust",
		links: [
			{ label: "Privacy", href: "#privacy" },
			{ label: "Encryption", href: "#privacy" },
			{ label: "Reviews", href: "#stories" },
		],
	},
	{
		title: "Help",
		links: [
			{ label: "Questions", href: "#faq" },
			{ label: "Moving from paper", href: "#faq" },
			{ label: "Download", href: "#download" },
		],
	},
];

/**
 * The floating header: the wordmark, four section links and "Sign in" from the `lg`
 * container up, and the pill download call at every width. The phone sheet closes as
 * soon as a section link is followed, so the reader lands on the section, not the menu.
 *
 * @returns The render function producing the header.
 */
export function SiteHeader() {
	return () => (
		<Header
			variant="floating"
			collapseAt="lg"
			navLabel="Sections"
			brand={
				<a href="#top" aria-label="Rooftree, back to top" mix={[raw({ textDecoration: "none" })]}>
					<Wordmark />
				</a>
			}
			items={NAV}
			actions={[{ label: "Sign in", href: "#pricing" }]}
			cta={{ label: "Get the app", href: "#download" }}
			sheet={<DrawerDismiss />}
		/>
	);
}

/**
 * The page footer: the wordmark, what Rooftree is and the badges beside four link columns,
 * the legal line, and the name drawn edge to edge as the last thing on the page.
 *
 * @returns The render function producing the footer.
 */
export function SiteFooter() {
	return () => (
		<Footer
			ruled={false}
			brand={
				<a href="#top" aria-label="Rooftree, back to top" mix={[raw({ textDecoration: "none" })]}>
					<Wordmark />
				</a>
			}
			tagline="One shared list, rota and calendar for everyone under your roof. Made by a small team in Lisbon."
			newsletter={
				<div mix={[vstack({ gap: 3, align: "start" })]}>
					<StoreBadges />
				</div>
			}
			columns={FOOTER_COLUMNS}
			legal={
				<>
					<p mix={[text("sm"), leading("normal")]}>
						© 2026 Rooftree Labs. A demo landing; Rooftree is not a real app.
					</p>
					<a href="#privacy" mix={[fg("neutral"), hover(fg("neutral.emphasis"))]}>
						Privacy
					</a>
					<a href="#faq" mix={[fg("neutral"), hover(fg("neutral.emphasis"))]}>
						Terms
					</a>
				</>
			}
			wordmark={<GiantWordmark />}
		/>
	);
}

/**
 * The product name drawn across the footer's full width in the rounded display face and
 * the brand ink; `textLength` fits the word to the box, so it never overflows or wraps.
 *
 * @returns The render function producing the drawing.
 */
function GiantWordmark() {
	return () => (
		<svg viewBox="0 0 1000 214" fill="currentColor">
			<text
				x="0"
				y="196"
				textLength="1000"
				lengthAdjust="spacingAndGlyphs"
				font-size="262"
				font-weight="800"
				mix={[raw({ fontFamily: "var(--ui-font-display)" })]}
			>
				Rooftree
			</text>
		</svg>
	);
}
