/**
 * The conference page's bar: the mark, the page's sections and the ticket button. Below the
 * `xl` container the sections move into the phone sheet, which closes itself when a reader
 * follows one of its in-page links.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { DialogDismiss } from "@sdxc/ui";
import { SiteHeader } from "@sdxc/ui/landing";

import ConferenceLogo from "~/resources/views/demos/conference/logo";

/** The sections the bar links to, in page order. */
const SECTIONS: SiteHeader.Link[] = [
	{ href: "#schedule", label: "Schedule" },
	{ href: "#speakers", label: "Speakers" },
	{ href: "#venue", label: "Venue" },
	{ href: "#tickets", label: "Tickets" },
	{ href: "#talks", label: "Past talks" },
	{ href: "#travel", label: "Travel" },
];

/**
 * Renders the bar with its sections inline from the `xl` container, where six links, the
 * mark and the button fit on one line.
 *
 * @returns The render function producing the header.
 */
export default function ConferenceHeader() {
	return () => (
		<SiteHeader
			id="overprint-header"
			brand={<ConferenceLogo />}
			items={SECTIONS}
			cta={{ href: "#tickets", label: "Get a ticket" }}
			navLabel="Sections"
			menuLabel="Open the section menu"
			closeLabel="Close the section menu"
			collapseAt="xl"
			sheet={<DialogDismiss />}
		/>
	);
}
