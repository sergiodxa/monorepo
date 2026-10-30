/**
 * The book page's masthead: the wordmark, the page's sections and a buy button. Below the
 * `xl` container the sections move into the header's phone sheet, which closes itself
 * when a reader follows one of its in-page links.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { SiteHeader } from "@sdxc/ui/patterns";

import { DrawerDismiss } from "~/resources/components/drawer-dismiss";
import BookLogo from "~/resources/views/demos/book/logo";

/** The sections the bar links to, in page order. */
const SECTIONS: SiteHeader.Link[] = [
	{ href: "#sample", label: "Free chapter" },
	{ href: "#contents", label: "Contents" },
	{ href: "#author", label: "Author" },
	{ href: "#reviews", label: "Reviews" },
	{ href: "#pricing", label: "Pricing" },
];

/**
 * Renders the bar with its inline sections from the `xl` container, where five links,
 * the wordmark and the button fit on one line at their natural widths.
 *
 * @returns The render function producing the header.
 */
export default function BookHeader() {
	return () => (
		<SiteHeader
			brand={<BookLogo />}
			items={SECTIONS}
			cta={{ href: "#pricing", label: "Buy the book" }}
			navLabel="Sections"
			menuLabel="Open the section menu"
			closeLabel="Close the section menu"
			collapseAt="xl"
			sheet={<DrawerDismiss />}
		/>
	);
}
