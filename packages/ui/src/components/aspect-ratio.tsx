/**
 * A layout primitive that locks its host to a fixed width-to-height ratio,
 * clipping whatever content it wraps so the box keeps its shape regardless
 * of the content's own intrinsic size. It reserves stable space for media,
 * embeds, and other loading content ahead of time, so nothing around it
 * shifts once that content resolves its own measurements.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { var as varUtility, raw } from "@pkg/u/general";
import { block } from "@pkg/u/layout";
import { overflow } from "@pkg/u/overflow";
import { is } from "@pkg/u/size";

import { mergeStyle } from "../utils/merge-style";

/**
 * Ratio {@link AspectRatio} falls back to when `ratio` is omitted: a
 * perfect square.
 */
const DEFAULT_RATIO: AspectRatio.Ratio = "1 / 1";

/**
 * Prop types for {@link AspectRatio}.
 */
export namespace AspectRatio {
	/**
	 * A CSS `aspect-ratio` value: either a bare number expressing
	 * width divided by height (`1.7778` for a 16:9 box), or a ratio string
	 * in the same form CSS accepts directly (`"16 / 9"`).
	 */
	export type Ratio = number | string;

	/**
	 * Props accepted by {@link AspectRatio}.
	 */
	export interface Props extends TagProps<"div"> {
		/** Width-to-height ratio the host maintains. Defaults to {@link DEFAULT_RATIO}. */
		ratio?: Ratio;
	}
}

/**
 * Renders a block that maintains a fixed width-to-height ratio no matter
 * what it contains, filling its container's inline axis and clipping any
 * overflow along the way. The ratio is carried on the `--ui-aspect-ratio`
 * custom property, set per instance from the `ratio` prop, so it can also be
 * overridden from an ancestor's stylesheet without touching this component.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the ratio-locked box's markup.
 * @example
 * <AspectRatio ratio="16 / 9">
 * 	<img src={coverImageUrl} alt={coverImageAlt} />
 * </AspectRatio>
 * @example
 * <AspectRatio ratio={4 / 3} />
 */
export function AspectRatio(handle: Handle<AspectRatio.Props>) {
	return () => {
		let { ratio, mix, style, ...rest } = handle.props;
		let resolvedRatio = ratio ?? DEFAULT_RATIO;
		let resolvedStyle = mergeStyle(style, { "--ui-aspect-ratio": resolvedRatio });

		return (
			<div
				{...rest}
				style={resolvedStyle}
				mix={[
					block(),
					is("full"),
					overflow(),
					raw({ aspectRatio: varUtility("ui-aspect-ratio", "1") }),
					mix,
				]}
			/>
		);
	};
}
