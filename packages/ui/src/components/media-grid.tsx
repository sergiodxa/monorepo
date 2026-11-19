/**
 * A grid of photos and videos as links, three square tiles to a row with a hairline gap, the
 * way a profile or an explore page lays out a person's pictures: a tile can stand two rows
 * tall, carry a badge in its corner and show an overlay (likes, a count) on hover or focus.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { mergeMix, raw } from "@sdxc/u/general";
import { motionReduce } from "@sdxc/u/responsive";
import { when } from "@sdxc/u/state";

/** Prop types for {@link MediaGrid} and {@link MediaGrid.Item}. */
export namespace MediaGrid {
	/** Every native `<ul>` attribute, plus the grid's name and tiles. */
	export interface Props extends Omit<TagProps<"ul">, "children"> {
		/** The list's accessible name, such as "Posts". */
		label: string;
		/** How many tiles to a row. Default: `3`. */
		columns?: number;
		/** {@link MediaGrid.Item} elements in order. */
		children: RemixNode;
	}

	/** Every native `<li>` attribute but `children`, plus the tile's link and content. */
	export interface ItemProps extends Omit<TagProps<"li">, "children"> {
		/** Where the tile leads: the post or the video. */
		href: string;
		/** The link's accessible name, such as "Post by Mara: bowls cooling on a plank". */
		label: string;
		/** The picture, drawn edge to edge and cropped to the tile: an `<img>`, an `<svg>`, a `<video>`. */
		children: RemixNode;
		/** Stands two rows tall, for a video among photos. */
		tall?: boolean;
		/** An icon in the top corner, such as a stack for several photos or a film for a video. */
		badge?: RemixNode;
		/** What shows over the picture on hover or focus, such as its likes and comments. */
		overlay?: RemixNode;
	}
}

/** Tiles to a row when a page names no other count. */
const DEFAULT_COLUMNS = 3;

/**
 * Renders the grid. Tiles flow densely, so a tall tile never leaves a hole; the gap reads
 * `--ui-media-grid-gap`, a hairline unless a page widens it.
 *
 * @example
 * <MediaGrid label="Posts">
 * 	{posts.map((post) => (
 * 		<MediaGrid.Item href={post.href} label={post.alt} badge={post.many ? <LayersIcon /> : null}>
 * 			<img src={post.thumb} alt="" />
 * 		</MediaGrid.Item>
 * 	))}
 * </MediaGrid>
 */
export function MediaGrid(handle: Handle<MediaGrid.Props>) {
	return () => {
		let { children, columns = DEFAULT_COLUMNS, label, mix, ...rest } = handle.props;
		return (
			<ul
				{...rest}
				aria-label={label}
				data-slot="media-grid"
				mix={mergeMix(
					[
						raw({
							display: "grid",
							gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
							gridAutoFlow: "dense",
							gap: "var(--ui-media-grid-gap, 2px)",
							margin: "0",
							padding: "0",
							listStyle: "none",
						}),
					],
					mix,
				)}
			>
				{children}
			</ul>
		);
	};
}

/**
 * One tile: a link holding the picture, square or two rows tall, with its badge and an
 * overlay that fades in over a scrim while the tile is hovered or focused.
 */
MediaGrid.Item = function MediaGridItem(handle: Handle<MediaGrid.ItemProps>) {
	return () => {
		let { badge, children, href, label, mix, overlay, tall = false, ...rest } = handle.props;
		return (
			<li
				{...rest}
				data-slot="media-grid-item"
				data-tall={tall ? "" : undefined}
				mix={mergeMix(
					[
						raw({ minInlineSize: "0" }),
						when("&[data-tall]", raw({ gridRow: "span 2", "--ui-media-grid-ratio": "auto" })),
					],
					mix,
				)}
			>
				<a
					href={href}
					aria-label={label}
					mix={[
						raw({
							position: "relative",
							display: "block",
							blockSize: "100%",
							aspectRatio: "var(--ui-media-grid-ratio, 1)",
							overflow: "hidden",
							color: "oklch(0.99 0 0)",
							backgroundColor: "var(--ui-neutral-bg-tint)",
							"& > [data-media-grid-picture] > *": {
								display: "block",
								inlineSize: "100%",
								blockSize: "100%",
								objectFit: "cover",
							},
						}),
						when(
							"&:hover [data-media-grid-overlay], &:focus-visible [data-media-grid-overlay]",
							raw({ opacity: "1" }),
						),
						when(
							"&:focus-visible",
							raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "-2px" }),
						),
					]}
				>
					<span
						data-media-grid-picture=""
						mix={[raw({ position: "absolute", inset: "0", display: "block" })]}
					>
						{children}
					</span>
					{badge === undefined || badge === null ? null : (
						<span
							aria-hidden="true"
							data-media-grid-badge=""
							mix={[
								raw({
									position: "absolute",
									insetBlockStart: "0.5rem",
									insetInlineEnd: "0.5rem",
									display: "inline-flex",
									filter: "drop-shadow(0 1px 2px rgb(0 0 0 / 0.5))",
									"& > svg": { inlineSize: "1.125rem", blockSize: "1.125rem" },
								}),
							]}
						>
							{badge}
						</span>
					)}
					{overlay === undefined || overlay === null ? null : (
						<span
							aria-hidden="true"
							data-media-grid-overlay=""
							mix={[
								raw({
									position: "absolute",
									inset: "0",
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									gap: "1.25rem",
									backgroundColor: "rgb(0 0 0 / 0.35)",
									fontWeight: "700",
									opacity: "0",
									transition: "opacity 120ms ease",
								}),
								motionReduce(raw({ transition: "none" })),
							]}
						>
							{overlay}
						</span>
					)}
				</a>
			</li>
		);
	};
};
