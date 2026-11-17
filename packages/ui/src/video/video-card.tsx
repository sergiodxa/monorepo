/**
 * A title in a video catalogue as one link: its artwork in a landscape still or a portrait
 * poster, a badge on the art, how much of it the viewer has watched, and its name and meta
 * below. The card owns the hover lift and focus ring, so every row and grid reads alike.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { visuallyHidden } from "@sdxc/u/a11y";
import { mergeMix, raw } from "@sdxc/u/general";
import { motionSafe } from "@sdxc/u/responsive";
import { when } from "@sdxc/u/state";

/** Prop types for {@link VideoCard}. */
export namespace VideoCard {
	/** `landscape` is a 16:9 still, `poster` a 2:3 key art. */
	export type Shape = "landscape" | "poster";

	/** Every native `<a>` attribute but `children`, `title` and `role`, plus the card's own content. */
	export interface Props extends Omit<TagProps<"a">, "children" | "title" | "href" | "role"> {
		/** The link's destination: the title's page, or straight into playback. */
		href: string;
		/** The title's name, the card's accessible name and its first line. */
		title: string;
		/** The artwork, drawn edge to edge in the frame: an `<img>`, an `<svg>` or a gradient. */
		art: RemixNode;
		/** Default: `"landscape"`. */
		shape?: Shape;
		/** A short second line, such as "S2 · E4 · 38 min" or "2026 · Drama". */
		meta?: RemixNode;
		/** A label on the art, such as "New episodes". */
		badge?: RemixNode;
		/** Which corner of the art the badge sits in. Default: `"top"` (the start of the top edge). */
		badgePlacement?: "top" | "bottom";
		/** The share watched, from 0 to 1, drawn as a bar along the art's foot. */
		progress?: number;
		/** What a screen reader hears for the bar, such as "38% watched"; required with `progress`. */
		progressLabel?: string;
	}
}

/** The art frame's proportions per shape. */
const RATIOS: Record<VideoCard.Shape, string> = { landscape: "16 / 9", poster: "2 / 3" };

/** The bar's fill, the brand's own unless a page names another. */
const PROGRESS_COLOR = "var(--ui-video-card-progress-color, var(--ui-brand-bg-solid))";

/**
 * Clamps a watched share into 0–1, so a bar never overflows its track or runs backwards.
 *
 * @param value The share a page passed.
 * @returns The share the bar draws.
 */
export function clampProgress(value: number): number {
	if (!Number.isFinite(value)) return 0;
	return Math.min(1, Math.max(0, value));
}

/**
 * Renders the card. The whole card is one link whose name is the title, so a row of them
 * reads as a list of titles; the art scales a little under the pointer and stays still under
 * reduced motion.
 *
 * @example
 * <VideoCard href="/title/tidewater" title="Tidewater" art={<img src={still} alt="" />} meta="S1 · E3" progress={0.4} progressLabel="40% watched" />
 * @example
 * <VideoCard shape="poster" href="/title/ember" title="Ember Line" art={<Poster />} badge="New" />
 */
