/**
 * Verifies idle movement for spawned event entities.
 *
 * A `random` step must respect collision (never onto a blocked tile) and report
 * "no move" when boxed in; a `route` step loops its authored list and keeps its
 * cursor in phase even when a step is blocked; and `none` never moves. The tick
 * only steps once its slow cadence elapses.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import { expect, test } from "bun:test";

import type { EventEntity } from "./event-runtime";

import {
	createMovementState,
	nextRandomStep,
	nextRouteStep,
	STEP_INTERVAL_MS,
	tickEventMovement,
} from "./event-movement";

/** Builds a minimal movable entity with the given movement config. */
function entity(movement: EventEntity["movement"], x = 2, y = 2): EventEntity {
	return {
		id: "e",
		x,
		y,
		facing: "down",
		kind: "npc",
		interactionMode: "action",
		sprite: null,
		movement,
		interaction: { script: [], trainer: undefined, wild: undefined },
		flag: null,
		once: false,
		done: false,
	};
}

test("nextRandomStep never returns a direction into a blocked tile", () => {
	// Only "up" from (2,2) is free; everything else is blocked.
	let isBlocked = (x: number, y: number) => !(x === 2 && y === 1);
	for (let roll = 0; roll < 4; roll++) {
		let direction = nextRandomStep(2, 2, isBlocked, () => roll / 4);
		expect(direction).toBe("up");
	}
});

test("nextRandomStep returns null when every neighbor is blocked", () => {
	expect(
		nextRandomStep(
			2,
			2,
			() => true,
			() => 0,
		),
	).toBeNull();
});

test("nextRouteStep loops the authored steps and wraps at the end", () => {
	let steps = ["left", "right"] as const;
	expect(nextRouteStep(steps, 0)).toBe("left");
	expect(nextRouteStep(steps, 1)).toBe("right");
	expect(nextRouteStep(steps, 2)).toBe("left");
	expect(nextRouteStep([], 0)).toBeNull();
});

test("tickEventMovement leaves a none entity in place", () => {
	let e = entity("none");
	let state = createMovementState();
	tickEventMovement(
		e,
		state,
		STEP_INTERVAL_MS * 5,
		() => false,
		() => 0,
	);
	expect(e).toMatchObject({ x: 2, y: 2 });
});

test("tickEventMovement only steps once the cadence elapses", () => {
	let e = entity({ type: "route", steps: ["right"] });
	let state = createMovementState();

	tickEventMovement(
		e,
		state,
		STEP_INTERVAL_MS - 1,
		() => false,
		() => 0,
	);
	expect(e.x).toBe(2);

	tickEventMovement(
		e,
		state,
		1,
		() => false,
		() => 0,
	);
	expect(e.x).toBe(3);
});

test("tickEventMovement walks a route in order and loops it", () => {
	let e = entity({ type: "route", steps: ["right", "down"] }, 2, 2);
	let state = createMovementState();
	let step = () =>
		tickEventMovement(
			e,
			state,
			STEP_INTERVAL_MS,
			() => false,
			() => 0,
		);

	step();
	expect(e).toMatchObject({ x: 3, y: 2, facing: "right" });
	step();
	expect(e).toMatchObject({ x: 3, y: 3, facing: "down" });
	step(); // wraps back to the first step
	expect(e).toMatchObject({ x: 4, y: 3, facing: "right" });
});

test("tickEventMovement keeps the route cursor in phase when a step is blocked", () => {
	let e = entity({ type: "route", steps: ["right", "down"] }, 2, 2);
	let state = createMovementState();
	// Block the first step's target (3,2); the second step (down) must still run next.
	let isBlocked = (x: number, y: number) => x === 3 && y === 2;

	tickEventMovement(e, state, STEP_INTERVAL_MS, isBlocked, () => 0);
	expect(e).toMatchObject({ x: 2, y: 2, facing: "right" }); // turned but blocked

	tickEventMovement(e, state, STEP_INTERVAL_MS, isBlocked, () => 0);
	expect(e).toMatchObject({ x: 2, y: 3, facing: "down" }); // second step, not repeated first
});

test("tickEventMovement blocks a random step against collision but still turns", () => {
	let e = entity("random", 2, 2);
	let state = createMovementState();
	// Everything blocked: the entity cannot move and stays put.
	tickEventMovement(
		e,
		state,
		STEP_INTERVAL_MS,
		() => true,
		() => 0,
	);
	expect(e).toMatchObject({ x: 2, y: 2 });
});
