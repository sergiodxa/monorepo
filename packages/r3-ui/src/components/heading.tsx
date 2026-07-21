/**
 * A section title rendered inside the native heading element matching its
 * semantic depth — `<h1>` through `<h6>` — styled at one fixed emphasis size
 * regardless of which level it renders. An explicit `level` prop fixes the
 * depth outright; otherwise, the nearest ancestor `HeadingScope` supplies
 * it, and a heading with no scope wrapping it at all renders as `<h1>`.
 * Choosing a level changes the document outline the element contributes to
 * assistive technology, not the rendered size, so nesting sections
 * correctly never requires a visual trade-off.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { css } from "remix/ui";

import type { HeadingLevel } from "./heading-scope";

import { resolveHeadingLevel, TAG_BY_LEVEL } from "./heading-scope";

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
 * styled as a single fixed emphasis size — a semibold, tight-tracked line
 * set at the emphasized neutral foreground color, with its line height
 * collapsed so multi-line wrapping stays compact.
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
					css({
						fontSize: "1.125rem",
						lineHeight: "1",
						fontWeight: 600,
						letterSpacing: "-0.025em",
						color: "var(--ui-neutral-fg-emphasis)",
					}),
					mix,
				]}
			/>
		);
	};
}
