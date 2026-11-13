/**
 * Quoin's colophon: the studio's sections and addresses in ruled columns over its name set
 * across the full measure in the Didone, the way a portfolio closes on its imprint.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { SiteFooter } from "@sdxc/ui/landing";

import StudioLogo from "~/resources/views/demos/studio/logo";
import { DIDONE } from "~/resources/views/demos/studio/type";

/** The link columns: four, so a phone sets them two by two and a wide footer in one row. */
const COLUMNS: SiteFooter.Column[] = [
	{
		title: "Work",
		links: [
			{ href: "#work", label: "Harbour Line" },
			{ href: "#work", label: "Mercer Public Library" },
			{ href: "#work", label: "Oda Ceramics" },
		],
	},
	{
		title: "Studio",
		links: [
			{ href: "#process", label: "Process" },
			{ href: "#people", label: "People" },
			{ href: "#clients", label: "Clients" },
		],
	},
	{
		title: "Writing",
		links: [
			{ href: "#notes", label: "Notes" },
			{ href: "/examples/studio/feed.xml", label: "RSS feed" },
			{ href: "/examples/studio/talks", label: "Talks" },
		],
	},
	{
		title: "Contact",
		links: [
			{ href: "#start", label: "Start a project" },
			{ href: "#availability", label: "Availability" },
			{ href: "/examples/studio/visit", label: "Kloosterstraat 41, Antwerp" },
		],
	},
];

/**
 * Renders the footer with the wordmark, a one-line tagline and the studio's name across the
 * foot of the page.
 *
 * @returns The render function producing the footer.
 */
export default function StudioFooter() {
	return () => (
		<SiteFooter
			brand={<StudioLogo />}
			tagline="Design and engineering, in one room in Antwerp since 2014."
			columns={COLUMNS}
			legal="© 2026 Quoin BV · BE 0712.448.903"
			wordmark={<Wordmark />}
		/>
	);
}

/** The studio's name fitted to the full measure, in the ink, so any Didone the reader has spans it. */
function Wordmark() {
	return () => (
		<svg viewBox="0 0 1000 300" fill="var(--ui-neutral-fg-emphasis)" aria-hidden="true">
			<text
				x="0"
				y="222"
				textLength="1000"
				lengthAdjust="spacingAndGlyphs"
				font-family={DIDONE}
				font-size="300"
			>
				Quoin
			</text>
		</svg>
	);
}
