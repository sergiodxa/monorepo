/**
 * Live preview for `PhoneFan`: three ink phones on a pausable stage, the front screen
 * readable and the side screens fanned once the column is wide enough.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";

import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { vstack } from "@sdxc/u/layout";
import { is, p } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";
import { PhoneFan, PhoneFrame, screenCorners } from "@sdxc/ui/landing";

/** The source the page shows, matching the markup below. */
const CODE = `<PhoneFan
	label="Three screens of Rooftree"
	pauseLabel="Pause the phone animation"
	start={<PhoneFrame>…</PhoneFrame>}
	front={<PhoneFrame>…</PhoneFrame>}
	end={<PhoneFrame>…</PhoneFrame>}
/>`;

/**
 * A tall phone screen with a quiet title and a tinted body, clipped to the bezel.
 *
 * @param title Screen headline shown under the status strip.
 * @param tint Brand-tinted wash for the body.
 * @returns The framed phone for one fan slot.
 */
function Screen(title: string, tint: string): RemixNode {
	return (
		<PhoneFrame bezel="#161412">
			<div
				mix={[
					screenCorners(),
					vstack({ gap: 3, align: "stretch" }),
					p(4),
					raw({
						aspectRatio: "9 / 19.5",
						background: `linear-gradient(160deg, ${tint}, var(--ui-surface-raised, var(--ui-bg)))`,
						color: "var(--ui-neutral-fg-emphasis)",
					}),
				]}
			>
				<span mix={[text("xs"), weight("semibold"), fg("neutral.muted")]}>Rooftree</span>
				<span mix={[text("md"), weight("semibold")]}>{title}</span>
				<span
					mix={[
						raw({
							flex: "1",
							borderRadius: "0.75rem",
							backgroundColor: "color-mix(in oklch, CanvasText 6%, transparent)",
						}),
					]}
				/>
			</div>
		</PhoneFrame>
	);
}

/** What the preview registry reads: the source to show, and the fan to draw. */
export default {
	code: CODE,
	viewports: true,
	render: () => (
		<div mix={[is("full"), raw({ maxInlineSize: "36rem", marginInline: "auto" })]}>
			<PhoneFan
				label="Three screens of Rooftree"
				pauseLabel="Pause the phone animation"
				start={Screen("Lists", "color-mix(in oklch, var(--ui-brand-bg-solid) 18%, transparent)")}
				front={Screen("Today", "color-mix(in oklch, var(--ui-brand-bg-solid) 28%, transparent)")}
				end={Screen("Meals", "color-mix(in oklch, var(--ui-brand-bg-solid) 14%, transparent)")}
			/>
		</div>
	),
};
