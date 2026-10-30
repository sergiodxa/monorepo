/**
 * The pricing band: the book alone, the book with the video course, and a team licence.
 * Every package is a one-time payment, bought through a form that posts to the example
 * checkout.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Badge } from "@sdxc/ui";
import { CheckRow, PricingBand } from "@sdxc/ui/patterns";

import CheckoutButton from "~/resources/views/demos/book/checkout-button";

/**
 * Renders the three packages with the complete edition featured, which inverts and moves
 * first on a phone.
 *
 * @returns The render function producing the band.
 */
export default function BookPricing() {
	return () => (
		<PricingBand
			id="pricing"
			eyebrow="Pricing"
			title="Pick how you want to learn"
			description={
				<>
					One payment, yours for good. Every package includes <strong>free updates</strong> for as
					long as the book is in print.
				</>
			}
		>
			<PricingBand.Plan
				name="The book"
				price="$39"
				period="one-time"
				description="The second edition in every format, for reading on your own time."
				features={
					<>
						<CheckRow>312 pages, fourteen chapters</CheckRow>
						<CheckRow>PDF, EPUB and Kindle, DRM-free</CheckRow>
						<CheckRow>CSS starter files for every chapter</CheckRow>
						<CheckRow>Free updates for every edition</CheckRow>
					</>
				}
				action={<CheckoutButton plan="book">Buy the book</CheckoutButton>}
			/>
			<PricingBand.Plan
				name="Complete edition"
				price="$99"
				period="one-time"
				featured
				badge={<Badge color="brand">Most chosen</Badge>}
				description="The book with the video course that sets every chapter live."
				features={
					<>
						<CheckRow>Everything in the book</CheckRow>
						<CheckRow>38 video lessons, six and a half hours</CheckRow>
						<CheckRow>The type scale workbook</CheckRow>
						<CheckRow>Private reader forum with Odile</CheckRow>
						<CheckRow>Certificate of completion</CheckRow>
					</>
				}
				action={
					<CheckoutButton plan="complete" featured>
						Get the complete edition
					</CheckoutButton>
				}
			/>
			<PricingBand.Plan
				name="Team"
				price="$349"
				period="one-time"
				description="The complete edition for a design and engineering team."
				features={
					<>
						<CheckRow>Everything in the complete edition</CheckRow>
						<CheckRow>Up to ten people, seats you can reassign</CheckRow>
						<CheckRow>A live 90-minute Q&amp;A with Odile</CheckRow>
						<CheckRow>Invoice and purchase order billing</CheckRow>
					</>
				}
				action={<CheckoutButton plan="team">Buy for your team</CheckoutButton>}
			/>
		</PricingBand>
	);
}
