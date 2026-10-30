/**
 * Live preview for `LandingHero`: the band above the fold, with an eyebrow, a display
 * title, a lead, the two actions and a framed product shot beside them. It meets the
 * frame's edges like the page it opens.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { p } from "@sdxc/u/size";
import { font, text, weight } from "@sdxc/u/typography";
import { Button, HeadingScope, LinkButton } from "@sdxc/ui";
import { LandingHero, ProductFrame } from "@sdxc/ui/patterns";
import { marketingCtaChrome } from "@sdxc/ui/styles";

/** The source the page shows, matching the markup below. */
const CODE = `<LandingHero
	tone="grid"
	eyebrow="Uptime monitoring"
	title="Know it is down before your users do"
	description="Checks from six regions, alerts that agree, and a status page your customers can trust."
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
		<ProductFrame lights title="Monitors" url="app.beacon.dev">
			<div mix={[vstack({ gap: 2, align: "stretch" }), p(6), bg("neutral.tint")]}>
				<span mix={[text("sm"), weight("semibold"), fg("neutral.emphasis")]}>api.example.com</span>
				<span mix={[font("mono"), text("xs"), fg("success")]}>Operational · 142 ms p95</span>
			</div>
		</ProductFrame>
	}
/>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	viewports: true,
	render: () => (
		<HeadingScope>
			<LandingHero
				tone="grid"
				eyebrow="Uptime monitoring"
				title="Know it is down before your users do"
				description="Checks from six regions, alerts that agree, and a status page your customers can trust."
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
					<ProductFrame lights title="Monitors" url="app.beacon.dev">
						<div mix={[vstack({ gap: 2, align: "stretch" }), p(6), bg("neutral.tint")]}>
							<span mix={[text("sm"), weight("semibold"), fg("neutral.emphasis")]}>
								api.example.com
							</span>
							<span mix={[font("mono"), text("xs"), fg("success")]}>Operational · 142 ms p95</span>
						</div>
					</ProductFrame>
				}
			/>
		</HeadingScope>
	),
};
