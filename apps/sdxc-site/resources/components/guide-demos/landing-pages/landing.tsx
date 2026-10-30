/**
 * The whole page the landing-page guide stacks: the hero, then the proof, feature and
 * questions bands from their own demos, and the closing band. One outer scope keeps its
 * hero below the guide's own title, and a staged screen stands in for the hero's screenshot.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { p } from "@sdxc/u/size";
import { font, text, weight } from "@sdxc/u/typography";
import { Button, HeadingScope, LinkButton } from "@sdxc/ui";
import { ClosingCta, LandingHero, ProductFrame } from "@sdxc/ui/patterns";
import { marketingCtaChrome } from "@sdxc/ui/styles";

import faq from "~/resources/components/guide-demos/landing-pages/faq";
import features from "~/resources/components/guide-demos/landing-pages/features";
import proof from "~/resources/components/guide-demos/landing-pages/proof";

/** What the guide demo registry reads: the page, drawn at a desktop or a phone width. */
export default {
	viewports: true,
	render: () => (
		<HeadingScope>
			<LandingHero
				tone="grid"
				eyebrow="Uptime monitoring"
				title="Know it is down before your users do"
				description="Checks from six regions, alerts that agree, and a status page your customers trust."
				actions={
					<>
						<Button size="lg" color="brand" mix={[marketingCtaChrome()]}>
							Start free
						</Button>
						<LinkButton href="/examples/pricing" size="lg" color="neutral" variant="outline">
							See pricing
						</LinkButton>
					</>
				}
				media={
					<ProductFrame lights title="Monitors" url="app.example.com">
						<div mix={[vstack({ gap: 2, align: "stretch" }), p(6), bg("neutral.tint")]}>
							<span mix={[text("sm"), weight("semibold"), fg("neutral.emphasis")]}>
								api.example.com
							</span>
							<span mix={[font("mono"), text("xs"), fg("success")]}>
								Operational · 6 of 6 regions passing
							</span>
						</div>
					</ProductFrame>
				}
			/>

			{proof.render()}
			{features.render()}
			{faq.render()}
			<HeadingScope>
				<ClosingCta
					title="Start watching your endpoints today"
					description="Five monitors free, forever."
					actions={
						<Button size="lg" color="brand" mix={[marketingCtaChrome()]}>
							Create an account
						</Button>
					}
				/>
			</HeadingScope>
		</HeadingScope>
	),
};
