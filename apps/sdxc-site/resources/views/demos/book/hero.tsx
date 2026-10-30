/**
 * The book page's opening: the promise set like a title page beside the flat cover, a buy
 * button with an underlined way into the free chapter, and the review score as a printed
 * line. The parts enter in turn on load for a reader who allows motion.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { m } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";
import { Link, LinkButton } from "@sdxc/ui";
import { LandingHero } from "@sdxc/ui/patterns";
import { marketingCtaChrome } from "@sdxc/ui/styles";

import BookCover from "~/resources/views/demos/book/cover";

/**
 * Renders the hero with the cover beside the copy from the `lg` container up and under
 * it on a phone. The secondary action is a text link, as a printed page would set it.
 *
 * @returns The render function producing the hero band.
 */
export default function BookHero() {
	return () => (
		<LandingHero
			id="top"
			tone="plain"
			mediaPlacement="end"
			entrance
			eyebrow="Second edition · 38 video lessons"
			eyebrowVariant="mono"
			title={
				<>
					Set type people <i>finish</i> reading
				</>
			}
			description={
				<>
					A field guide to web typography for designers and engineers who ship. Fourteen chapters on
					measure, rhythm, scale and fonts, each ending in{" "}
					<strong>CSS you can paste into a real product</strong>.
				</>
			}
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
			note="PDF, EPUB and Kindle. DRM-free, with every future update."
			proof={
				<p
					mix={[
						m(0),
						text("sm"),
						fg("neutral"),
						raw({
							paddingBlockStart: "1rem",
							borderBlockStart: "1px solid var(--ui-marketing-hairline)",
							fontVariantNumeric: "oldstyle-nums",
						}),
					]}
				>
					<span mix={[fg("brand")]} aria-hidden="true">
						★★★★★
					</span>{" "}
					<span mix={[weight("semibold"), fg("neutral.emphasis")]}>4.9</span> from 1,260 reviews by
					18,400 readers
				</p>
			}
			media={<BookCover />}
		/>
	);
}
