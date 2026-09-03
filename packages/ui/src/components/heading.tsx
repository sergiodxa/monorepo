/**
 * A section title rendered inside the native heading element matching its
 * semantic depth — `<h1>` through `<h6>` — styled at one fixed emphasis size
 * regardless of which level it renders. An explicit `level` prop fixes the
 * depth outright; otherwise, the nearest ancestor `HeadingScope` supplies
 * it, and a heading with no scope wrapping it at all renders as `<h1>`.
 * Choosing a level changes only the document outline the element contributes to
 * assistive technology; its rendered size stays fixed, so nesting sections
 * correctly never requires a visual trade-off.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { fg } from "@sdxc/u/color";
import { fontSize, leading, tracking, weight } from "@sdxc/u/typography";

import type { HeadingLevel } from "./heading-scope.js";

import { resolveHeadingLevel, TAG_BY_LEVEL } from "./heading-scope.js";

/**
 * Prop types for {@link Heading}.
 */
export namespace Heading {
	/**
	 * Semantic depth, from `1` (`<h1>`) through `6` (`<h6>`), mapped to the
	 * matching native heading element.
	 */
	export type Level = HeadingLevel;

	/**
	 * Every native heading-element attribute, unchanged, plus the `mix`
	 * passthrough and a `level` prop choosing which native element the
	 * heading renders as.
	 */
	export interface Props extends TagProps<"h1"> {
		/**
		 * Semantic depth. Defaults to the nearest ancestor `HeadingScope`'s
		 * depth, or `1` where no scope wraps this heading at all.
		 */
		level?: Level;
	}
}

/**
 * Renders its children inside the native heading element matching `level`,
 * styled at one fixed emphasis size — semibold, tight-tracked, and colored for
 * emphasis, with line height collapsed for compact wrapping.
 *
 * @param handle Runtime handle carrying the host heading element's props.
 * @returns The render function producing the heading's markup.
 * @example
 * <Heading level={1}>Page title</Heading>
 * @example
 * <Heading>Section title</Heading>
 */
export function Heading(handle: Handle<Heading.Props>) {
	return () => {
		let { level, mix, ...rest } = handle.props;
		let resolved = resolveHeadingLevel(handle, level);
		let Tag = TAG_BY_LEVEL[resolved];

		return (
			<Tag
				{...rest}
				data-heading-level={resolved}
				mix={[
					weight("semibold"),
					tracking("tight"),
					fg("neutral.emphasis"),
					fontSize("lg"),
					leading("none"),
					mix,
				]}
			/>
		);
	};
}
