/**
 * The book page's opening band: the promise beside the staged cover, two ways in (buy or
 * read a chapter first) and the readers who already have it, over slowly turning rings
 * that echo the cover's measure bracket.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { StarIcon } from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { hstack, vstack } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";
import { Avatar, LinkButton } from "@sdxc/ui";
import { AccentText, LandingHero } from "@sdxc/ui/patterns";
import { marketingCtaChrome, marketingSlowSpin } from "@sdxc/ui/styles";

import BookCover from "~/resources/views/demos/book/cover";

/** Initials of the readers the proof row shows, in the order they overlap. */
const READERS = ["MK", "TS", "AO", "JB", "RL"] as const;

/**
 * Renders the hero with the cover beside the copy from the `lg` container up and under
 * it on a phone, where the buttons stack full width.
 *
 * @returns The render function producing the hero band.
 */
export default function BookHero() {
	return () => (
		<LandingHero
			id="top"
			tone="plain"
			mediaPlacement="end"
			eyebrow="Second edition, with 38 video lessons"
			eyebrowHref="#pricing"
			title={
				<>
					Set type people <AccentText variant="swash">finish</AccentText> reading
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
						Buy the book
					</LinkButton>
					<LinkButton href="#sample" variant="surface" mix={[marketingCtaChrome()]}>
						Read a free chapter
					</LinkButton>
				</>
			}
			note="PDF, EPUB and Kindle. DRM-free, with every future update."
			proof={
				<div mix={[hstack({ gap: 3, align: "center" })]}>
					<Avatar.Group>
						{READERS.map((initials) => (
							<Avatar key={initials} size="sm">
								<Avatar.Fallback>{initials}</Avatar.Fallback>
							</Avatar>
						))}
					</Avatar.Group>
					<div mix={[vstack({ gap: 0.5 })]}>
						<span
							role="img"
							aria-label="Rated 4.9 out of 5"
							mix={[hstack({ gap: 0.5 }), fg("brand")]}
						>
							{[1, 2, 3, 4, 5].map((star) => (
								<StarIcon
									key={star}
									aria-hidden="true"
									fill="currentColor"
									mix={[is("0.875rem")]}
								/>
							))}
						</span>
						<span mix={[text("sm"), fg("neutral")]}>
							<span mix={[weight("semibold"), fg("neutral.emphasis")]}>4.9</span> from 1,260 reviews
							by 18,400 readers
						</span>
					</div>
				</div>
			}
			media={<BookCover />}
			backdrop={
				<svg viewBox="0 0 600 600" mix={[is("min(100%, 34rem)"), marketingSlowSpin()]}>
					{[150, 200, 250, 295].map((radius) => (
						<circle
							key={radius}
							cx="300"
							cy="300"
							r={radius}
							fill="none"
							stroke="var(--ui-brand-border)"
							stroke-dasharray={radius === 250 ? "2 10" : undefined}
						/>
					))}
				</svg>
			}
		/>
	);
}
