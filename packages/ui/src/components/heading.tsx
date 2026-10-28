/**
 * A section title rendered inside the native heading element matching its
 * semantic depth — `<h1>` through `<h6>` — styled at one fixed emphasis size
 * regardless of which level it renders. An explicit `level` prop fixes the
 * depth outright; otherwise, the nearest ancestor `HeadingScope` supplies
 * it, and a heading with no scope wrapping it at all renders as `<h1>`.
 * Choosing a level changes only the document outline the element contributes to
 * assistive technology; its rendered size stays fixed, so nesting sections
 * correctly never requires a visual trade-off. Pass `size="display"` or
 * `size="chapter"` for marketing headlines that read the `--ui-marketing-*`
 * display tokens (light weight, tight tracking, near-1.0 leading).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/component";

import { fg } from "@sdxc/u/color";
import { balance, fontSize, leading, tracking, weight } from "@sdxc/u/typography";

import { displayHeading } from "../styles/marketing.js";

import type { HeadingLevel } from "./heading-scope.js";

import { resolveHeadingLevel, TAG_BY_LEVEL } from "./heading-scope.js";

/** Visual size {@link Heading} applies when `size` is omitted. */
const DEFAULT_SIZE: Heading.Size = "default";

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
	 * Visual size recipe: the catalog default, a page H1 display scale, or a
	 * section chapter (~40–48px) from the marketing tokens.
	 */
	export type Size = "default" | "display" | "chapter";

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
		/**
		 * Visual size recipe. Defaults to {@link DEFAULT_SIZE}. Marketing
		 * pages reach for `"display"` (H1) or `"chapter"` (section H2); app
		 * chrome keeps `"default"`.
		 */
		size?: Size;
	}
}

/**
 * Renders its children inside the native heading element matching `level`.
 * The default size is semibold, tight-tracked emphasis at `lg`; `"display"`
 * and `"chapter"` swap in {@link displayHeading} so large marketing titles
 * stay light-weighted.
 *
 * @param handle Runtime handle carrying the host heading element's props.
 * @returns The render function producing the heading's markup.
 * @example
 * <Heading level={1}>Page title</Heading>
 * @example
 * <Heading size="display">{t("hero.title")}</Heading>
 * @example
 * <Heading size="chapter">{t("section.title")}</Heading>
 */
export function Heading(handle: Handle<Heading.Props>) {
	return () => {
		let { level, mix, size, ...rest } = handle.props;
		let resolved = resolveHeadingLevel(handle, level);
		let resolvedSize = size ?? DEFAULT_SIZE;
		let Tag = TAG_BY_LEVEL[resolved];
		let isMarketing = resolvedSize === "display" || resolvedSize === "chapter";

		return (
			<Tag
				{...rest}
				data-heading-level={resolved}
				data-size={resolvedSize}
				mix={[
					resolvedSize === "display" ? displayHeading(1) : [],
					resolvedSize === "chapter" ? displayHeading(2) : [],
					isMarketing
						? []
						: [
								weight("semibold"),
								tracking("tight"),
								fg("neutral.emphasis"),
								fontSize("lg"),
								leading("none"),
								balance(),
							],
					mix,
				]}
			/>
		);
	};
}
