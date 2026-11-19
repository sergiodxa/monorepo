/**
 * A score out of a few stars, read at a glance: a muted row of stars with a filled row laid
 * over it and clipped to the score's share, so 4.3 shows the fourth star whole and a third of
 * the fifth. Assistive tech reads one sentence instead of five pictures.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { mergeMix, raw } from "@sdxc/u/general";

/** The outline of a five-pointed star in a 24 × 24 box. */
export const STAR_PATH =
	"M12 2.5l2.94 5.96 6.56.95-4.75 4.63 1.12 6.54L12 17.5l-5.87 3.08 1.12-6.54L2.5 9.41l6.56-.95L12 2.5z";

/** Top of the scale when `max` is left out. */
const DEFAULT_MAX = 5;

/** Edge of one star, by size. */
const STAR_SIZE = { sm: "0.875rem", md: "1.125rem" } as const;

/** Prop types for {@link Rating}. */
export namespace Rating {
	/** Props accepted by {@link Rating}; the host is a `<span>`. */
	export interface Props extends Omit<TagProps<"span">, "children"> {
		/** The score, fractional, between 0 and `max`; a value outside is held to the scale. */
		value: number;
		/** How many ratings the score averages, shown after the stars as "(128)". */
		count?: number;
		/** @default 5 */
		max?: number;
		/** @default "md" */
		size?: "sm" | "md";
		/** What assistive tech reads; `{value}` and `{max}` fill in. @default "{value} out of {max} stars" */
		label?: string;
		/** Replaces the "(128)" text, such as "128 reviews" or a link to them. */
		countLabel?: RemixNode;
	}
}

/** A row of `count` stars painted in the current colour. */
function Stars(handle: Handle<{ count: number }>) {
	return () => (
		<>
			{Array.from({ length: handle.props.count }, () => (
				<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
					<path d={STAR_PATH} fill="currentColor" />
				</svg>
			))}
		</>
	);
}

/**
 * Renders the stars as one `role="img"` whose name states the score, followed by the count.
 * Stars take `--ui-rating-color` (the warning tone by default) and empty ones the border tone,
 * so a theme recolours every rating at once.
 *
 * @example <Rating value={4.3} count={128} />
 * @example <Rating value={5} size="sm" label="Rated {value} of {max}" />
 */
export function Rating(handle: Handle<Rating.Props>) {
	return () => {
		let {
			count,
			countLabel,
			label = "{value} out of {max} stars",
			max = DEFAULT_MAX,
			mix,
			size = "md",
			value,
			...rest
		} = handle.props;
		let score = Math.min(Math.max(value, 0), max);
		let share = max > 0 ? (score / max) * 100 : 0;
		let spoken = label
			.replace("{value}", String(Math.round(score * 10) / 10))
			.replace("{max}", String(max));
		let star = STAR_SIZE[size];
		let tail = countLabel ?? (count === undefined ? undefined : `(${count})`);
		return (
			<span
				{...rest}
				data-slot="rating"
				data-size={size}
				mix={mergeMix(
					[
						raw({
							display: "inline-flex",
							alignItems: "center",
							gap: "0.375rem",
							fontSize: size === "sm" ? "0.8125rem" : "0.875rem",
							lineHeight: "1",
							color: "var(--ui-neutral-fg-muted)",
							verticalAlign: "middle",
						}),
					],
					mix,
				)}
			>
				<span
					role="img"
					aria-label={spoken}
					data-slot="rating-stars"
					mix={[
						raw({
							position: "relative",
							display: "inline-flex",
							flex: "none",
							color: "var(--ui-neutral-border-strong, var(--ui-neutral-border))",
							"& svg": {
								display: "block",
								flex: "none",
								inlineSize: star,
								blockSize: star,
							},
						}),
					]}
				>
					<Stars count={max} />
					<span
						data-slot="rating-fill"
						style={{ inlineSize: `${Math.round(share * 100) / 100}%` }}
						mix={[
							raw({
								position: "absolute",
								insetBlock: "0",
								insetInlineStart: "0",
								display: "flex",
								overflow: "clip",
								whiteSpace: "nowrap",
								color: "var(--ui-rating-color, var(--ui-warning-bg-solid))",
							}),
						]}
					>
						<Stars count={max} />
					</span>
				</span>
				{tail === undefined ? null : (
					<span data-slot="rating-count" mix={[raw({ fontVariantNumeric: "tabular-nums" })]}>
						{tail}
					</span>
				)}
			</span>
		);
	};
}
