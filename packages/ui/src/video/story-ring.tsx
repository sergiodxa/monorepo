/**
 * A picture in a ring that says whether there is a story to watch: a bright ring for one not
 * yet seen, a thin quiet one once it has been, and a gap between ring and picture so it reads
 * at any size. A row of them is a story tray, and a profile's highlights.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { mergeMix, raw } from "@sdxc/u/general";
import { when } from "@sdxc/u/state";

/** Prop types for {@link StoryRing}. */
export namespace StoryRing {
	/** Every native `<span>` attribute, plus the picture and its state. */
	export interface Props extends Omit<TagProps<"span">, "children"> {
		/** The picture inside the ring: an avatar, a drawn cover. */
		children: RemixNode;
		/** Whether every story behind it has been seen, which quiets the ring. Default: `false`. */
		seen?: boolean;
		/** The ring's outer size in rem. Default: `4`. */
		size?: number;
	}
}

/** The outer size, in rem, when a page names none. */
const DEFAULT_SIZE = 4;

/**
 * Renders the ring around its picture. The unseen ring paints `--ui-story-ring`, the brand's
 * solid colour unless a page names a gradient; the seen ring paints the quiet border colour.
 *
 * @example <StoryRing seen={person.seen}><Avatar src={person.photo} alt="" /></StoryRing>
 */
export function StoryRing(handle: Handle<StoryRing.Props>) {
	return () => {
		let { children, mix, seen = false, size = DEFAULT_SIZE, ...rest } = handle.props;
		return (
			<span
				{...rest}
				data-slot="story-ring"
				data-seen={seen ? "" : undefined}
				mix={mergeMix(
					[
						raw({
							"--ui-story-ring-size": `${size}rem`,
							position: "relative",
							display: "inline-grid",
							placeItems: "center",
							flexShrink: "0",
							inlineSize: "var(--ui-story-ring-size)",
							blockSize: "var(--ui-story-ring-size)",
							padding: "calc(var(--ui-story-ring-size) * 0.05 + 1px)",
							borderRadius: "var(--ui-story-ring-radius, 999px)",
							background: "var(--ui-story-ring, var(--ui-brand-bg-solid))",
							"& > *": {
								inlineSize: "100%",
								blockSize: "100%",
								borderRadius: "inherit",
								overflow: "hidden",
								boxShadow:
									"0 0 0 calc(var(--ui-story-ring-size) * 0.035 + 1px) var(--ui-bg, Canvas)",
							},
						}),
						when(
							"&[data-seen]",
							raw({
								padding: "calc(var(--ui-story-ring-size) * 0.05)",
								background: "var(--ui-neutral-border-strong)",
							}),
						),
					],
					mix,
				)}
			>
				{children}
			</span>
		);
	};
}
