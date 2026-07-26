/**
 * A decorative loading placeholder rendered as a single static block, sized
 * to stand in for the content it precedes. It carries no animation of its
 * own, so a page that never composes one still shows a still, inert
 * silhouette instead of empty space while data loads.
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
 * placeholder out of the accessibility tree unless a consumer explicitly
 * sets `aria-hidden={false}` (for example, to expose a loading label to
 * assistive technology instead of hiding the block outright).
 */
const DEFAULT_ARIA_HIDDEN = true;

/**
 * Props accepted by {@link Skeleton}.
 */
export namespace Skeleton {
	/**
	 * Every native `<div>` attribute, unchanged, plus the `mix` passthrough.
	 * A placeholder's box shape comes entirely from the space it renders
	 * into, tuned through a `style` override, a wrapping layout, or an
	 * additional `css()` mixin composed through `mix`.
	 */
	export interface Props extends TagProps<"div"> {}
}

/**
 * A static loading placeholder: a block that fills its container's inline
 * axis, stands one text line tall by default, and is shaped with a rounded
 * corner and filled with the neutral border color so it reads as an inert
 * silhouette rather than live content. Its own styling never animates —
 * compose the `pulse()` or `shimmer()` factory from the animation layer
 * through `mix` for a breathing or sweeping loading cue, or leave it still
 * for viewers who have `prefers-reduced-motion` set.
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
