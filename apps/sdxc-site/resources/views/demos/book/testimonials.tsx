/**
 * The readers' band: one review set in ink and six more from designers and engineers, each
 * naming what changed in their own work after the book, so the praise reads as results.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";

import { TestimonialBand } from "@sdxc/ui/patterns";

/** One review: the quote, its reader and their job. */
interface Review {
	quote: RemixNode;
	name: string;
	jobTitle: string;
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
	},
	{
		quote: (
			<>I finally understand why our docs felt tiring to read. It was the measure, every time.</>
		),
		name: "Theo Sandberg",
		jobTitle: "Technical writer, Northbeam",
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
	},
	{
		quote: (
			<>
				I am a designer who never wrote CSS. The videos made the code feel like a second sketchbook.
			</>
		),
		name: "Jules Bertrand",
		jobTitle: "Product designer, Atelier Nord",
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
	},
	{
		quote: <>Clear, opinionated and short where it should be. I keep it open next to the editor.</>,
		name: "Ingrid Haugen",
		jobTitle: "Independent developer",
	},
];

/**
 * Renders one review in ink across the band, then the rest in three columns from the `lg`
 * container, two from `md` and one on a phone. Quotes carry a name and a job and no
 * portrait, as a printed review page credits them.
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
			featured={
				<TestimonialBand.Quote
					variant="featured"
					name="Noor Haddad"
					jobTitle="Head of design, Fieldnote"
				>
					We rebuilt our reading view from chapter 2 alone. Session length on long articles went up
					by a third, and nobody on the team could say what had changed. That is what good type
					does.
				</TestimonialBand.Quote>
			}
		>
			{REVIEWS.map((review) => (
				<TestimonialBand.Quote key={review.name} name={review.name} jobTitle={review.jobTitle}>
					{review.quote}
				</TestimonialBand.Quote>
			))}
		</TestimonialBand>
	);
}
