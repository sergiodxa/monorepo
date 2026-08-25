/**
 * Autonomous movement for spawned overworld event entities.
 *
 * Advances `fixed`, `random`, and `route` movement one tile at a time,
 * honoring collision unless `through` is set; a blocked `route` step still
 * advances its cursor so the pattern stays in phase.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { AutonomousMovement, PageOptions } from "../render/map-schema";

import { type Direction, directionDelta } from "../core/direction";

/** The four cardinal directions a random step may pick from. */
const RANDOM_STEP_DIRECTIONS = ["up", "down", "left", "right"] as const;

/** Baseline milliseconds between an idle entity's steps at the default speed/freq. */
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
 * The milliseconds between steps for a movement config's speed and
 * frequency; defaults to {@link STEP_INTERVAL_MS} and is clamped to a
 * small floor so a fast actor never steps every frame.
 *
 * @param movement - The active page's autonomous-movement config.
 */
export function stepIntervalFor(movement: AutonomousMovement): number {
	let speed = movement.speed ?? 3;
	let freq = movement.freq ?? 3;
	let interval = (STEP_INTERVAL_MS * 3 * 3) / (speed * freq);
	return Math.max(120, Math.round(interval));
}

/**
 * Picks a random cardinal direction whose destination tile is free, or
 * null when a boxed-in entity has nowhere to go. Rotates the four
 * directions deterministically from `random`, pure over the injected RNG.
 */
export function nextRandomStep(
	x: number,
	y: number,
	isBlocked: BlockedTile,
	random: () => number,
): Direction | null {
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

/** The mutable position and facing autonomous movement reads and updates. */
export interface MovableActor {
	x: number;
	y: number;
	facing: Direction;
}

/**
 * Advances one actor's autonomous movement by `dt`, at most one step per
 * {@link stepIntervalFor} interval. A blocked `route` step still advances
 * the cursor to stay in phase; a blocked `random` step turns without moving.
 *
 * @param actor - The entity's mutable position and facing.
 * @param state - The per-entity movement bookkeeping (timer and route cursor).
 * @param movement - The active page's autonomous-movement config.
 * @param options - The active page's options (`through`, `directionFix`).
 * @param dt - Milliseconds elapsed since the last tick.
 * @param isBlocked - Predicate marking a tile the actor cannot step onto.
 * @param random - RNG in `[0, 1)` used to pick a random step.
 */
export function tickEventMovement(
	actor: MovableActor,
	state: MovementState,
	movement: AutonomousMovement,
	options: PageOptions,
	dt: number,
	isBlocked: BlockedTile,
	random: () => number,
) {
	if (movement.type === "fixed") return;

	state.elapsed += dt;
	let interval = stepIntervalFor(movement);
	if (state.elapsed < interval) return;
	state.elapsed -= interval;

	let direction: Direction | null;
	if (movement.type === "random") {
		direction = options.through
			? nextRandomStep(actor.x, actor.y, () => false, random)
			: nextRandomStep(actor.x, actor.y, isBlocked, random);
	} else {
		direction = nextRouteStep(movement.route ?? [], state.routeCursor);
		state.routeCursor += 1;
	}
	if (!direction) return;

	if (!options.directionFix) actor.facing = direction;
	let delta = directionDelta(direction);
	let nextX = actor.x + delta.dx;
	let nextY = actor.y + delta.dy;
	if (!options.through && isBlocked(nextX, nextY)) return;
	actor.x = nextX;
	actor.y = nextY;
}
