/**
 * Live preview for `PhoneFrame`: an ink bezel around a tall home screen, with
 * `screenCorners` clipping the capture so the hardware rim hugs the picture.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { hstack, vstack } from "@sdxc/u/layout";
import { is, p } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";
import { PhoneFrame, screenCorners } from "@sdxc/ui/landing";

/** The source the page shows, matching the markup below. */
const CODE = `<PhoneFrame bezel="#161412">
	<div mix={[screenCorners(), /* home screen */]}>
		…
	</div>
</PhoneFrame>`;

/** Quiet checklist rows the framed home screen lists. */
const ROWS = [
	{ label: "Groceries", detail: "Maya · due today" },
	{ label: "Bins out", detail: "Jonah · tonight" },
	{ label: "School pickup", detail: "Ari · 15:30" },
] as const;

/** What the preview registry reads: the source to show, and the phone to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[is("full"), raw({ maxInlineSize: "14rem", marginInline: "auto" })]}>
			<PhoneFrame bezel="#161412">
				<div
					mix={[
						screenCorners(),
						vstack({ gap: 3, align: "stretch" }),
						p(4),
						raw({
							aspectRatio: "9 / 19.5",
							backgroundColor: "var(--ui-surface-raised, var(--ui-bg))",
							color: "var(--ui-neutral-fg-emphasis)",
						}),
					]}
				>
					<span mix={[text("xs"), weight("semibold"), fg("neutral.muted")]}>Today</span>
					<span mix={[text("lg"), weight("semibold")]}>Three things left</span>
					<ul mix={[vstack({ gap: 2, align: "stretch" }), raw({ listStyle: "none", margin: "0" })]}>
						{ROWS.map((row) => (
							<li
								key={row.label}
								mix={[
									hstack({ gap: 3, align: "center", justify: "between" }),
									p(3),
									rounded("lg"),
									raw({
										backgroundColor: "color-mix(in oklch, CanvasText 4%, transparent)",
									}),
								]}
							>
								<span mix={[vstack({ gap: 0.5, align: "start" })]}>
									<span mix={[text("sm"), weight("medium")]}>{row.label}</span>
									<span mix={[text("xs"), fg("neutral.muted")]}>{row.detail}</span>
								</span>
							</li>
						))}
					</ul>
				</div>
			</PhoneFrame>
		</div>
	),
};
