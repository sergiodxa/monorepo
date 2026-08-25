/**
 * Pure atlas-slicing model: computes the named region map (`{ name: {x,y,w,h} }`)
 * an image is sliced into, either as a regular grid ({@link sliceGrid}, honouring
 * margin and spacing and emitting only cells that fit wholly) or as a
 * hand-authored ordered list ({@link addRegion}, {@link removeRegion},
 * {@link renameRegion}), each call returning a fresh list. Plain geometry.
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
	columns: number;
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
 * take for the slice math to stay integral and division-safe.
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
 * Counts the tile columns and rows that fit inside an image for a grid slice,
 * honouring the outer margin and inter-tile spacing; the count covers only cells
 * that fit wholly. Invalid dimensions yield zero, so a half-typed form previews.
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
 * The whole-tile count along one axis. Every tile after the first also costs
 * `spacing`, so the numerator adds one `spacing` back to account for the final
 * tile, which ends flush at its own edge. Clamped at zero.
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
	return Math.floor((usable + spacing) / (tile + spacing));
}

function gridRegionName(naming: GridNaming, index: number, row: number, column: number): string {
	if (naming === "grid") return `r${row}c${column}`;
	return `${TILE_NAME_PREFIX}.${index}`;
}

/**
 * Slices an image into a regular grid of tiles and returns the named-region map
 * an atlas is built from. Only cells that fit WHOLLY inside the image are
 * emitted, so every rect is a full `tileWidth`×`tileHeight`.
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
 * manifest atlas stores. A later duplicate name overwrites the earlier entry, so
 * callers keep names unique via {@link addRegion}/{@link renameRegion}.
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
 * Returns a new region list with `region` appended. A name that collides with an
 * existing entry is rejected, so every region reaches the manifest under its own
 * key; the input list is left intact.
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
 * Returns a new region list with the entry named `name` removed. An unmatched
 * name yields a plain copy, so removing an already-gone region is harmless; the
 * input list is left intact.
 *
 * @param regions The current ordered region list.
 * @param name The name of the region to remove.
 * @returns A new list without the named region.
 */
export function removeRegion(regions: readonly NamedRegion[], name: string): NamedRegion[] {
	return regions.filter((entry) => entry.name !== name).map((entry) => ({ ...entry }));
}

/**
 * Returns a new region list with `from` renamed to `to`, keeping its position
 * and rect. Renaming onto a name held by a DIFFERENT entry is rejected so names
 * stay unique; renaming an entry to its own name succeeds as a no-op.
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
