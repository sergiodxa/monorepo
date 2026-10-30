/**
 * Live preview for `MotionLoop`: an endless pulse travelling a three-step pipeline, framed
 * so the toggle in its corner stops it. The pulse only moves when the visitor allows
 * motion; otherwise the diagram holds still and the toggle hides.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { keyframes } from "@sdxc/u/animation";
import { fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { hstack } from "@sdxc/u/layout";
import { is, p } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";
import { MotionLoop } from "@sdxc/ui/patterns";
import { marketingSurface } from "@sdxc/ui/styles";
import { css } from "remix/component";

/** The source the page shows, matching the markup below. */
const CODE = `<MotionLoop pauseLabel="Pause the pipeline animation">
	<PipelineDiagram />
</MotionLoop>`;

/** The pipeline's steps, left to right. */
const STEPS = ["Probe", "Confirm", "Page"] as const;

/** What the preview registry reads: the source to show, and the loop to draw. */
export default {
	code: CODE,
	render: () => (
		<MotionLoop
			pauseLabel="Pause the pipeline animation"
			mix={[is("full"), marketingSurface(), rounded("xl"), p(8)]}
		>
			<div
				mix={[hstack({ gap: 4, align: "center", justify: "center" }), raw({ flexWrap: "wrap" })]}
			>
				{STEPS.map((step, index) => (
					<div key={step} mix={[hstack({ gap: 4, align: "center" })]}>
						<span
							mix={[
								p(2, 4),
								rounded("lg"),
								text("sm"),
								weight("medium"),
								fg("neutral.emphasis"),
								raw({ boxShadow: "inset 0 0 0 1px var(--ui-marketing-hairline)" }),
							]}
						>
							{step}
						</span>
						{index < STEPS.length - 1 ? (
							<span
								aria-hidden="true"
								mix={[
									raw({
										position: "relative",
										inlineSize: "3rem",
										blockSize: "1px",
										backgroundColor: "var(--ui-marketing-hairline)",
									}),
									keyframes("preview-pipeline-pulse", {
										from: { insetInlineStart: "0" },
										to: { insetInlineStart: "calc(100% - 6px)" },
									}),
									css({
										"&::after": {
											content: '""',
											position: "absolute",
											insetBlockStart: "-2.5px",
											insetInlineStart: "0",
											inlineSize: "6px",
											blockSize: "6px",
											borderRadius: "9999px",
											backgroundColor: "var(--ui-brand-fg)",
										},
									}),
									css({
										"@media (prefers-reduced-motion: no-preference)": {
											"&::after": {
												animation: `preview-pipeline-pulse 1.6s ${index * 0.8}s ease-in-out infinite`,
											},
										},
									}),
								]}
							/>
						) : null}
					</div>
				))}
			</div>
		</MotionLoop>
	),
};
