/**
 * Centered's gallery miniature: the bright page's headline over the dark lesson screen with
 * its chapter bar, the same contrast the landing is built on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";

import { WheelFrame } from "~/resources/views/demos/course/clay";

/** Chapter lengths on the miniature's bar, as shares of the lesson. */
const CHAPTERS = [10, 16, 13, 20, 13, 16, 12];

/**
 * Renders the miniature.
 *
 * @returns The render function producing the scene.
 */
export default function CenteredThumbnail() {
	return () => (
		<div
			mix={[
				raw({
					position: "absolute",
					inset: "0",
					display: "grid",
					justifyItems: "center",
					alignContent: "start",
					gap: "0.5rem",
					paddingBlockStart: "0.875rem",
				}),
			]}
		>
			<span
				mix={[
					raw({
						fontFamily: "var(--ui-font-display)",
						fontWeight: "750",
						fontSize: "15px",
						letterSpacing: "-0.03em",
					}),
				]}
			>
				From a lump of clay to a{" "}
				<span
					mix={[raw({ backgroundColor: "var(--ui-brand-bg-tint-hover)", paddingInline: "2px" })]}
				>
					lidded jar
				</span>
			</span>
			<span
				mix={[
					raw({
						inlineSize: "4.5rem",
						blockSize: "1rem",
						borderRadius: "0.375rem",
						backgroundColor: "var(--ui-brand-bg-solid)",
					}),
				]}
			/>
			<div
				mix={[
					raw({
						inlineSize: "82%",
						padding: "0.375rem",
						display: "grid",
						gap: "0.3125rem",
						borderRadius: "0.625rem",
						backgroundColor: "oklch(0.17 0.012 262)",
					}),
				]}
			>
				<span
					mix={[
						raw({
							display: "block",
							aspectRatio: "16 / 9",
							overflow: "clip",
							borderRadius: "0.375rem",
						}),
					]}
				>
					<WheelFrame clay="brace" id="course-thumbnail" />
				</span>
				<span mix={[raw({ display: "flex", gap: "2px", blockSize: "3px" })]}>
					{CHAPTERS.map((share, index) => (
						<span
							key={index}
							mix={[
								raw({
									flexGrow: String(share),
									borderRadius: "9999px",
									backgroundColor: index < 4 ? "oklch(0.78 0.11 262)" : "oklch(1 0 0 / 0.15)",
								}),
							]}
						/>
					))}
				</span>
			</div>
		</div>
	);
}
