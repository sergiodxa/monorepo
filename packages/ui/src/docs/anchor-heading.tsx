/**
 * A docs section heading a reader can link to: it carries an `id`, a `#` link that shows
 * on hover and focus, room above it for a sticky header, and a short highlight when a jump
 * lands on it. Its typography comes from the surrounding prose, such as `Typeset`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { animationHost, keyframes } from "@sdxc/u/animation";
import { fg, outline } from "@sdxc/u/color";
import { rounded, transition } from "@sdxc/u/effects";
import { mergeMix, raw } from "@sdxc/u/general";
import { motionSafe } from "@sdxc/u/responsive";
import { mis } from "@sdxc/u/size";
import { hover, when } from "@sdxc/u/state";
import { textDecoration, weight } from "@sdxc/u/typography";

import type { HeadingLevel } from "../components/heading-scope.js";

import { readAmbientLevel, TAG_BY_LEVEL } from "../components/heading-scope.js";

/**
 * Custom property setting the space a jump leaves above the heading; set it on any
 * ancestor to the sticky header's height plus breathing room.
 */
export const ANCHOR_HEADING_SCROLL_MARGIN = "--ui-docs-scroll-margin";

/** Level with no `level` prop and no `HeadingScope` around the heading: a page section. */
const DEFAULT_LEVEL: HeadingLevel = 2;

/** `@keyframes` name of the highlight a heading shows when it is the URL's target. */
const FLASH = "ui-anchor-heading-flash";

/**
 * Prop types for {@link AnchorHeading}.
 */
export namespace AnchorHeading {
	/** Props accepted by {@link AnchorHeading}. */
	export interface Props extends Omit<TagProps<"h2">, "id"> {
		/** Fragment the heading answers to, and the `#` link's target. */
		id: string;
		/** Defaults to the ambient `HeadingScope` level, else {@link DEFAULT_LEVEL}. */
		level?: HeadingLevel;
		/** Accessible name of the `#` link, such as "Link to Install". */
		linkLabel: string;
		children: RemixNode;
	}
}

/**
 * Renders the heading with its `#` link after the text. The link stays in the tab order
 * at all times, shows on hover of the heading or on its own focus, and shows always on
 * devices without hover. Jumps clear `--ui-docs-scroll-margin` (default `5rem`).
 *
 * @param handle Runtime handle carrying the heading's props.
 * @returns The render function producing the heading's markup.
 * @example
 * <AnchorHeading id="install" linkLabel="Link to Install">Install</AnchorHeading>
 */
export function AnchorHeading(handle: Handle<AnchorHeading.Props>) {
	return () => {
		let { id, level, linkLabel, children, mix, ...rest } = handle.props;
		let Tag = TAG_BY_LEVEL[level ?? readAmbientLevel(handle) ?? DEFAULT_LEVEL];

		return (
			<Tag
				{...rest}
				id={id}
				data-slot="anchor-heading"
				mix={mergeMix(
					[
						raw({ scrollMarginBlockStart: `var(${ANCHOR_HEADING_SCROLL_MARGIN}, 5rem)` }),
						rounded("sm"),
						keyframes(FLASH, {
							from: { backgroundColor: "var(--ui-brand-bg-tint)" },
							to: { backgroundColor: "transparent" },
						}),
						motionSafe(
							when("&:target", animationHost(FLASH, { duration: "1.2s", easing: "ease-out" })),
						),
					],
					mix,
				)}
			>
				{children}
				<a
					href={`#${id}`}
					aria-label={linkLabel}
					data-slot="anchor-heading-link"
					mix={[
						mis("0.35em"),
						weight("normal"),
						fg("neutral.muted"),
						textDecoration("none"),
						rounded("sm"),
						hover(fg("brand")),
						when("&:focus-visible", outline({ color: "brand.ring", offset: 2 })),
						/**
						 * Hidden and shown in one rule, so the shown states always outrank the
						 * hidden one whatever order the stylesheet layers land in.
						 */
						raw({
							opacity: 0,
							"&:focus-visible, &:where([data-slot='anchor-heading']:hover > *)": { opacity: 1 },
							"@media (hover: none)": { opacity: 1 },
						}),
						motionSafe(transition("opacity, color", { duration: 150 })),
					]}
				>
					<span aria-hidden="true">#</span>
				</a>
			</Tag>
		);
	};
}
