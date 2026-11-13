/**
 * The last band before the footer, set as a postscript: one line on what arrives next and
 * the same sign-up form the hero offers, so a reader who scrolled the whole letter can
 * subscribe where they stopped.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { LandingHeader, LandingSection } from "@sdxc/ui/landing";

import SubscribeForm from "~/resources/views/demos/newsletter/subscribe-form";

/**
 * Renders the postscript start-aligned in the column like the letter above it, with the
 * sign-up at the column's full width.
 *
 * @returns The render function producing the band.
 */
export default function NewsletterClosing() {
	return () => (
		<LandingSection id="postscript" ruled>
			<LandingHeader
				eyebrow="P.S."
				description="It is about the bins: what happens after the lorry turns the corner, and who weighs it."
			>
				The next letter goes out Thursday
			</LandingHeader>
			<div mix={[raw({ marginBlockStart: "2rem" })]}>
				<SubscribeForm label="Send me Thursday’s letter" />
			</div>
		</LandingSection>
	);
}
