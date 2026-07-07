/**
 * Grid-aware cursor navigation for fixed-column menus.
 *
 * Some menus lay their items out in a grid rather than a single column (the
 * in-battle move menu is a 2×2 grid), so a D-pad press must move the cursor by
 * columns and rows the way the player sees them: Left/Right step within a row,
 * Up/Down step between rows. This module keeps that index math in one pure,
 * testable place. Given the current index, a direction, the column count, and the
 * item count, it returns the index the cursor should land on, wrapping within a
 * row for horizontal moves and clamping to the last populated cell for vertical
 * moves so a ragged final row (e.g. a 3-item grid) never selects an empty slot.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** A cardinal direction a grid cursor can move. */
export type GridDirection = "up" | "down" | "left" | "right";

/**
 * Resolves the index a grid cursor lands on after one directional step.
 *
 * The grid fills left-to-right, top-to-bottom with `columns` per row. Horizontal
 * moves wrap within the current row (Right from the last column returns to the
 * first, Left from the first goes to the last populated column of that row).
 * Vertical moves add or subtract a full row and clamp to the last valid index, so
 * moving Down from a cell with no item beneath it (a ragged final row) stays on
 * the nearest occupied cell instead of an empty one. An out-of-range index or a
 * non-positive `columns`/`count` returns a safe clamped index.
 */
export function gridNavigate(
	index: number,
	direction: GridDirection,
	columns: number,
	count: number,
): number {
	if (count <= 0) return 0;
	if (columns <= 0) columns = 1;

	let current = Math.max(0, Math.min(index, count - 1));
	let row = Math.floor(current / columns);
	let column = current % columns;
	let rows = Math.ceil(count / columns);

	switch (direction) {
		case "left":
		case "right": {
			// Wrap within the populated cells of the current row only.
			let rowStart = row * columns;
			let rowCount = Math.min(columns, count - rowStart);
			let step = direction === "right" ? 1 : -1;
			let nextColumn = (column + step + rowCount) % rowCount;
			return rowStart + nextColumn;
		}
		case "up":
		case "down": {
			let step = direction === "down" ? 1 : -1;
			let nextRow = (row + step + rows) % rows;
			let candidate = nextRow * columns + column;
			// A wrap onto a ragged final row can land past the last item; clamp back.
			return Math.min(candidate, count - 1);
		}
	}
}
