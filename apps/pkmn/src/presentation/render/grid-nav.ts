/**
 * Grid-aware cursor navigation for fixed-column menus.
 *
 * Some menus lay items in a grid rather than a single column (the in-battle
 * move menu is a 2×2 grid), so a D-pad press must move by columns and rows
 * the way the player sees them: horizontal moves wrap within a row, and
 * vertical moves clamp to the last populated cell so a ragged final row
 * never selects an empty slot.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** A cardinal direction a grid cursor can move. */
export type GridDirection = "up" | "down" | "left" | "right";

/**
 * Resolves the index a grid cursor lands on after one directional step.
 * Horizontal moves wrap within the current row; vertical moves clamp to the
 * last valid index so a ragged final row never lands on an empty slot.
 *
 * @param index - The cursor's current index; an out-of-range value clamps
 * into range before the step is applied.
 * @param direction - Which way the cursor steps.
 * @param columns - Items per row; a non-positive value is treated as 1.
 * @param count - Total selectable items; a non-positive value returns 0.
 * @returns The index the cursor should land on after the step.
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
			return Math.min(candidate, count - 1);
		}
	}
}
