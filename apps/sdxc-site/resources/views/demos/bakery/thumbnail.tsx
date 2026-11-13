/**
 * Hollyhock's gallery miniature: the striped, scalloped awning over a gingham cloth with a
 * loaf and a croissant on it, so the card shows the homely, hand-drawn register the landing
 * is set in.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { dark } from "@sdxc/u/responsive";

import { BUTTER, Drawing, gingham, INK, scallopHem } from "~/resources/views/demos/bakery/art";

/**
 * Renders the awning across the top and the two bakes on the cloth beneath it.
 *
 * @returns The render function producing the scene.
 */
export default function HollyhockThumbnail() {
	return () => (
		<div
			mix={[
				gingham("var(--ui-color-brand-500)", "0.875rem"),
				raw({
					position: "absolute",
					inset: "0",
					backgroundColor: "var(--ui-color-brand-50)",
				}),
				dark(raw({ backgroundColor: "var(--ui-color-brand-950)" })),
			]}
		>
			<div
				mix={[
					scallopHem("0.75rem"),
					raw({
						blockSize: "3.5rem",
						backgroundImage: `repeating-linear-gradient(90deg, var(--ui-color-brand-500) 0 1.5rem, ${BUTTER} 1.5rem 3rem)`,
						borderBlockStart: `0.5rem solid ${INK}`,
					}),
				]}
			/>
			<div
				mix={[
					raw({
						position: "absolute",
						insetInline: "0",
						insetBlockEnd: "0.75rem",
						display: "flex",
						justifyContent: "center",
						alignItems: "end",
						gap: "0.5rem",
					}),
				]}
			>
				<Drawing bake="loaf" size="7rem" />
				<Drawing bake="croissant" size="6rem" />
			</div>
		</div>
	);
}
