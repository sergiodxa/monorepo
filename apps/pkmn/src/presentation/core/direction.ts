/**
 * The four cardinal facings shared across the presentation. Movement, sprite
 * rows, NPC facing, warps, and save state all speak in these directions, so
 * the type and its helpers (grid delta, opposite, sprite row) live in one
 * dependency-free module importable without coupling to other modules.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** A cardinal facing. */
export type Direction = "up" | "down" | "left" | "right";

/** The `(dx, dy)` tile step for moving one tile in a direction. */
export function directionDelta(direction: Direction): { dx: number; dy: number } {
	switch (direction) {
		case "up":
			return { dx: 0, dy: -1 };
		case "down":
			return { dx: 0, dy: 1 };
		case "left":
			return { dx: -1, dy: 0 };
		case "right":
			return { dx: 1, dy: 0 };
	}
}

/** The facing that points the opposite way. */
export function oppositeDirection(direction: Direction): Direction {
	switch (direction) {
		case "up":
			return "down";
		case "down":
			return "up";
		case "left":
			return "right";
		case "right":
			return "left";
	}
}

/** The character sprite-sheet row for a facing (down, left, right, up). */
export function directionRow(direction: Direction): number {
	switch (direction) {
		case "down":
			return 0;
		case "left":
			return 1;
		case "right":
			return 2;
		case "up":
			return 3;
	}
}
