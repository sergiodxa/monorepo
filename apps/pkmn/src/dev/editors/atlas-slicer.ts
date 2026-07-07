/**
 * Pure atlas-slicing model for the importer dev tool. Given an image's dimensions
 * and a set of grid parameters it computes the named regions map
 * (`{ name: {x,y,w,h} }`) an atlas is sliced into, and offers helpers to build,
 * add, remove, and rename MANUAL named regions for a hand-authored sprite atlas.
 * Kept entirely DOM-, canvas-, and disk-free so the geometry can be unit-tested
 * in isolation; the importer view (`views/importer.tsx`) is the imperative shell
 * that draws these rects over a preview canvas, and the export
 * (`importer-export.ts`) shapes them into a manifest atlas entry.
 *
 * Two slicing strategies live here. {@link sliceGrid} walks a tileset/sheet as a
 * regular grid of `tileWidth`×`tileHeight` cells, honouring an outer `margin` and
 * an inter-tile `spacing`, and only emits a cell when it fits WHOLLY inside the
 * image (a partial tile at a ragged edge is excluded rather than clipped). Region
 * names follow one of two conventions selected by {@link GridNaming}: a flat
 * row-major index (`tile.0`, `tile.1`, …) or a row/column grid coordinate
 * (`r0c0`, `r0c1`, …). The manual helpers ({@link addRegion},
 * {@link removeRegion}, {@link renameRegion}) maintain an ordered list of named
 * rects the author places by hand, each returned as a fresh list so the caller
 * owns re-render timing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Rect } from "~/presentation/render/atlas";

/** How {@link sliceGrid} names each emitted cell. */
export type GridNaming =
	/** Flat row-major index: `tile.0`, `tile.1`, … left-to-right, top-to-bottom. */
	| "index"
	/** Grid coordinate: `r{row}c{col}`, e.g. `r0c0`, `r0c1`, `r1c0`. */
	| "grid";

/** Prefix used for the flat row-major {@link GridNaming} naming scheme. */
export const TILE_NAME_PREFIX = "tile";

/** Grid parameters describing how to slice a sheet into a regular tile grid. */
export interface GridParams {
	/** Width of one tile in source pixels (must be a positive integer). */
	tileWidth: number;
	/** Height of one tile in source pixels (must be a positive integer). */
	tileHeight: number;
	/** Transparent border skipped on every side before the first tile (default 0). */
	margin?: number;
	/** Gap between adjacent tiles, both horizontally and vertically (default 0). */
	spacing?: number;
	/** How each emitted cell is named (default `"index"`). */
	naming?: GridNaming;
}

/** The tile-count breakdown of a grid slice: whole columns and rows that fit. */
export interface GridDimensions {
	/** Number of whole tile columns that fit across the image. */
	columns: number;
	/** Number of whole tile rows that fit down the image. */
	rows: number;
}

/** One manually-authored named region: a name paired with its source rect. */
export interface NamedRegion {
	/** Region name (the manifest key), e.g. `hero.down`. */
	name: string;
	/** The region's source rect in pixels. */
	rect: Rect;
}

/**
 * Whether `value` is a positive integer — the shape every grid dimension must
 * take so the slice math never divides by zero or produces fractional cells.
 *
 * @param value The candidate number.
 * @returns `true` when `value` is an integer ≥ 1.
 */
function isPositiveInt(value: number): boolean {
	return Number.isInteger(value) && value >= 1;
}

/**
 * Whether `value` is a non-negative integer — the shape `margin`, `spacing`, and
 * a rect's `x`/`y` must take.
 *
 * @param value The candidate number.
 * @returns `true` when `value` is an integer ≥ 0.
 */
function isNonNegativeInt(value: number): boolean {
	return Number.isInteger(value) && value >= 0;
}

/**
 * Computes how many whole tile columns and rows fit inside an image for a grid
 * slice, honouring the outer margin and inter-tile spacing. A partial tile that
 * would spill past the image edge is NOT counted, so the result only ever
 * describes cells that fit wholly.
 *
 * The usable span on an axis is `size - 2*margin`; each tile after the first also
 * consumes `spacing`, so the count is `floor((usable + spacing) / (tile + spacing))`
 * clamped at zero. Invalid dimensions (non-positive tile size, negative
 * margin/spacing, or a non-integer image size) yield zero columns and rows rather
 * than throwing, so the view can preview a half-typed form safely.
 *
 * @param imageWidth Source image width in pixels.
 * @param imageHeight Source image height in pixels.
 * @param params The grid parameters (tile size, margin, spacing).
 * @returns The whole-tile column and row counts that fit.
 */
export function gridDimensions(
	imageWidth: number,
	imageHeight: number,
	params: GridParams,
): GridDimensions {
	let margin = params.margin ?? 0;
	let spacing = params.spacing ?? 0;

	if (!isPositiveInt(imageWidth) || !isPositiveInt(imageHeight)) return { columns: 0, rows: 0 };
	if (!isPositiveInt(params.tileWidth) || !isPositiveInt(params.tileHeight)) {
		return { columns: 0, rows: 0 };
	}
	if (!isNonNegativeInt(margin) || !isNonNegativeInt(spacing)) return { columns: 0, rows: 0 };

	let columns = axisCount(imageWidth, params.tileWidth, margin, spacing);
	let rows = axisCount(imageHeight, params.tileHeight, margin, spacing);
	return { columns, rows };
}

