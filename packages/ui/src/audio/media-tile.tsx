/**
 * An album, a playlist or an artist in a music library as one tile: square artwork (round for
 * a person), its name and a line under it, and a play button that rises over the art under the
 * pointer. The link and the button stay separate controls, so each has its own name.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { mergeMix, raw } from "@sdxc/u/general";
import { motionSafe } from "@sdxc/u/responsive";

/** Prop types for {@link MediaTile}. */
export namespace MediaTile {
	/** `square` for an album or a playlist, `round` for an artist. */
	export type Shape = "square" | "round";

	/** Every native `<div>` attribute but `title`, plus the tile's content. */
	export interface Props extends Omit<TagProps<"div">, "title" | "children"> {
		href: string;
		/** The name, the link's accessible name and the tile's first line. */
		title: string;
		/** The artwork, drawn edge to edge: an `<img>` or an `<svg>`. */
		art: RemixNode;
		/** The line under the name, such as "Album · Lumen Harbor" or "Artist". */
		subtitle?: RemixNode;
		/** @default "square" */
		shape?: Shape;
		/**
		 * A play control over the art's corner, outside the link: a button, or a form holding
		 * one. It shows under the pointer and on focus; touch screens reach it through the page.
		 */
		play?: RemixNode;
	}
}

/**
 * Renders the tile, filling its column. The art lifts slightly under the pointer and holds
 * still under reduced motion; the play control appears where a pointer can reach it.
 *
 * @example <MediaTile href="/album/tidelight" title="Tidelight" subtitle="2025 · Album" art={<img src={cover} alt="" />} />
 */
export function MediaTile(handle: Handle<MediaTile.Props>) {
	return () => {
		let { art, href, mix, play, shape = "square", subtitle, title, ...rest } = handle.props;
		let radius =
			shape === "round" ? "50%" : "var(--ui-media-tile-radius, var(--ui-radius-md, 0.375rem))";
		return (
			<div
				{...rest}
				data-slot="media-tile"
				data-shape={shape}
				mix={mergeMix(
					[
						raw({
							position: "relative",
							containerType: "inline-size",
							minInlineSize: "0",
							"&:hover [data-slot=media-tile-play], &:focus-within [data-slot=media-tile-play]": {
								opacity: "1",
								translate: "0 0",
							},
							"@media (hover: none)": {
								"& [data-slot=media-tile-play]": { display: "none" },
							},
						}),
					],
					mix,
				)}
			>
				<a
					href={href}
					data-slot="media-tile-link"
					mix={[
						raw({
							display: "grid",
							gap: "0.5rem",
							padding: "0",
							color: "inherit",
							textDecoration: "none",
							borderRadius: radius,
							outline: "none",
							WebkitTapHighlightColor: "transparent",
							"&:focus-visible [data-slot=media-tile-art]": {
								outline: "2px solid var(--ui-brand-ring)",
								outlineOffset: "3px",
							},
						}),
						motionSafe(
							raw({ "&:hover [data-slot=media-tile-art] > :first-child": { scale: "1.03" } }),
						),
					]}
				>
					<span
						data-slot="media-tile-art"
						mix={[
							raw({
								position: "relative",
								display: "block",
								aspectRatio: "1",
								overflow: "clip",
								borderRadius: radius,
								backgroundColor: "var(--ui-neutral-bg-tint)",
								boxShadow:
									"0 0 0 1px var(--ui-image-outline, rgb(0 0 0 / 0.08)), 0 8px 24px -12px rgb(0 0 0 / 0.35)",
								"& > :first-child": {
									display: "block",
									inlineSize: "100%",
									blockSize: "100%",
									objectFit: "cover",
									transition: "scale 320ms cubic-bezier(0.2, 0.7, 0.2, 1)",
								},
							}),
						]}
					>
						{art}
					</span>
					<span
						mix={[
							raw({
								display: "grid",
								gap: "0.125rem",
								minInlineSize: "0",
								textAlign: shape === "round" ? "center" : "start",
							}),
						]}
					>
						<span
							data-slot="media-tile-title"
							mix={[
								raw({
									overflow: "hidden",
									textOverflow: "ellipsis",
									whiteSpace: "nowrap",
									fontSize: "0.9375rem",
									lineHeight: "1.375rem",
									fontWeight: "600",
									color: "var(--ui-neutral-fg-emphasis)",
								}),
							]}
						>
							{title}
						</span>
						{subtitle === undefined ? null : (
							<span
								data-slot="media-tile-subtitle"
								mix={[
									raw({
										overflow: "hidden",
										textOverflow: "ellipsis",
										whiteSpace: "nowrap",
										fontSize: "0.8125rem",
										lineHeight: "1.125rem",
										color: "var(--ui-neutral-fg-muted)",
									}),
								]}
							>
								{subtitle}
							</span>
						)}
					</span>
				</a>
				{play === undefined ? null : (
					<span
						data-slot="media-tile-play"
						mix={[
							raw({
								position: "absolute",
								insetInlineEnd: shape === "round" ? "8cqi" : "0.5rem",
								insetBlockStart: shape === "round" ? "calc(92cqi - 3rem)" : "calc(100cqi - 3.5rem)",
								opacity: "0",
								translate: "0 0.5rem",
								transition: "opacity 160ms ease, translate 200ms cubic-bezier(0.2, 0.7, 0.2, 1)",
								"&:has(:focus-visible)": { opacity: "1", translate: "0 0" },
							}),
						]}
					>
						{play}
					</span>
				)}
			</div>
		);
	};
}
