/**
 * Sprite tool view — the canonical editor pattern the later tool phases follow.
 * The component constructs a plain editor class once in setup, then hands the
 * class its canvas element via a `ref` mixin when the canvas mounts. This is how
 * a DOM-driven editor class is wired into the CSR `remix/ui` component tree.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { css, ref } from "remix/ui";

import { SpriteEditor } from "../editors/sprite-editor";

/**
 * Placeholder sprite-drawing tool. Builds a {@link SpriteEditor} in setup and
 * attaches it to the canvas on mount (and detaches on removal) through the `ref`
 * mixin, proving the class-in-a-component pattern end to end.
 *
 * @param _handle Component handle (no props for this placeholder).
 * @returns The render function for the sprite tool canvas.
 */
export function SpriteDrawingTool(_handle: Handle<Record<string, never>>) {
	let editor = new SpriteEditor();

	return () => (
		<section mix={css({ display: "grid", gap: "0.75rem", justifyItems: "start" })}>
			<p mix={css({ margin: 0, color: "#9ca3af", fontSize: "0.85rem" })}>
				Placeholder sprite surface. The editor class owns this canvas.
			</p>
			<canvas
				mix={[
					css({
						imageRendering: "pixelated",
						border: "1px solid #3f3f46",
						borderRadius: "0.375rem",
						width: "256px",
						height: "256px",
					}),
					ref<HTMLCanvasElement>((element, signal) => {
						editor.attach(element);
						signal.addEventListener("abort", () => editor.detach());
					}),
				]}
			/>
		</section>
	);
}
