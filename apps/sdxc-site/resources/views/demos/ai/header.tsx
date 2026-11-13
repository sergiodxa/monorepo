/**
 * Margin's header: the wordmark, the page's sections in reading order, and the sign-up.
 * Below the `lg` container the sections move into the phone sheet, which closes itself
 * when a reader follows one of its in-page links.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { DialogDismiss } from "@sdxc/ui";
import { SiteHeader } from "@sdxc/ui/landing";

import MarginLogo from "~/resources/views/demos/ai/logo";

/** The sections the bar links to, in page order. */
const SECTIONS: SiteHeader.Link[] = [
	{ href: "#sources", label: "How it works" },
	{ href: "#limits", label: "Limits" },
	{ href: "#privacy", label: "Privacy" },
	{ href: "#integrations", label: "Integrations" },
	{ href: "#pricing", label: "Pricing" },
];

/**
 * Renders the bar with a stable id, so its sheet ids match between renders.
 *
 * @returns The render function producing the header.
 */
export default function MarginHeader() {
	return () => (
		<SiteHeader
			id="margin-header"
			brand={<MarginLogo />}
			items={SECTIONS}
			cta={{ href: "/examples/margin/sign-up", label: "Try it free" }}
			navLabel="Sections"
			menuLabel="Open the section menu"
			closeLabel="Close the section menu"
			collapseAt="lg"
			sheet={<DialogDismiss />}
		/>
	);
}
