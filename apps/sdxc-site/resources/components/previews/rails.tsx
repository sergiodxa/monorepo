/**
 * Live preview for `Rails`: a plain band, then two ruled columns stacked under it with
 * corner marks, so the rails read as one continuous grid and the copy lines up with the
 * band above. On a phone the rails and marks step aside for the full width.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { container } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { text, weight } from "@sdxc/u/typography";
import { HeadingScope, MarketingHeader, MarketingSection } from "@sdxc/ui";
import { Rails } from "@sdxc/ui/patterns";

/** What the feature row inside the rails lists. */
const FEATURES = [
	{ title: "Six regions", body: "Every URL is probed from six continents every thirty seconds." },
	{ title: "Two to agree", body: "A failure pages someone only when a second region confirms it." },
	{
		title: "One page",
		body: "Incidents post to your status page from the monitor that caught them.",
	},
] as const;

/** The source the page shows, matching the markup below. */
const CODE = `<MarketingSection>
	<MarketingHeader eyebrow="Platform">Built like infrastructure</MarketingHeader>
</MarketingSection>
<Rails ruled marks="corners">
	<FeatureRow />
</Rails>
<Rails ruled marks="corners" spacing="compact">
	<p>Trusted by 1,200 on-call teams.</p>
</Rails>`;

/** What the preview registry reads: the source to show, and the bands to draw. */
export default {
	code: CODE,
	viewports: true,
	render: () => (
		<HeadingScope>
			<MarketingSection>
				<MarketingHeader
					eyebrow="Platform"
					description="Rails frame the column, marks pin its corners."
				>
					Built like infrastructure
				</MarketingHeader>
			</MarketingSection>
			<Rails ruled marks="corners">
				<div mix={[container("preview-rails-row")]}>
					<ul
						mix={[
							raw({
								display: "grid",
								gap: "2rem",
								margin: "0",
								padding: "0",
								listStyle: "none",
							}),
							at(
								"md",
								"preview-rails-row",
								raw({ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }),
							),
						]}
					>
						{FEATURES.map((feature) => (
							<li key={feature.title}>
								<span mix={[raw({ display: "block" }), weight("medium"), fg("neutral.emphasis")]}>
									{feature.title}
								</span>
								<span
									mix={[
										raw({ display: "block", marginBlockStart: "0.25rem" }),
										text("sm"),
										fg("neutral"),
									]}
								>
									{feature.body}
								</span>
							</li>
						))}
					</ul>
				</div>
			</Rails>
			<Rails ruled marks="corners" spacing="compact">
				<p mix={[raw({ margin: "0" }), text("sm"), fg("neutral")]}>
					Trusted by 1,200 on-call teams.
				</p>
			</Rails>
		</HeadingScope>
	),
};
