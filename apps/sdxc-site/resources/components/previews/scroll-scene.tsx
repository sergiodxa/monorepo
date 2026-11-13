/**
 * Live preview for `ScrollScene`: a scroll panel holding a scene whose three layers come
 * apart as the reader scrolls inside it, the panel naming its own height so the stage pins
 * in the panel rather than the page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { ScrollScene, sceneMotion } from "@sdxc/ui/landing";

/** The source the page shows, matching the markup below. */
const CODE = `<ScrollScene timeline="layers" length={2}>
	{LAYERS.map((layer, index) => (
		<div
			mix={[
				raw({ translate: \`0 \${index * 3}rem\` }),
				sceneMotion("layers", { from: { translate: "0 0" } }, "contain 10% contain 80%"),
			]}
		/>
	))}
</ScrollScene>`;

/** The layers, top first, each a colour the stack separates into. */
const LAYERS = [
	{ name: "Keycaps", fill: "var(--ui-neutral-fg-emphasis)" },
	{ name: "Plate", fill: "var(--ui-neutral-fg-muted)" },
	{ name: "Case", fill: "var(--ui-brand-bg-solid)" },
];

/** The panel's height, which the scene measures its runway and stage against. */
const PANEL = "20rem";

/** What the preview registry reads: the source to show, and the panel to draw. */
export default {
	code: CODE,
	render: () => (
		<div
			mix={[
				raw({
					inlineSize: "100%",
					maxInlineSize: "32rem",
					blockSize: PANEL,
					overflowY: "auto",
					overscrollBehavior: "contain",
					borderRadius: "0.75rem",
					boxShadow: "inset 0 0 0 1px var(--ui-neutral-border)",
					"--ui-scroll-scene-viewport": PANEL,
					"--ui-landing-header-height": "0px",
				}),
			]}
		>
			<p
				mix={[
					raw({
						margin: "0",
						padding: "1.5rem",
						textAlign: "center",
						fontSize: "0.875rem",
						color: "var(--ui-neutral-fg-muted)",
					}),
				]}
			>
				Scroll inside this panel
			</p>
			<ScrollScene timeline="preview-layers" length={2}>
				<div
					mix={[
						raw({
							position: "relative",
							blockSize: "12rem",
							marginInline: "auto",
							inlineSize: "min(100% - 3rem, 18rem)",
						}),
					]}
				>
					{LAYERS.map((layer, index) => (
						<div
							key={layer.name}
							mix={[
								raw({
									position: "absolute",
									insetInline: "0",
									insetBlockStart: "2rem",
									blockSize: "3rem",
									display: "grid",
									placeItems: "center",
									borderRadius: "0.5rem",
									backgroundColor: layer.fill,
									color: "var(--ui-bg)",
									fontSize: "0.8125rem",
									fontWeight: "600",
									zIndex: String(LAYERS.length - index),
									translate: `0 ${index * 3.5}rem`,
									boxShadow: "0 8px 16px -8px rgb(0 0 0 / 0.4)",
								}),
								sceneMotion(
									"preview-layers",
									{
										from: { translate: `0 ${index * 0.5}rem` },
										to: { translate: `0 ${index * 3.5}rem` },
									},
									"contain 10% contain 80%",
								),
							]}
						>
							{layer.name}
						</div>
					))}
				</div>
			</ScrollScene>
			<p
				mix={[
					raw({
						margin: "0",
						padding: "1.5rem",
						textAlign: "center",
						fontSize: "0.875rem",
						color: "var(--ui-neutral-fg-muted)",
					}),
				]}
			>
				Under reduced motion the layers rest apart, in normal flow.
			</p>
		</div>
	),
};
