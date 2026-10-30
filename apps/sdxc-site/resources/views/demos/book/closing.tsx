/**
 * The last band before the footer: one line that sends the reader to the pricing or the
 * free chapter, set on the paper under a rule like a book's closing page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { weight } from "@sdxc/u/typography";
import { Link, LinkButton } from "@sdxc/ui";
import { ClosingCta } from "@sdxc/ui/patterns";
import { marketingCtaChrome } from "@sdxc/ui/styles";

/**
 * Renders the closing statement on the plain paper with the buy button and an underlined
 * link to the free chapter, the same pair the hero offers.
 *
 * @returns The render function producing the band.
 */
export default function BookClosing() {
	return () => (
		<ClosingCta
			tone="plain"
			ruled
			eyebrow="The last page"
			title="Your next paragraph could read better"
			description="Start with the free chapter, or get the whole book and every lesson today."
			actions={
				<>
					<LinkButton href="#pricing" color="brand" mix={[marketingCtaChrome()]}>
						Buy the book — $39
					</LinkButton>
					<Link href="#sample" color="neutral" mix={[weight("medium")]}>
						Read chapter 2 free
					</Link>
				</>
			}
		/>
	);
}
