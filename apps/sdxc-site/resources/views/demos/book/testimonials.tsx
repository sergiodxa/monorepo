/**
 * The readers' band: six reviews from designers and engineers, each naming what changed in
 * their own work after the book, so the praise reads as results rather than adjectives.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";

import { TestimonialBand } from "@sdxc/ui/patterns";

/** One review: the quote, its reader, their job and their initials. */
interface Review {
	quote: RemixNode;
	name: string;
	jobTitle: string;
	initials: string;
}

/** The reviews in the order the masonry fills its columns. */
const REVIEWS: readonly Review[] = [
	{
		quote: (
			<>
				We cut our type scale from eleven sizes to six after chapter 6. The product{" "}
				<strong>looks calmer and the CSS got shorter</strong>.
			</>
		),
		name: "Marta Kowalczyk",
		jobTitle: "Front-end lead, Parcelwise",
		initials: "MK",
	},
	{
		quote: (
			<>I finally understand why our docs felt tiring to read. It was the measure, every time.</>
		),
		name: "Theo Sandberg",
		jobTitle: "Technical writer, Northbeam",
		initials: "TS",
	},
	{
		quote: (
			<>
				The font-loading chapter alone paid for the book. Our layout shift on article pages{" "}
				<strong>went to zero</strong> the same afternoon.
			</>
		),
		name: "Adaeze Okonkwo",
		jobTitle: "Performance engineer, Lumen Health",
		initials: "AO",
	},
	{
		quote: (
			<>
				I am a designer who never wrote CSS. The videos made the code feel like a second sketchbook.
			</>
		),
		name: "Jules Bertrand",
		jobTitle: "Product designer, Atelier Nord",
		initials: "JB",
	},
	{
		quote: (
			<>
				We bought the team edition for twelve people. Review comments about spacing{" "}
				<strong>dropped by half</strong> within a quarter.
			</>
		),
		name: "Rafael Lima",
		jobTitle: "Design director, Cobalt Bank",
		initials: "RL",
	},
	{
		quote: <>Clear, opinionated and short where it should be. I keep it open next to the editor.</>,
		name: "Ingrid Haugen",
		jobTitle: "Independent developer",
		initials: "IH",
	},
];

/**
 * Renders the reviews in three masonry columns from the `lg` container, two from `md` and
 * one on a phone.
 *
 * @returns The render function producing the band.
 */
export default function BookTestimonials() {
	return () => (
		<TestimonialBand
			id="reviews"
			columns={3}
			eyebrow="Reader reviews"
			title="Readers who now notice everything"
			description={
				<>
					Rated 4.9 out of 5 by 1,260 readers. <strong>A warning</strong>: you will start spotting
					widows on restaurant menus.
				</>
			}
		>
			{REVIEWS.map((review) => (
				<TestimonialBand.Quote
					key={review.name}
					name={review.name}
					jobTitle={review.jobTitle}
					avatar={review.initials}
				>
					{review.quote}
				</TestimonialBand.Quote>
			))}
		</TestimonialBand>
	);
}