/**
 * The number of whole tiles that fit along one axis for a given tile size,
 * margin, and spacing. Clamped at zero so an over-large margin/tile never yields
 * a negative count.
 *
 * @param size The image extent on this axis in pixels.
 * @param tile The tile extent on this axis in pixels.
 * @param margin The outer border skipped on both ends of the axis.
 * @param spacing The gap between adjacent tiles on this axis.
 * @returns The whole-tile count (≥ 0).
 */
function axisCount(size: number, tile: number, margin: number, spacing: number): number {
	let usable = size - 2 * margin;
	if (usable < tile) return 0;
	// Every tile after the first also costs `spacing`; adding one `spacing` to the
	// numerator lets the last tile omit its trailing gap.
	return Math.floor((usable + spacing) / (tile + spacing));
}

/**
 * Builds the region name for a grid cell under the chosen naming scheme.
 *
 * @param naming The naming convention.
 * @param index The flat row-major index of the cell.
 * @param row The cell's zero-based row.
 * @param column The cell's zero-based column.
 * @returns The region name (a manifest key).
 */
function gridRegionName(naming: GridNaming, index: number, row: number, column: number): string {
	if (naming === "grid") return `r${row}c${column}`;
	return `${TILE_NAME_PREFIX}.${index}`;
}

/**
 * Slices an image into a regular grid of tiles and returns the named-region map
 * an atlas is built from. Only cells that fit WHOLLY inside the image are emitted
 * (a ragged partial tile at the right/bottom edge is excluded), so every rect is
 * a full `tileWidth`×`tileHeight`. Names follow {@link GridParams.naming}. Pure:
 * no canvas, disk, or mutation — the caller renders the result.
 *
 * @param imageWidth Source image width in pixels.
 * @param imageHeight Source image height in pixels.
 * @param params The grid parameters (tile size, margin, spacing, naming).
 * @returns Region name → source rect, in row-major order of insertion.
 */
export function sliceGrid(
	imageWidth: number,
	imageHeight: number,
	params: GridParams,
): Record<string, Rect> {
	let { columns, rows } = gridDimensions(imageWidth, imageHeight, params);
	if (columns === 0 || rows === 0) return {};

	let margin = params.margin ?? 0;
	let spacing = params.spacing ?? 0;
	let naming = params.naming ?? "index";

	let regions: Record<string, Rect> = {};
	let index = 0;
	for (let row = 0; row < rows; row++) {
		for (let column = 0; column < columns; column++) {
			let x = margin + column * (params.tileWidth + spacing);
			let y = margin + row * (params.tileHeight + spacing);
			regions[gridRegionName(naming, index, row, column)] = {
				x,
				y,
				w: params.tileWidth,
				h: params.tileHeight,
			};
			index++;
		}
	}
	return regions;
}

/**
 * Converts an ordered {@link NamedRegion} list into the flat name → rect map the
 * manifest atlas stores. A later entry with a duplicate name overwrites the
 * earlier one, matching object-key semantics; callers keep names unique via
 * {@link addRegion}/{@link renameRegion}.
 *
 * @param regions The ordered named-region list.
 * @returns Region name → source rect.
 */
export function regionsToMap(regions: readonly NamedRegion[]): Record<string, Rect> {
	let map: Record<string, Rect> = {};
	for (let region of regions) map[region.name] = { ...region.rect };
	return map;
}

/**
 * Returns a new region list with `region` appended, rejecting a name that
 * collides with an existing entry (so the manifest never silently drops a region
 * to a duplicate key). Pure: the input list is never mutated.
 *
 * @param regions The current ordered region list.
 * @param region The region to append.
 * @returns A new list ending with `region`.
 * @throws When `region.name` already exists in the list.
 */
export function addRegion(regions: readonly NamedRegion[], region: NamedRegion): NamedRegion[] {
	if (regions.some((entry) => entry.name === region.name)) {
		throw new Error(`A region named ${JSON.stringify(region.name)} already exists.`);
	}
	return [...regions, { name: region.name, rect: { ...region.rect } }];
}

/**
 * Returns a new region list with the entry named `name` removed. A no-op (a copy
 * of the input) when no entry matches, so removing an already-gone region is
 * harmless. Pure: the input list is never mutated.
 *
 * @param regions The current ordered region list.
 * @param name The name of the region to remove.
 * @returns A new list without the named region.
 */
export function removeRegion(regions: readonly NamedRegion[], name: string): NamedRegion[] {
	return regions.filter((entry) => entry.name !== name).map((entry) => ({ ...entry }));
}

/**
 * Returns a new region list with the entry named `from` renamed to `to`,
 * preserving its position and rect. Rejects renaming to a name already used by a
 * DIFFERENT entry so names stay unique; renaming an entry to its own current name
 * is accepted as a no-op. Pure: the input list is never mutated.
 *
 * @param regions The current ordered region list.
 * @param from The current name of the region to rename.
 * @param to The new name.
 * @returns A new list with the region renamed.
 * @throws When `from` is absent, or `to` collides with a different entry.
 */
export function renameRegion(
	regions: readonly NamedRegion[],
	from: string,
	to: string,
): NamedRegion[] {
	if (!regions.some((entry) => entry.name === from)) {
		throw new Error(`No region named ${JSON.stringify(from)} to rename.`);
	}
	if (from !== to && regions.some((entry) => entry.name === to)) {
		throw new Error(`A region named ${JSON.stringify(to)} already exists.`);
	}
	return regions.map((entry) =>
		entry.name === from ? { name: to, rect: { ...entry.rect } } : { ...entry },
	);
}
