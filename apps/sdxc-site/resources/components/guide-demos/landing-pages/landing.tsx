/**
 * The whole page the landing-page guide stacks: the hero, then the proof, feature and
 * questions bands from their own demos, and the closing band. One outer scope keeps its
 * hero below the guide's own title, and a staged status board stands in for the hero's screenshot.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Button, LinkButton } from "@sdxc/ui";
import { ClosingCta, LandingHero, ProductFrame } from "@sdxc/ui/patterns";
import { marketingCtaChrome } from "@sdxc/ui/styles";

import { StatusBoard } from "~/resources/components/demo-media";
import faq from "~/resources/components/guide-demos/landing-pages/faq";
import features from "~/resources/components/guide-demos/landing-pages/features";
import proof from "~/resources/components/guide-demos/landing-pages/proof";

/** What the guide demo registry reads: the page, drawn at a desktop or a phone width. */
export default {
	viewports: true,
	render: () => (
		<>
			<LandingHero
				align="center"
				eyebrow="Status pages are here"
				eyebrowHref="/examples/changelog"
				title="Know it is down before your users do"
				description={
					<>
						Checks from six regions, alerts that only fire when <strong>two regions agree</strong>,
						and a status page your customers trust.
					</>
				}
				actions={
					<>
						<Button color="brand" mix={[marketingCtaChrome()]}>
							Start free
						</Button>
						<LinkButton href="/examples/pricing" variant="surface" mix={[marketingCtaChrome()]}>
							See pricing
						</LinkButton>
					</>
				}
				note="Five monitors free, no card required."
				media={
					<ProductFrame stage="panel" lights title="Status" url="status.example.com">
						<StatusBoard />
					</ProductFrame>
				}
			/>

			{proof.render()}
			{features.render()}
			{faq.render()}
			<ClosingCta
				inset
				title="Start watching your endpoints today"
				description="Five monitors and a status page, free for as long as you need them."
				actions={
					<>
						<Button color="brand" mix={[marketingCtaChrome()]}>
							Create an account
						</Button>
						<LinkButton href="/examples/pricing" variant="surface" mix={[marketingCtaChrome()]}>
							Talk to us
						</LinkButton>
					</>
				}
			/>
		</>
	),
};
