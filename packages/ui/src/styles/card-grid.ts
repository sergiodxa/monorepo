/**
 * The card-grid recipe {@link Feature.Grid} and {@link Bento} share: column steps,
 * raised cells with concentric outer corners, orphan spans, cell padding the media
 * slot reads back, and the quiet or brand glyph tile.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { UtilityMixin } from "@sdxc/u";

import { bg, border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { combine, raw } from "@sdxc/u/general";
import { center, gap, grid, inlineFlex } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { bs, is } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";

/** Translucent ink line shared by the mosaic rules and the quiet icon ring. */
const HAIRLINE = "var(--ui-marketing-hairline, color-mix(in oklch, CanvasText 8%, transparent))";

/** Radius of a card corner that sits on the grid's outer edge. */
const OUTER_RADIUS = "var(--ui-marketing-card-radius-outer, 1.5rem)";

/** Radius of a card corner that faces a neighbouring card. */
const INNER_RADIUS = "0.5rem";

/** Custom property holding a card cell's block padding, read back by the media slot. */
const PADDING_BLOCK = "--ui-marketing-cell-padding-block";

/** Custom property holding a card cell's inline padding, read back by the media slot. */
const PADDING_INLINE = "--ui-marketing-cell-padding-inline";

/**
 * The three column steps every card grid walks: one track on a phone, two from
 * the `md` container (36rem), the requested count from `lg` (48rem). Ranges keep
 * each step's spans and corners from leaking into the next.
 */
const GRID_STEPS: ReadonlyArray<{ query: string; columns: (requested: number) => number }> = [
	{ query: "(width < 36rem)", columns: () => 1 },
	{ query: "(36rem <= width < 48rem)", columns: (requested) => Math.min(2, requested) },
	{ query: "(width >= 48rem)", columns: (requested) => requested },
];

/** Corner names a page lists in a cell's `data-corner`, and the radius each one sets. */
const CORNER_PROPERTIES: ReadonlyArray<readonly [corner: string, property: string]> = [
	["start-start", "borderStartStartRadius"],
	["start-end", "borderStartEndRadius"],
	["end-start", "borderEndStartRadius"],
	["end-end", "borderEndEndRadius"],
];

/**
 * Options accepted by {@link cardGrid}.
 */
export interface CardGridOptions {
	/** Columns at the `lg` container; the grid shows one track on a phone and two from `md`. */
	columns: number;
	/** Separate raised cards, or one hairline-ruled mosaic box. */
	variant: "cards" | "mosaic";
	/** Named sizing container on the grid's host that the column steps query. */
	containerName: string;
}

/**
 * Lays a grid's direct children as cards or a mosaic in one class, so the
 * cell fill, edge and per-corner radii never compete across cascade layers.
 * A lone last cell spans the rest of its row at every step. In `cards`, the
 * corners on the grid's outer edge take `--ui-marketing-card-radius-outer`;
 * once any cell carries `data-corner`, the `lg` step rounds only the corners
 * those cells list, so a page with custom spans names its own outer corners.
 *
 * @param options Column count, chrome and the container the steps query.
 * @returns One mixin for the element whose children are the cells.
 * @example
 * <div mix={[cardGrid({ columns: 3, variant: "cards", containerName: "ui-marketing-bento" })]}>{cells}</div>
 */
export function cardGrid<Node extends Element = Element>({
	columns,
	variant,
	containerName,
}: CardGridOptions): UtilityMixin<Node> {
	let isCards = variant === "cards";
	let steps = GRID_STEPS.map((step) => {
		let count = step.columns(columns);
		let widest = step === GRID_STEPS[GRID_STEPS.length - 1];
		return when<Node>(`@container ${containerName} ${step.query}`, [
			raw({ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }),
			orphanSpans<Node>(count),
			isCards ? outerCorners<Node>(count, widest) : null,
		]);
	});

	return combine<Node>([
		grid(),
		raw({ textAlign: "start" }),
		isCards
			? [
					gap(4),
					when(
						"& > *",
						raw({
							backgroundColor: "var(--ui-surface-raised, Canvas)",
							boxShadow: "var(--ui-shadow-surface, 0 0 0 1px rgb(0 0 0 / 0.06))",
							borderRadius: INNER_RADIUS,
							overflow: "hidden",
						}),
					),
				]
			: [
					gap("1px"),
					rounded("xl"),
					raw({
						overflow: "hidden",
						backgroundColor: HAIRLINE,
						boxShadow: `0 0 0 1px ${HAIRLINE}`,
					}),
					when("& > *", raw({ backgroundColor: "var(--ui-surface-raised, Canvas)" })),
				],
		steps,
	]);
}

/**
 * Spans a lone last cell across what its row leaves free, so a short last row
 * never strands an empty track.
 *
 * @param count Tracks at this step.
 * @returns One `grid-column` rule per possible short-row length.
 */
