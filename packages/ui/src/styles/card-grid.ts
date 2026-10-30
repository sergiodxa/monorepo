/**
 * The card-grid recipe {@link Feature.Grid} and {@link Bento} share: column steps,
 * raised cells with concentric outer corners, orphan spans, cell padding the media
 * slot reads back, and the quiet or brand glyph tile.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { UtilityInput, UtilityMixin } from "@sdxc/u";

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

/**
 * Radius of a card corner that faces a neighbouring card; a page that wants every corner
 * alike sets `--ui-marketing-card-radius-inner` to the outer radius.
 */
const INNER_RADIUS = "var(--ui-marketing-card-radius-inner, 0.5rem)";

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

/** Side of a claim's glyph tile on the spacing scale (2.5rem), shared by every claim icon. */
export const ICON_TILE_SIDE = 10;

/** Longest run of children the quantity rules tune; a longer one keeps each step's full count. */
const BALANCED_MAX_COUNT = 12;

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
	/** Separate raised cards, one hairline-ruled mosaic box, or an un-carded `list`. */
	variant: "cards" | "mosaic" | "list";
	/** Named sizing container on the grid's host that the column steps query. */
	containerName: string;
}

/**
 * Lays a grid's direct children as cards or a mosaic in one class, so the
 * cell fill, edge and per-corner radii never compete across cascade layers.
 * A lone last cell spans the rest of its row at every step, unless the cells set
 * their own `data-span` or the grid is a `list`. In `cards`, the
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
			variant === "list" ? null : orphanSpans<Node>(count),
			cellSpans<Node>(count),
			isCards ? outerCorners<Node>(count, widest) : null,
		]);
	});

	return combine<Node>([grid(), raw({ textAlign: "start" }), cellChrome<Node>(variant), steps]);
}

/**
 * The chrome a grid variant draws: raised cards on a 1rem gap, a mosaic box whose
 * 1px gaps rule flush cells, or a `list` of bare cells on wide gaps.
 *
 * @param variant Grid chrome.
 * @returns The rules for the grid and its cells.
 */
function cellChrome<Node extends Element>(variant: CardGridOptions["variant"]): UtilityInput<Node> {
	if (variant === "list") return raw({ columnGap: "2.5rem", rowGap: "3rem" });
	if (variant === "cards") {
		return [
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
		];
	}
	return [
		gap("1px"),
		rounded("xl"),
		raw({
			overflow: "hidden",
			backgroundColor: HAIRLINE,
			boxShadow: `0 0 0 1px ${HAIRLINE}`,
		}),
		when("& > *", raw({ backgroundColor: "var(--ui-surface-raised, Canvas)" })),
	];
}

/**
 * Widens a cell carrying `data-span` across that many tracks, capped at the step's
 * count, for a grid of mixed spans.
 *
 * @param count Tracks at this step.
 * @returns The span rules for the step.
 */
function cellSpans<Node extends Element>(count: number): UtilityMixin<Node>[] {
	if (count < 2) return [];
	return [2, 3].map((span) =>
		when(
			`& > [data-span="${span}"]`,
			raw({ gridColumn: span >= count ? "1 / -1" : `span ${span}` }),
		),
	);
}

/**
 * Spans a lone last cell across what its row leaves free, so a short last row
 * never strands an empty track. A grid whose cells set their own spans is left as the
 * page laid it out.
 *
 * @param count Tracks at this step.
 * @returns One `grid-column` rule per possible short-row length.
 */
function orphanSpans<Node extends Element>(count: number): UtilityMixin<Node>[] {
	let rules: UtilityMixin<Node>[] = [];
	for (let filled = 1; filled < count; filled++) {
		rules.push(
			when(
				`&:not(:has(> [data-span])) > :last-child:nth-child(${count}n + ${filled})`,
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
 * One container range of a {@link balancedGrid}: the query that selects it and the
 * most items one row holds there.
 */
export interface BalancedGridStep {
	/** Container size query, such as `(36rem <= width < 48rem)`. */
	query: string;
	/** The most items one row holds in this range. */
	columns: number;
}

/**
 * The column count that splits `count` items into the fewest rows of at most
 * `columns` while keeping the rows as even as possible: 6 in at most 4 is 3 + 3,
 * 5 in at most 4 is 3 + 2.
 *
 * @param count Items in the run.
 * @param columns The most items one row may hold.
 * @returns Columns between 1 and `columns`.
 */
export function balancedColumns(count: number, columns: number): number {
	if (count <= columns) return Math.max(1, count);
	return Math.ceil(count / Math.ceil(count / columns));
}

/**
 * Applies `build(count)` to an element whose direct children number exactly
 * `count`, for every count up to {@link BALANCED_MAX_COUNT}; a longer run keeps the
 * rules written outside it.
 *
 * @param build Styles for a run of that many children.
 * @returns One quantity rule per count.
 */
export function byChildCount<Node extends Element = Element>(
	build: (count: number) => UtilityInput<Node>,
): UtilityMixin<Node>[] {
	let rules: UtilityMixin<Node>[] = [];
	for (let count = 1; count <= BALANCED_MAX_COUNT; count++) {
		rules.push(when<Node>(`&:has(> :nth-child(${count}):last-child)`, build(count)));
	}
	return rules;
}

/**
 * Lays direct children in rows that are full or centred: each step picks the even
 * column count for the run ({@link balancedColumns}), and a shorter last row sits
 * in the middle at one column per item. Tracks are doubled so a centred row can
 * start half a column in; the element must leave `grid-template-columns` and the
 * children's `grid-column` to this mixin.
 *
 * @param containerName Named sizing container the steps query.
 * @param steps Container ranges, each with the most items a row holds there.
 * @param rowStart Extra styles for the first item of a centred last row, such as the edge it now exposes.
 * @returns One mixin for the element whose children are the items.
 * @example
 * <div mix={[grid(), balancedGrid("ui-logos", [{ query: "(width < 30rem)", columns: 2 }, { query: "(width >= 30rem)", columns: 4 }])]}>{marks}</div>
 */
export function balancedGrid<Node extends Element = Element>(
	containerName: string,
	steps: ReadonlyArray<BalancedGridStep>,
	rowStart?: UtilityInput<Node>,
): UtilityMixin<Node> {
	return combine<Node>(
		steps.map((step) =>
			when<Node>(`@container ${containerName} ${step.query}`, [
				centredRows<Node>(step.columns, rowStart),
				byChildCount<Node>((count) =>
					centredRows<Node>(balancedColumns(count, step.columns), rowStart),
				),
			]),
		),
	);
}

/**
 * Doubled tracks for `columns` items a row, each item spanning two, with the first
 * item of a short last row pushed in by the half-tracks the row leaves free.
 *
 * @param columns Items in a full row.
 * @param rowStart Extra styles for the first item of a centred last row.
 * @returns The rules for one column count.
 */
function centredRows<Node extends Element>(
	columns: number,
	rowStart: UtilityInput<Node> | undefined,
): UtilityMixin<Node>[] {
	let rules: UtilityMixin<Node>[] = [
		raw<Node>({ gridTemplateColumns: `repeat(${columns * 2}, minmax(0, 1fr))` }),
		when<Node>("& > *", raw({ gridColumn: "span 2" })),
	];
	for (let short = 1; short < columns; short++) {
		rules.push(
			when(`& > :nth-child(${columns}n + 1):nth-last-child(${short})`, [
				raw({ gridColumn: `${columns - short + 1} / span 2` }),
				rowStart ?? [],
			]),
		);
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