export function VideoCard(handle: Handle<VideoCard.Props>) {
	return () => {
		let {
			art,
			badge,
			badgePlacement = "top",
			href,
			meta,
			mix,
			progress,
			progressLabel,
			shape = "landscape",
			title,
			...rest
		} = handle.props;
		let watched = progress === undefined ? null : clampProgress(progress);

		return (
			<a
				{...rest}
				href={href}
				data-slot="video-card"
				data-shape={shape}
				mix={mergeMix(
					[
						raw({
							position: "relative",
							display: "grid",
							alignContent: "start",
							gap: "0.5rem",
							minInlineSize: "0",
							color: "inherit",
							textDecoration: "none",
							borderRadius: "var(--ui-video-card-radius, var(--ui-radius-lg, 0.5rem))",
							outline: "none",
							WebkitTapHighlightColor: "transparent",
						}),
						when(
							"&:focus-visible [data-slot=video-card-art]",
							raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "3px" }),
						),
						when(
							"&:hover [data-slot=video-card-art]",
							raw({
								boxShadow: "0 0 0 1px var(--ui-video-card-ring-hover, rgb(255 255 255 / 0.28))",
							}),
						),
						motionSafe(
							when("&:hover [data-slot=video-card-art] > :first-child", raw({ scale: "1.04" })),
						),
					],
					mix,
				)}
			>
				<span
					data-slot="video-card-art"
					mix={[
						raw({
							position: "relative",
							display: "block",
							aspectRatio: RATIOS[shape],
							overflow: "clip",
							borderRadius: "var(--ui-video-card-radius, var(--ui-radius-lg, 0.5rem))",
							backgroundColor: "var(--ui-neutral-bg-tint-pressed)",
							boxShadow: "0 0 0 1px var(--ui-image-outline, rgb(0 0 0 / 0.08))",
							transition: "box-shadow 160ms ease",
							"& > :first-child": {
								position: "absolute",
								inset: "0",
								inlineSize: "100%",
								blockSize: "100%",
								objectFit: "cover",
								transition: "scale 320ms cubic-bezier(0.2, 0.7, 0.2, 1)",
							},
						}),
					]}
				>
					{art}
					{badge === undefined ? null : (
						<CardBadge placement={badgePlacement} raised={watched !== null}>
							{badge}
						</CardBadge>
					)}
					{watched === null ? null : <CardProgress value={watched} />}
				</span>
				<span mix={[raw({ display: "grid", gap: "0.125rem", minInlineSize: "0" })]}>
					<span
						data-slot="video-card-title"
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
					{meta === undefined ? null : (
						<span
							data-slot="video-card-meta"
							mix={[
								raw({
									overflow: "hidden",
									textOverflow: "ellipsis",
									whiteSpace: "nowrap",
									fontSize: "0.8125rem",
									lineHeight: "1.125rem",
									color: "var(--ui-neutral-fg-muted)",
									fontVariantNumeric: "tabular-nums",
								}),
							]}
						>
							{meta}
						</span>
					)}
					{watched === null || progressLabel === undefined ? null : (
						<span mix={[visuallyHidden()]}>{progressLabel}</span>
					)}
				</span>
			</a>
		);
	};
}

/** How far above the art's foot a badge sits: clear of the watched bar, or not at the foot. */
function badgeFoot(placement: "top" | "bottom", raised: boolean): string {
	if (placement === "top") return "auto";
	return raised ? "0.75rem" : "0.5rem";
}

/**
 * The label on one corner of the art, on a dark glass so it reads over any artwork; at the foot
 * it sits clear of the watched bar.
 */
function CardBadge(
	handle: Handle<{ placement: "top" | "bottom"; raised: boolean; children: RemixNode }>,
) {
	return () => (
		<span
			data-slot="video-card-badge"
			data-placement={handle.props.placement}
			mix={[
				raw({
					position: "absolute",
					insetBlockStart: handle.props.placement === "top" ? "0.5rem" : "auto",
					insetBlockEnd: badgeFoot(handle.props.placement, handle.props.raised),
					insetInlineStart: "0.5rem",
					paddingInline: "0.4375rem",
					paddingBlock: "0.125rem",
					borderRadius: "var(--ui-radius-sm, 0.25rem)",
					fontSize: "0.6875rem",
					lineHeight: "1rem",
					fontWeight: "700",
					letterSpacing: "0.04em",
					textTransform: "uppercase",
					color: "oklch(0.98 0 0)",
					backgroundColor: "var(--ui-video-card-badge-bg, rgb(10 10 14 / 0.72))",
					"@media (prefers-reduced-transparency: no-preference)": {
						backdropFilter: "blur(6px)",
					},
				}),
			]}
		>
			{handle.props.children}
		</span>
	);
}

/** The watched bar along the art's foot: a pale track and the fill, both decorative. */
function CardProgress(handle: Handle<{ value: number }>) {
	return () => (
		<span
			data-slot="video-card-progress"
			aria-hidden="true"
			mix={[
				raw({
					position: "absolute",
					insetInline: "0",
					insetBlockEnd: "0",
					blockSize: "0.25rem",
					backgroundColor: "rgb(255 255 255 / 0.28)",
				}),
			]}
		>
			<span
				mix={[
					raw({
						display: "block",
						blockSize: "100%",
						backgroundColor: PROGRESS_COLOR,
					}),
				]}
				style={{ inlineSize: `${(handle.props.value * 100).toFixed(1)}%` }}
			/>
		</span>
	);
}
