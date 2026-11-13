/**
 * Quoin's masthead: the wordmark, the portfolio's sections and the one way to start a
 * project. Below the `lg` container the sections move into the header's phone sheet, which
 * closes itself when a reader follows one of its in-page links.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { DialogDismiss } from "@sdxc/ui";
import { SiteHeader } from "@sdxc/ui/landing";

import StudioLogo from "~/resources/views/demos/studio/logo";

/** The sections the bar links to, in page order. */
const SECTIONS: SiteHeader.Link[] = [
	{ href: "#work", label: "Work" },
	{ href: "#clients", label: "Clients" },
	{ href: "#process", label: "Process" },
	{ href: "#people", label: "People" },
	{ href: "#notes", label: "Notes" },
];

/**
 * Renders the bar with its inline sections from the `lg` container, where five short
 * links, the wordmark and the button share one line.
 *
 * @returns The render function producing the header.
 */
export default function StudioHeader() {
	return () => (
		<SiteHeader
			id="studio-header"
			brand={<StudioLogo />}
			items={SECTIONS}
			cta={{ href: "#start", label: "Start a project" }}
			navLabel="Sections"
			menuLabel="Open the section menu"
			closeLabel="Close the section menu"
			collapseAt="lg"
			sheet={<DialogDismiss />}
		/>
	);
}
