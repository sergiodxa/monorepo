/**
 * Hollyhock's header and footer. The header carries the four things a neighbour looks for
 * (today's bake, the menu, the hours, the way in) and the pickup call; the footer repeats
 * the address, phone and hours so the bottom of the page answers the same questions.
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

import { Wordmark } from "~/resources/views/demos/bakery/art";

/**
 * The shop's phone number, from the 555-0100 to 555-0199 range set aside for fiction, written
 * the way `@sdxc/sample`'s national style writes one, so no one real gets the calls.
 */
export const PHONE = { label: "(555) 555-0142", href: "tel:+15555550142" } as const;

/** The header's sections, in the order the page reaches them. */
const NAV: Header.Link[] = [
	{ label: "Today's bake", href: "#today" },
	{ label: "Menu", href: "#menu" },
	{ label: "Hours", href: "#hours" },
	{ label: "Find us", href: "#visit" },
];

/** The footer's columns, each a title over links to this page's sections or a way to reach us. */
const FOOTER_COLUMNS: Footer.Column[] = [
	{
		title: "Visit",
		links: [
			{ label: "14 Alder Street", href: "#visit" },
			{ label: "Directions", href: "#visit" },
			{ label: "Step-free access", href: "#getting-in" },
			{ label: "Parking", href: "#getting-in" },
		],
	},
	{
		title: "Eat",
		links: [
			{ label: "Today's bake", href: "#today" },
			{ label: "Menu and prices", href: "#menu" },
			{ label: "Order for pickup", href: "#order" },
		],
	},
	{
		title: "Hours",
		links: [
			{ label: "Tue–Fri 7 am – 6 pm", href: "#hours" },
			{ label: "Sat 7 am – 4 pm", href: "#hours" },
			{ label: "Sun 8 am – 2 pm", href: "#hours" },
			{ label: "Holiday hours", href: "#hours" },
		],
	},
	{
		title: "Talk to us",
		links: [
			{ label: PHONE.label, href: PHONE.href },
			{ label: "Questions", href: "#questions" },
			{ label: "Neighbours' notes", href: "#neighbours" },
		],
	},
];

/**
 * The sticky header: the mark and name, four section links from the `lg` container up, the
 * phone number as a quiet action and the pickup order as the one call. The phone sheet
 * closes as soon as a link in it is followed.
 *
 * @returns The render function producing the header.
 */
export function SiteHeader() {
	return () => (
		<Header
			id="hollyhock-header"
			collapseAt="lg"
			navLabel="Sections"
			menuLabel="Open sections"
			closeLabel="Close sections"
			brand={
				<a
					href="#top"
					aria-label="Hollyhock Bakery, back to top"
					mix={[raw({ textDecoration: "none" })]}
				>
					<Wordmark />
				</a>
			}
			items={NAV}
			actions={[{ label: `Call ${PHONE.label}`, href: PHONE.href }]}
			cta={{ label: "Order ahead", href: "#order" }}
			sheet={<DialogDismiss />}
		/>
	);
}

/**
 * The footer: the name and a line about the bakery beside four columns, a legal line that
 * says plainly this is a demo, and the name drawn edge to edge in the sign face.
 *
 * @returns The render function producing the footer.
 */
export function SiteFooter() {
	return () => (
		<Footer
			label="Hollyhock Bakery"
			brand={
				<a
					href="#top"
					aria-label="Hollyhock Bakery, back to top"
					mix={[raw({ textDecoration: "none" })]}
				>
					<Wordmark />
				</a>
			}
			tagline="The corner bakery on Alder Street. Sourdough, buns and pies, baked through the night by Rosa, Mateo and a mixer called Big Dough."
			columns={FOOTER_COLUMNS}
			legal={
				<>
					<p mix={[text("sm"), leading("normal")]}>
						© 2026 Hollyhock Bakery. A demo landing; Hollyhock is not a real bakery.
					</p>
					<a href="#questions" mix={[fg("neutral"), hover(fg("neutral.emphasis"))]}>
						Allergens
					</a>
				</>
			}
			wordmark={<GiantWordmark />}
		/>
	);
}

/**
 * The name painted across the footer's full width in the sign face and the brand crust;
 * `textLength` fits the word to the box, so it never overflows or wraps.
 *
 * @returns The render function producing the drawing.
 */
function GiantWordmark() {
	return () => (
		<svg viewBox="0 0 1000 200" aria-hidden="true" fill="var(--ui-color-brand-500)">
			<text
				x="0"
				y="168"
				textLength="1000"
				lengthAdjust="spacingAndGlyphs"
				font-size="220"
				font-weight="700"
				mix={[raw({ fontFamily: "var(--ui-font-display)" })]}
			>
				Hollyhock
			</text>
		</svg>
	);
}
