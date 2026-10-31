/**
 * The footer every book page shares: the wordmark and a line on the book, the book's pages
 * and the author's links in two columns, and the copyright for the year the page is served.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { raw } from "@sdxc/u/general";
import { m } from "@sdxc/u/size";
import { SiteFooter } from "@sdxc/ui/patterns";

import Wordmark from "~/resources/views/site/wordmark";

namespace BookFooter {
	export interface Props {
		/** The book's landing. */
		landing: string;
		/** The book's short title, for the wordmark. */
		title: string;
		/** One line on what the book is. */
		tagline: string;
		/** The sample chapter's page, when the book has one. */
		sample?: string;
		/** The upgrade page, when the book has one. */
		upgrade?: string;
	}
}

/**
 * Renders the footer. The year is read when the page renders, so the line never goes stale.
 *
 * @param handle Runtime handle carrying the book's pages.
 * @returns The render function producing the footer.
 */
export default function BookFooter(handle: Handle<BookFooter.Props>) {
	return () => {
		let { landing, sample, tagline, title, upgrade } = handle.props;
		let columns: SiteFooter.Column[] = [
			{
				title: "The book",
				links: [
					...(sample ? [{ href: sample, label: "Free chapter" }] : []),
					{ href: `${landing}#pricing`, label: "Pricing" },
					...(upgrade ? [{ href: upgrade, label: "Upgrade" }] : []),
					{ href: `${landing}#faq`, label: "Questions" },
				],
			},
			{
				title: "Author",
				links: [
					{ href: "https://sergiodxa.com", label: "sergiodxa.com" },
					{ href: "https://x.com/sergiodxa", label: "@sergiodxa on X" },
					{ href: "mailto:hello@sergiodxa.com", label: "hello@sergiodxa.com" },
				],
			},
		];

		return (
			<SiteFooter
				brand={<Wordmark href={landing} title={title} />}
				tagline={tagline}
				columns={columns}
				legal={
					<p mix={[m(0)]}>© {new Date().getUTCFullYear()} Sergio Xalambrí. All rights reserved.</p>
				}
				ruled
				mix={[raw({ marginBlockStart: "auto" })]}
			/>
		);
	};
}
