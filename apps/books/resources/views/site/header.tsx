/**
 * The masthead every book page shares: the wordmark, the landing's sections and the buy
 * button. On the landing the links are in-page anchors; elsewhere they lead back to it.
 * Below the `lg` container the sections move into the header's phone sheet.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { SiteHeader } from "@sdxc/ui/patterns";

import Wordmark from "~/resources/views/site/wordmark";

namespace BookHeader {
	export interface Props {
		/** The book's landing, which the mark and every section link point into. */
		landing: string;
		/** The book's short title, for the wordmark. */
		title: string;
		/** Whether the sample chapter exists, so its link is listed. */
		sample: boolean;
	}
}

/**
 * Renders the bar with five links, collapsing at `lg` where the wordmark, five links and
 * the button stop fitting one line.
 *
 * @param handle Runtime handle carrying the landing and title.
 * @returns The render function producing the header.
 */
export default function BookHeader(handle: Handle<BookHeader.Props>) {
	return () => {
		let { landing, sample, title } = handle.props;
		let items: SiteHeader.Link[] = [
			...(sample ? [{ href: `${landing}#sample`, label: "Free chapter" }] : []),
			{ href: `${landing}#inside`, label: "Inside" },
			{ href: `${landing}#author`, label: "Author" },
			{ href: `${landing}#pricing`, label: "Pricing" },
			{ href: `${landing}#faq`, label: "FAQ" },
		];

		return (
			<SiteHeader
				brand={<Wordmark href={landing} title={title} />}
				items={items}
				cta={{ href: `${landing}#pricing`, label: "Buy" }}
				navLabel="Sections"
				menuLabel="Open the section menu"
				closeLabel="Close the section menu"
				collapseAt="lg"
			/>
		);
	};
}
