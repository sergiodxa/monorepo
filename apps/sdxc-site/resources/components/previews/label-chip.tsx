/**
 * Live preview for `LabelChip`: labels in the colours people pick for them, from a pale yellow
 * to a near-black, each with text that stays readable in either theme, plus the dot variant a
 * dense issue row uses.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { flexWrap, hstack, vstack } from "@sdxc/u/layout";
import { LabelChip } from "@sdxc/ui/label-chip";

/** The source the page shows, matching the markup below. */
const CODE = `<LabelChip color="#d73a4a">bug</LabelChip>
<LabelChip color="#a2eeef">enhancement</LabelChip>
<LabelChip color="#fbca04">needs triage</LabelChip>
<LabelChip color="#0e8a16">good first issue</LabelChip>
<LabelChip color="#5319e7">design</LabelChip>
<LabelChip color="#1d1d1f">wontfix</LabelChip>
<LabelChip hue={245}>docs</LabelChip>

<LabelChip variant="dot" color="oklch(0.63 0.19 25)">Bug</LabelChip>
<LabelChip variant="dot" color="oklch(0.62 0.13 150)">Feature</LabelChip>
<LabelChip variant="dot" color="oklch(0.74 0.14 75)">Performance</LabelChip>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[vstack({ gap: 4, align: "start" })]}>
			<div mix={[hstack({ gap: 2, align: "center" }), flexWrap()]}>
				<LabelChip color="#d73a4a">bug</LabelChip>
				<LabelChip color="#a2eeef">enhancement</LabelChip>
				<LabelChip color="#fbca04">needs triage</LabelChip>
				<LabelChip color="#0e8a16">good first issue</LabelChip>
				<LabelChip color="#5319e7">design</LabelChip>
				<LabelChip color="#1d1d1f">wontfix</LabelChip>
				<LabelChip hue={245}>docs</LabelChip>
			</div>
			<div mix={[hstack({ gap: 2, align: "center" }), flexWrap()]}>
				<LabelChip variant="dot" color="oklch(0.63 0.19 25)">
					Bug
				</LabelChip>
				<LabelChip variant="dot" color="oklch(0.62 0.13 150)">
					Feature
				</LabelChip>
				<LabelChip variant="dot" color="oklch(0.74 0.14 75)">
					Performance
				</LabelChip>
			</div>
		</div>
	),
};
