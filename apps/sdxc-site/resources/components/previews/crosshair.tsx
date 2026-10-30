/**
 * Live preview for `Crosshair`: a ruled panel with a mark on each corner, at both sizes,
 * the registration marks a ruled landing draws where a rail meets a rule.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { flexWrap, hstack } from "@sdxc/u/layout";
import { font, text } from "@sdxc/u/typography";
import { Crosshair } from "@sdxc/ui/patterns";

/** Corners every panel marks. */
const CORNERS: Crosshair.Corner[] = ["start-start", "start-end", "end-start", "end-end"];

/** The source the page shows, matching the markup below. */
const CODE = `<div mix={[raw({ position: "relative", border: "1px solid var(--ui-marketing-hairline)" })]}>
	<Crosshair corner="start-start" />
	<Crosshair corner="start-end" />
	<Crosshair corner="end-start" />
	<Crosshair corner="end-end" />
	…
</div>

<Crosshair corner="end-end" size="sm" />`;

/** What the preview registry reads: the source to show, and the panels to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[hstack({ gap: 12, align: "center", justify: "center" }), flexWrap("wrap")]}>
			{(["md", "sm"] as const).map((size) => (
				<div
					key={size}
					mix={[
						raw({
							position: "relative",
							display: "grid",
							placeItems: "center",
							inlineSize: "14rem",
							blockSize: "8rem",
							border: "1px solid var(--ui-marketing-hairline)",
						}),
						font("mono"),
						text("xs"),
						fg("neutral.muted"),
					]}
				>
					{size === "md" ? "21px marks" : "11px marks"}
					{CORNERS.map((corner) => (
						<Crosshair key={corner} corner={corner} size={size} />
					))}
				</div>
			))}
		</div>
	),
};
