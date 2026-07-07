/**
 * Idle movement for spawned overworld event entities.
 *
 * Each event carries a `movement` mode; this module advances that movement one
 * tile at a time, on a slow cadence, against the same collision an actor obeys.
 * `none` never moves; `random` occasionally steps in a random direction; `route`
 * loops through an authored step list. The tile-choice logic (`nextRandomStep`,
 * `nextRouteStep`) is pure over an injected RNG and blocked-tile predicate so it
 * is unit-testable without a canvas, and the per-entity `MovementState` tracks how
 * far a route has advanced and when the next step is due. A step is only committed
 * when its destination tile is free, so an entity never walks through walls, the
 * player, or another entity; a blocked route step still advances the route cursor
 * so the pattern stays in phase.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { type Direction, directionDelta } from "../core/direction";

import type { EventEntity } from "./event-runtime";

/** The four cardinal directions a random step may pick from. */
const RANDOM_STEP_DIRECTIONS = ["up", "down", "left", "right"] as const;

/** Milliseconds between an idle entity's steps (both random and route). */
export const STEP_INTERVAL_MS = 900;

/** Predicate marking a tile an entity cannot step onto (walls, actors, others). */
export type BlockedTile = (x: number, y: number) => boolean;

/** Per-entity movement bookkeeping the tick advances between frames. */
export interface MovementState {
	/** Milliseconds accumulated toward the next step. */
	elapsed: number;
	/** Index of the next step in a `route` movement's step list. */
	routeCursor: number;
}

/** Creates the initial movement state for a freshly spawned entity. */
export function createMovementState(): MovementState {
	return { elapsed: 0, routeCursor: 0 };
}

/**
 * Picks a random cardinal direction whose destination tile is free, or null.
 *
 * Pure over the injected RNG: it shuffles the four directions deterministically
 * from `random` and returns the first whose target tile is not blocked, so a boxed
 * entity that cannot move anywhere yields null instead of picking a wall.
 */
export function nextRandomStep(
	x: number,
	y: number,
	isBlocked: BlockedTile,
	random: () => number,
): Direction | null {
	// A single roll indexes a rotation of the four directions, then each is tried
	// in turn, so a fully boxed-in entity deterministically reports "no move".
	let start = Math.min(
		RANDOM_STEP_DIRECTIONS.length - 1,
		Math.floor(random() * RANDOM_STEP_DIRECTIONS.length),
	);
	for (let offset = 0; offset < RANDOM_STEP_DIRECTIONS.length; offset++) {
		let direction = RANDOM_STEP_DIRECTIONS[(start + offset) % RANDOM_STEP_DIRECTIONS.length]!;
		let delta = directionDelta(direction);
		if (!isBlocked(x + delta.dx, y + delta.dy)) return direction;
	}
	return null;
}

/** The route step at a cursor (wrapping), or null when the route has no steps. */
export function nextRouteStep(steps: readonly Direction[], cursor: number): Direction | null {
	if (steps.length === 0) return null;
	return steps[cursor % steps.length]!;
}

/**
 * Advances one entity's idle movement by `dt`, committing at most one step.
 *
 * `none` entities never move. For `random` and `route`, the step timer accumulates
 * until `STEP_INTERVAL_MS`, then one step is attempted: the entity always turns to
 * face the chosen direction, and moves onto the target tile only when it is free.
 * A `route` cursor always advances so a blocked step keeps the pattern in phase;
 * a `random` step that is blocked just turns without moving. Mutates the entity's
 * `x`/`y`/`facing` and the passed movement state in place.
 */
export function tickEventMovement(
	entity: EventEntity,
	state: MovementState,
	dt: number,
	isBlocked: BlockedTile,
	random: () => number,
) {
	if (entity.movement === "none") return;

	state.elapsed += dt;
	if (state.elapsed < STEP_INTERVAL_MS) return;
	state.elapsed -= STEP_INTERVAL_MS;

	let direction: Direction | null;
	if (entity.movement === "random") {
		direction = nextRandomStep(entity.x, entity.y, isBlocked, random);
	} else {
		direction = nextRouteStep(entity.movement.steps, state.routeCursor);
		state.routeCursor += 1;
	}
	if (!direction) return;

	entity.facing = direction;
	let delta = directionDelta(direction);
	let nextX = entity.x + delta.dx;
	let nextY = entity.y + delta.dy;
	if (isBlocked(nextX, nextY)) return;
	entity.x = nextX;
	entity.y = nextY;
}
