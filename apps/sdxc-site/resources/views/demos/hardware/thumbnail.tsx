/**
 * Strata Two's gallery miniature: the board on the black stage under one soft light,
 * cropped off the right edge, with the orange escape key as the only colour.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";

import { finishColours } from "~/resources/views/demos/hardware/finish";
import { Keyboard } from "~/resources/views/demos/hardware/keyboard";

/**
 * Renders the stage and the board, tilted slightly so the chamfer catches the light.
 *
 * @returns The render function producing the miniature.
 */
export default function StrataThumbnail() {
	return () => (
		<div
			mix={[
				finishColours(),
				raw({
					position: "absolute",
					inset: "0",
					background:
						"radial-gradient(60% 70% at 55% 55%, oklch(0.36 0.004 250), oklch(0.13 0.004 250) 75%)",
				}),
			]}
		>
			<div
				mix={[
					raw({
						position: "absolute",
						insetBlockStart: "2.25rem",
						insetInlineStart: "1.5rem",
						inlineSize: "130%",
						filter: "drop-shadow(0 12px 14px oklch(0 0 0 / 0.6))",
					}),
				]}
			>
				<Keyboard id="thumb" />
			</div>
		</div>
	);
}
