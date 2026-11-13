/**
 * Undercurrent's masthead bar: the wordmark, the page's sections and a subscribe button.
 * Below the `xl` container the sections move into the header's phone sheet, which closes
 * itself when a reader follows one of its in-page links.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { DialogDismiss } from "@sdxc/ui";
import { SiteHeader } from "@sdxc/ui/landing";

import UndercurrentLogo from "~/resources/views/demos/newsletter/logo";

/** The sections the bar links to, in page order. */
const SECTIONS: SiteHeader.Link[] = [
	{ href: "#latest", label: "Letter" },
	{ href: "#listen", label: "Episodes" },
	{ href: "#archive", label: "Archive" },
	{ href: "#host", label: "About" },
];

/**
 * Renders the bar a little wider than the letter, like a letterhead, so four sections, the
 * wordmark and the button fit on one line from the `xl` container; membership is linked from
 * the footer.
 *
 * @returns The render function producing the header.
 */
export default function NewsletterHeader() {
	return () => (
		<SiteHeader
			id="undercurrent-header"
			brand={<UndercurrentLogo />}
			items={SECTIONS}
			cta={{ href: "#subscribe", label: "Subscribe" }}
			navLabel="Sections"
			menuLabel="Open the section menu"
			closeLabel="Close the section menu"
			collapseAt="xl"
			sheet={<DialogDismiss />}
			mix={[raw({ "--ui-landing-measure": "50rem" })]}
		/>
	);
}
