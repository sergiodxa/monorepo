/**
 * A decorative loading placeholder rendered as a single static block,
 * sized to stand in for the content it precedes and showing a still,
 * inert silhouette while data loads.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { bg } from "@pkg/u/color";
import { rounded } from "@pkg/u/effects";
import { bs, is } from "@pkg/u/size";
import { attrs } from "remix/ui";

/**
 * Default `aria-hidden` value applied through {@link attrs}, keeping a
 * placeholder out of the accessibility tree unless a consumer sets
 * `aria-hidden={false}` to expose a loading label to assistive tech.
 */
const DEFAULT_ARIA_HIDDEN = "true";

/**
 * Props accepted by {@link Skeleton}.
 */
export namespace Skeleton {
	/**
	 * Every native `<div>` attribute, unchanged, plus the `mix` passthrough.
	 * A placeholder's box shape comes from the space it renders into, tuned
	 * through `style`, a wrapping layout, or a `css()` mixin via `mix`.
	 */
	export interface Props extends TagProps<"div"> {}
}

/**
 * A static loading placeholder: a rounded block filled with the neutral
 * border color, sized to its container and one text line tall by default.
 * Compose `pulse()` or `shimmer()` through `mix` for a motion cue.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the placeholder's markup.
 * @example
 * <Skeleton mix={[pulse()]} />
 * @example
 * <Skeleton style={{ blockSize: "2.5rem", inlineSize: "2.5rem", borderRadius: "9999px" }} />
 * @example
 * <Skeleton aria-hidden={false} aria-label={t("status.loadingProfile")} />
 */
export function Skeleton(handle: Handle<Skeleton.Props>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				mix={[
					attrs({ "aria-hidden": DEFAULT_ARIA_HIDDEN }),
					bs("var(--ui-skeleton-block-size, 1rem)"),
					is("full"),
					rounded("md"),
					bg("neutral.border"),
					mix,
				]}
			/>
		);
	};
}
