/**
 * Live preview for `Split`: claims with brand checks on the wide track and a staged incident
 * card beside them. The columns stack once the split's own width is too narrow for two.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, border, fg } from "@sdxc/u/color";
import { rounded, shadow } from "@sdxc/u/effects";
import { vstack } from "@sdxc/u/layout";
import { is, m, p } from "@sdxc/u/size";
import { font, text, weight } from "@sdxc/u/typography";
import { Badge, Split } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<Split lean="copy">
	<Split.Copy checks>
		<p>Every incident writes its own timeline, so the postmortem starts half done.</p>
		<ul>
			<li>Status changes posted as they happen</li>
			<li>Responders and acknowledgements recorded</li>
			<li>One link to share with customers</li>
		</ul>
	</Split.Copy>
	<Split.Media>
		<div mix={[vstack({ gap: 3, align: "stretch" }), p(5), rounded("lg"), bg("neutral.tint")]}>
			<Badge color="warning" variant="secondary">Investigating</Badge>
			<span>Elevated API latency in eu-west</span>
			<span>14:02 UTC · 2 responders</span>
		</div>
	</Split.Media>
</Split>`;

/** What the preview registry reads: the source to show, and the split to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[is("full")]}>
			<Split lean="copy">
				<Split.Copy checks>
					<p mix={[m(0), text("base"), fg("neutral")]}>
						Every incident writes its own timeline, so the postmortem starts half done.
					</p>
					<ul>
						<li>Status changes posted as they happen</li>
						<li>Responders and acknowledgements recorded</li>
						<li>One link to share with customers</li>
					</ul>
				</Split.Copy>
				<Split.Media>
					<div
						mix={[
							vstack({ gap: 3, align: "stretch" }),
							p(5),
							rounded("lg"),
							bg("neutral.tint"),
							border({ color: "neutral", width: 1 }),
							shadow("sm"),
						]}
					>
						<Badge color="warning" variant="secondary">
							Investigating
						</Badge>
						<span mix={[text("base"), weight("semibold"), fg("neutral.emphasis")]}>
							Elevated API latency in eu-west
						</span>
						<span mix={[font("mono"), text("xs"), fg("neutral.muted")]}>
							14:02 UTC · 2 responders
						</span>
					</div>
				</Split.Media>
			</Split>
		</div>
	),
};
