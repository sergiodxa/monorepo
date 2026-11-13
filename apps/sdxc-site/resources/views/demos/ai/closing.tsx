/**
 * The last band before the footer: one line sending the reader to try Margin on a call of
 * their own, with the same pair of actions the hero offers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { Link, LinkButton } from "@sdxc/ui";
import { ClosingCta } from "@sdxc/ui/landing";
import { landingCtaChrome } from "@sdxc/ui/styles";

import { FREE_HOURS } from "~/resources/views/demos/ai/estimate";

/**
 * Renders the closing statement on the plain paper under a rule.
 *
 * @returns The render function producing the band.
 */
export default function MarginClosing() {
	return () => (
		<ClosingCta
			tone="plain"
			ruled
			eyebrow="Your next call"
			title="Bring the notes, check every line"
			description={`Upload a recording you already have. The first ${FREE_HOURS} hours each month cost nothing.`}
			actions={
				<>
					<LinkButton href="/examples/margin/sign-up" color="brand" mix={[landingCtaChrome()]}>
						Try it on a recording
					</LinkButton>
					<Link href="#limits" color="neutral" mix={[raw({ fontWeight: "500" })]}>
						Read what it gets wrong
					</Link>
				</>
			}
		/>
	);
}
