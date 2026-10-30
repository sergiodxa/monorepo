/**
 * The pricing band: the book alone and the book with the video course, side by side, with
 * the team licence offered in the band's lead. Each package is a one-time payment, bought
 * through a form that posts to the example checkout.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Badge, Link } from "@sdxc/ui";
import { CheckRow, PricingBand } from "@sdxc/ui/patterns";

import CheckoutButton from "~/resources/views/demos/book/checkout-button";

/**
 * Renders the two packages in one row from the `md` container, the complete edition set in
 * ink and moved first on a phone, so the band fills whole rows at every width.
 *
 * @returns The render function producing the band.
 */
export default function BookPricing() {
	return () => (
		<PricingBand
			id="pricing"
			eyebrow="Pricing"
			title="Pick how you want to learn"
			columns={2}
			description={
				<>
					One payment, yours for good, with <strong>free updates</strong> for as long as the book is
					in print. Buying for a team of up to ten? The complete edition with a live Q&amp;A is
					$349,{" "}
					<Link href="/examples/book/team" color="neutral">
						with seats you can reassign
					</Link>
					.
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
		</PricingBand>
	);
}