function orphanSpans<Node extends Element>(count: number): UtilityMixin<Node>[] {
	let rules: UtilityMixin<Node>[] = [];
	for (let filled = 1; filled < count; filled++) {
		rules.push(
			when(
				`& > :last-child:nth-child(${count}n + ${filled})`,
				raw({ gridColumn: filled === 1 ? "1 / -1" : `span ${count - filled + 1}` }),
			),
		);
	}
	return rules;
}

/**
 * Rounds the corners that sit on the grid's outer edge for a plain grid of
 * `count` tracks whose short last row ends in a spanning cell: the first cell's
 * start-start, the cell closing the first row, the cell opening the last row
 * and the last cell's end-end. At the widest step a `data-corner` cell hands
 * that choice to the page.
 *
 * @param count Tracks at this step.
 * @param explicit Whether `data-corner` takes over at this step.
 * @returns The corner rules for the step.
 */
function outerCorners<Node extends Element>(
	count: number,
	explicit: boolean,
): UtilityMixin<Node>[] {
	let auto = explicit ? "&:not(:has(> [data-corner])) >" : "& >";
	let rules: UtilityMixin<Node>[] = [
		when(`${auto} :first-child`, raw({ borderStartStartRadius: OUTER_RADIUS })),
		when(
			`${auto} :is(:nth-child(${count}), :last-child:nth-child(-n + ${count}))`,
			raw({ borderStartEndRadius: OUTER_RADIUS }),
		),
		when(
			`${auto} :nth-child(${count}n + 1):nth-last-child(-n + ${count})`,
			raw({ borderEndStartRadius: OUTER_RADIUS }),
		),
		when(`${auto} :last-child`, raw({ borderEndEndRadius: OUTER_RADIUS })),
	];
	if (!explicit) return rules;
	for (let [corner, property] of CORNER_PROPERTIES) {
		rules.push(when(`& > [data-corner~="${corner}"]`, raw({ [property]: OUTER_RADIUS })));
	}
	return rules;
}

/**
 * Pads a card cell through custom properties that {@link cardMedia} reads back,
 * so the media slot bleeds to the cell's edges at every padding step.
 *
 * @param block Block padding below the `lg` step.
 * @param inline Inline padding below the `lg` step.
 * @param wide Padding on both axes from the `lg` container.
 * @param containerName Named container the `lg` step queries; omitted queries the nearest one.
 * @returns One mixin for the cell.
 */
export function cardPadding<Node extends Element = Element>(
	block: string,
	inline: string,
	wide: string,
	containerName?: string,
): UtilityMixin<Node> {
	let wideVars = raw<Node>({ [PADDING_BLOCK]: wide, [PADDING_INLINE]: wide });
	return combine<Node>([
		raw({
			[PADDING_BLOCK]: block,
			[PADDING_INLINE]: inline,
			paddingBlock: `var(${PADDING_BLOCK})`,
			paddingInline: `var(${PADDING_INLINE})`,
		}),
		containerName ? at("lg", containerName, wideVars) : at("lg", wideVars),
	]);
}

/**
 * Draws a cell's top media edge to edge, fading its lower half into the cell
 * fill, and drops it below the `md` container where a phone has no room for
 * the illustration.
 *
 * @returns One mixin for the media wrapper, placed first in the cell.
 */
export function cardMedia<Node extends Element = Element>(): UtilityMixin<Node> {
	return combine<Node>([
		raw({
			display: "none",
			marginBlockStart: `calc(-1 * var(${PADDING_BLOCK}, 0px))`,
			marginInline: `calc(-1 * var(${PADDING_INLINE}, 0px))`,
			overflow: "hidden",
			maskImage: "linear-gradient(to bottom, black 50%, transparent)",
		}),
		when(
			"& > :is(img, svg, video, picture)",
			raw({ display: "block", inlineSize: "100%", blockSize: "auto" }),
		),
		at("md", raw({ display: "block" })),
	]);
}

/**
 * Centers a glyph in a square tile so claim icons share one size language.
 * `quiet` frames it with a hairline ring in the heading ink; `brand` paints
 * the tinted, bordered badge.
 *
 * @param tone Tile chrome.
 * @param side Side length on the spacing scale.
 * @returns One mixin for the tile.
 */
export function iconTile<Node extends Element = Element>(
	tone: "quiet" | "brand",
	side: number,
): UtilityMixin<Node> {
	return combine<Node>([
		inlineFlex(),
		center(),
		is(side),
		bs(side),
		rounded("lg"),
		tone === "brand"
			? [bg("brand.tint"), fg("brand"), border({ color: "brand", width: 1, style: "solid" })]
			: [fg("neutral.emphasis"), raw({ boxShadow: `inset 0 0 0 1px ${HAIRLINE}` })],
	]);
}
