/**
 * The 404 page: says the address leads nowhere and offers the two places worth going, the
 * featured book and the homepage, beside the book's cover.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { weight } from "@sdxc/u/typography";
import { CtaGroup, Link, LinkButton } from "@sdxc/ui";
import { FeatureBand } from "@sdxc/ui/landing";
import { landingCtaChrome } from "@sdxc/ui/styles";

import type { BookCopy } from "~/resources/content/books";

namespace NotFoundView {
	export interface Props {
		/** The featured book's landing. */
		landing: string;
		copy: BookCopy;
		/** The homepage. */
		home: string;
	}
}

/**
 * Renders the page's `<main>` as one split band whose title is the page's `h1`.
 *
 * @param handle Runtime handle carrying the links and the book.
 * @returns The render function producing the page's main content.
 */
export default function NotFoundView(handle: Handle<NotFoundView.Props>) {
	return () => {
		let { copy, home, landing } = handle.props;
		let Cover = copy.Cover;

		return (
			<main>
				<FeatureBand
					id="not-found"
					layout="split"
					level={1}
					spacing="hero"
					eyebrow="Error 404"
					title="This page is not in the book"
					description="The address may be mistyped, or the page may have moved. The book itself is one click away."
					media={<Cover />}
				>
					<CtaGroup>
						<LinkButton href={landing} color="brand" mix={[landingCtaChrome()]}>
							See the book
						</LinkButton>
						<Link href={home} color="neutral" mix={[weight("medium")]}>
							Back to the homepage
						</Link>
					</CtaGroup>
				</FeatureBand>
			</main>
		);
	};
}
