/**
 * Live example for a split `FeatureBand` that leads with media: `mediaSide="start"` puts
 * the product shot first and leans the wide track that way, so alternating bands zigzag.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { vstack } from "@sdxc/u/layout";
import { m, p } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";
import { HeadingScope } from "@sdxc/ui";
import { FeatureBand, ProductFrame } from "@sdxc/ui/landing";

/** The source the page shows, matching the markup below. */
const CODE = `<FeatureBand
	layout="split"
	mediaSide="start"
	eyebrow="Reader"
	title="A queue that stays with you"
	description="Articles, PDFs and feeds land in one place, ready on every device."
	media={<ProductFrame lights title="Queue" url="reader.example.com">…</ProductFrame>}
>
	<ul>
		<li>Save from the browser or a share sheet</li>
		<li>Listen when you cannot look</li>
		<li>Highlights sync as you go</li>
	</ul>
</FeatureBand>`;

/** What the preview registry reads: the title, the source to show, and the band to draw. */
export default {
	title: "Split with media on the start",
	code: CODE,
	viewports: true,
	render: () => (
		<HeadingScope>
			<FeatureBand
				layout="split"
				mediaSide="start"
				eyebrow="Reader"
				title="A queue that stays with you"
				description="Articles, PDFs and feeds land in one place, ready on every device."
				media={
					<ProductFrame lights title="Queue" url="reader.example.com">
						<ul mix={[raw({ listStyle: "none" }), m(0), p(0)]}>
							{["The long article", "A PDF on flights", "Three feeds"].map((item) => (
								<li
									key={item}
									mix={[
										vstack({ gap: 0.5, align: "start" }),
										p(3.5, 5),
										raw({
											borderBlockEnd: "1px solid var(--ui-landing-hairline)",
										}),
									]}
								>
									<span mix={[text("sm"), weight("semibold"), fg("neutral.emphasis")]}>{item}</span>
									<span mix={[text("xs"), fg("neutral.muted")]}>Saved · unread</span>
								</li>
							))}
						</ul>
					</ProductFrame>
				}
			>
				<ul>
					<li>Save from the browser or a share sheet</li>
					<li>Listen when you cannot look</li>
					<li>Highlights sync as you go</li>
				</ul>
			</FeatureBand>
		</HeadingScope>
	),
};
