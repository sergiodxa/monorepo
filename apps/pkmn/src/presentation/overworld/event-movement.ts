/**
 * Autonomous movement for spawned overworld event entities.
 *
 * The active page of an event carries an `autonomousMovement` config (see
 * `map-schema`); this module advances that movement one tile at a time, on a cadence
 * derived from the page's `speed`/`freq`, against the same collision an actor obeys.
 * `fixed` never moves; `random` occasionally steps in a random direction; `route`
 * loops through the authored `route` steps. The page `options` refine it: `through`
 * ignores collision (walking onto any tile) and `directionFix` locks the facing so a
 * step never turns the graphic. The tile-choice logic (`nextRandomStep`,
 * `nextRouteStep`) is pure over an injected RNG and blocked-tile predicate so it is
 * unit-testable without a canvas, and the per-entity `MovementState` tracks how far a
 * route has advanced and when the next step is due. A step is only committed when its
 * destination tile is free (unless `through`), so an entity never walks through walls
 * or actors; a blocked `route` step still advances the route cursor so the pattern
 * stays in phase.
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
 * The milliseconds between steps for a movement config's speed and frequency.
 *
 * A higher `speed` shortens the step (the actor covers ground faster) and a higher
 * `freq` shortens the gap between attempts; both default to a mid value so an omitted
 * field yields the {@link STEP_INTERVAL_MS} baseline. The result is clamped to a
 * small floor so a fast actor still steps on a sane, testable cadence rather than
 * every frame.
 *
 * @param movement - The active page's autonomous-movement config.
 */
export function stepIntervalFor(movement: AutonomousMovement): number {
	let speed = movement.speed ?? 3;
	let freq = movement.freq ?? 3;
	// Both axes scale the baseline around their mid (3): faster/more-frequent both
	// shorten the interval. Floored so the cadence never collapses to a per-frame step.
	let interval = (STEP_INTERVAL_MS * 3 * 3) / (speed * freq);
	return Math.max(120, Math.round(interval));
}

/**
 * Picks a random cardinal direction whose destination tile is free, or null.
 *
 * Pure over the injected RNG: it rotates the four directions deterministically from
 * `random` and returns the first whose target tile is not blocked, so a boxed entity
 * that cannot move anywhere yields null instead of picking a wall.
 */
export function nextRandomStep(
	x: number,
	y: number,
	isBlocked: BlockedTile,
	random: () => number,
): Direction | null {
	// A single roll indexes a rotation of the four directions, then each is tried in
	// turn, so a fully boxed-in entity deterministically reports "no move".
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
 * Advances one actor's autonomous movement by `dt`, committing at most one step.
 *
 * `fixed` movement never moves. For `random` and `route`, the step timer accumulates
 * until the config's {@link stepIntervalFor} interval, then one step is attempted:
 * the actor turns to face the chosen direction (unless `directionFix` locks it) and
 * moves onto the target tile only when it is free — or always, when `through` ignores
 * collision. A `route` cursor always advances so a blocked step keeps the pattern in
 * phase; a `random` step that is blocked just turns without moving. Mutates the
 * actor's `x`/`y`/`facing` and the passed movement state in place.
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
		// `through` movement ignores collision, so a random step may pick any direction.
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
