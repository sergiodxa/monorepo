/**
 * The membership band: the free letter and episodes beside the paid membership, which adds
 * the monthly field recording and a private ad-free feed. The writing stays free, and the
 * band says that first so nobody pays to unlock what they came for.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Link, LinkButton } from "@sdxc/ui";
import { CheckRow, PricingBand } from "@sdxc/ui/landing";
import { landingCtaChrome } from "@sdxc/ui/styles";

import { renderNearView } from "~/resources/views/demos/near-view";

/**
 * Renders the two ways in, the free one first, set as equals so neither shouts. Each action is a
 * plain link, so joining works without script.
 *
 * @returns The render function producing the band.
 */
export default function NewsletterMembership() {
	return () => (
		<PricingBand
			id="membership"
			mix={[renderNearView(900, 1150)]}
			eyebrow="Membership"
			title="Free to read, kept going by members"
			columns={2}
			description={
				<>
					Every letter and every episode is free, and stays free. About{" "}
					<strong>one reader in twelve</strong> pays for a membership, and that pays for the
					recording trips.{" "}
					<Link href="/examples/newsletter/gift" color="neutral">
						Give a year to someone
					</Link>
					.
				</>
			}
		>
			<PricingBand.Plan
				name="Reader"
				price="Free"
				description="The letter every other Thursday and the episode every other Sunday."
				features={
					<>
						<CheckRow>Every letter, with the full archive</CheckRow>
						<CheckRow>Every episode, chapters and transcript</CheckRow>
						<CheckRow>Reply to any letter and Tove reads it</CheckRow>
					</>
				}
				action={
					<LinkButton href="#subscribe" color="neutral" mix={[landingCtaChrome()]}>
						Subscribe free
					</LinkButton>
				}
			/>
			<PricingBand.Plan
				name="Member"
				price="$6"
				period="a month, or $60 a year"
				description="Everything free, plus the recordings we make on site."
				features={
					<>
						<CheckRow>A field recording each month, 40 minutes</CheckRow>
						<CheckRow>A private feed without sponsor reads</CheckRow>
						<CheckRow>Your questions answered first in the mailbag</CheckRow>
						<CheckRow>Cancel from any letter’s footer</CheckRow>
					</>
				}
				action={
					<LinkButton
						href="/examples/newsletter/membership"
						color="brand"
						mix={[landingCtaChrome()]}
					>
						Become a member
					</LinkButton>
				}
			/>
		</PricingBand>
	);
}
