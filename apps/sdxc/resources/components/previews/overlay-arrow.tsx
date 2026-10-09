/**
 * Live preview island for `OverlayArrow`. The arrow attaches to the edge of the surface
 * that holds it and points back across the gap at whatever the surface is anchored to,
 * so each placement is shown beside a trigger of its own: the name is where the surface
 * sits, and the glyph is the side that faces the trigger.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { bg, border, fg, fill } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { flexWrap, hstack, relative, vstack } from "@sdxc/u/layout";
import { bs, is, p } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";
import { OverlayArrow } from "@sdxc/ui";
import { clientEntry } from "remix/component";

/**
 * Every side a surface takes, with the stacking that puts the trigger on the side the
 * arrow faces: a surface placed `top` sits above its trigger and points down at it.
 */
const PLACEMENTS = [
	{ placement: "top", axis: "block", surfaceFirst: true },
	{ placement: "bottom", axis: "block", surfaceFirst: false },
	{ placement: "left", axis: "inline", surfaceFirst: true },
	{ placement: "right", axis: "inline", surfaceFirst: false },
] as const;

/** The source the page shows, matching the markup below. */
const CODE = `{/* The surface owns the arrow, and the gap between the two is what the glyph
    reaches across, so the stacking order is what puts the trigger on the side the
    arrow faces. */}
<div mix={[vstack({ gap: 3, align: "center" })]}>
	<div mix={[relative(), p(3), rounded("lg"), bg("neutral.solid"), fg("neutral.onSolid")]}>
		<OverlayArrow placement="top" mix={[fill("neutral.solid")]}>
			<svg width={8} height={8} viewBox="0 0 8 8" aria-hidden="true">
				<path d="M0 0 L4 4 L8 0" />
			</svg>
		</OverlayArrow>
		top
	</div>

	<div mix={[is(10), bs(10), rounded("md"), border({ color: "neutral", width: 1 })]} />
</div>`;

/** Four placements, each against a trigger of its own, hydrated with the rest of the page. */
export const OverlayArrowPreview = clientEntry(import.meta.url, function OverlayArrowPreview() {
	return () => (
		<div mix={[hstack({ gap: 8, align: "center", justify: "center" }), flexWrap()]}>
			{PLACEMENTS.map((entry) => {
				/*
				 * The gap between the surface and its trigger is what the glyph reaches across,
				 * so the pair stacks along the placement's own axis and the surface leads or
				 * trails depending on which side of the trigger it sits.
				 */
				let surface = (
					<div
						key="surface"
						mix={[
							relative(),
							p(3),
							rounded("lg"),
							bg("neutral.solid"),
							fg("neutral.onSolid"),
							text("sm"),
							weight("medium"),
						]}
					>
						<OverlayArrow placement={entry.placement} mix={[fill("neutral.solid")]}>
							<svg width={8} height={8} viewBox="0 0 8 8" aria-hidden="true">
								<path d="M0 0 L4 4 L8 0" />
							</svg>
						</OverlayArrow>
						{entry.placement}
					</div>
				);

				let trigger = (
					<div
						key="trigger"
						mix={[is(10), bs(10), rounded("md"), border({ color: "neutral", width: 1 })]}
					/>
				);

				let pair = entry.surfaceFirst ? [surface, trigger] : [trigger, surface];

				return (
					<div
						key={entry.placement}
						mix={[
							entry.axis === "block"
								? vstack({ gap: 3, align: "center" })
								: hstack({ gap: 3, align: "center" }),
						]}
					>
						{pair}
					</div>
				);
			})}
		</div>
	);
});

export default { code: CODE, render: () => <OverlayArrowPreview /> };
