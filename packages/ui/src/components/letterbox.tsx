/**
 * A frame that fills whatever box holds it and centres a fixed-ratio surface inside, with bars
 * on the two sides the ratio leaves empty. The surface is a size container, so content drawn on
 * it in `cqw`/`cqh` scales with it: a slide, a game screen or a player at any window size.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/component";

import { mergeMix } from "@sdxc/u/general";
import { css } from "remix/component";

import { mergeStyle } from "../utils/merge-style.js";

/** 16:9, the widescreen ratio a frame keeps without a `ratio` prop. */
const DEFAULT_RATIO = 16 / 9;

/**
 * Prop types for {@link Letterbox}.
 */
export namespace Letterbox {
	/**
	 * Props accepted by {@link Letterbox}.
	 */
	export interface Props extends TagProps<"div"> {
		/**
		 * Width divided by height of the surface, as a number so the frame can size the surface
		 * with it (`4 / 3`, `1`).
		 *
		 * @default 16 / 9
		 */
		ratio?: number;
	}

	/**
	 * Props accepted by {@link Letterbox.Surface}.
	 */
	export interface SurfaceProps extends TagProps<"div"> {}
}

/**
 * Fills its container and paints the bars in `--ui-letterbox-bars` (black by default). In a
 * container with no definite height the frame takes its height from its width at the ratio, so
 * the surface fills it with no bars. The ratio rides on `--ui-letterbox-ratio`.
 *
 * @param handle Runtime handle carrying the frame's props.
 * @returns The render function producing the frame's markup.
 * @example
 * <Letterbox ratio={16 / 9}>
 * 	<Letterbox.Surface mix={css({ fontSize: "4cqh" })}>Slide one</Letterbox.Surface>
 * </Letterbox>
 */
export function Letterbox(handle: Handle<Letterbox.Props>) {
	return () => {
		let { ratio, style, mix, ...rest } = handle.props;
		return (
			<div
				{...rest}
				data-slot="letterbox"
				style={mergeStyle(style, { "--ui-letterbox-ratio": String(ratio ?? DEFAULT_RATIO) })}
				mix={mergeMix(
					css({
						position: "relative",
						inlineSize: "100%",
						blockSize: "100%",
						aspectRatio: "var(--ui-letterbox-ratio)",
						containerType: "size",
						overflow: "hidden",
						background: "var(--ui-letterbox-bars, #000)",
					}),
					mix,
				)}
			/>
		);
	};
}

/**
 * The fixed-ratio area inside a {@link Letterbox}: as large as fits the frame, centred on both
 * axes, and a size container, so its children size in `cqw`/`cqh` of the surface itself. Name
 * the container through `mix` to target it from an `@container` query.
 *
 * @param handle Runtime handle carrying the surface's props.
 * @returns The render function producing the surface's markup.
 * @example
 * <Letterbox.Surface mix={css({ containerName: "slide" })}>{slide}</Letterbox.Surface>
 */
Letterbox.Surface = function LetterboxSurface(handle: Handle<Letterbox.SurfaceProps>) {
	return () => {
		let { mix, ...rest } = handle.props;
		return (
			<div
				{...rest}
				data-slot="surface"
				mix={mergeMix(
					css({
						position: "absolute",
						inset: 0,
						margin: "auto",
						inlineSize: "min(100cqw, calc(100cqh * var(--ui-letterbox-ratio)))",
						blockSize: "min(100cqh, calc(100cqw / var(--ui-letterbox-ratio)))",
						containerType: "size",
						overflow: "clip",
					}),
					mix,
				)}
			/>
		);
	};
};
